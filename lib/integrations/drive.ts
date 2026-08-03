import { JWT } from "google-auth-library";

/* ============================================================
   Google Shared Drive export — SERVER ONLY
   ============================================================
   One-way: Supabase Storage stays the system of record, this only
   pushes copies out so the design team can work from Drive directly.
   Nothing here ever reads back into the app, which is the whole point —
   the access rules in 0006_storage.sql keep governing the real files,
   and a stale or deleted copy in Drive can never affect the app.

   Auth is a service account added as a member of the Shared Drive
   (Content Manager). A Shared Drive can take a service account
   directly; a personal My Drive folder cannot, and would have needed
   domain-wide delegation through the Admin console. That difference is
   the reason this is workable at all.

   Because the service account can see everything in that Drive, the
   authorisation that matters happens before we get here: the export
   route reads each logo through the caller's own Supabase session, so
   RLS decides what may be exported. This module is a dumb pipe.
   ============================================================ */

export class DriveNotConfiguredError extends Error {}

const SCOPE = "https://www.googleapis.com/auth/drive";

export const driveConfigured = () =>
  !!(process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID);

let client: JWT | null = null;

/* Every way this value gets pasted wrong produces the same unhelpful OpenSSL
   error — "DECODER routines::unsupported" — which names neither the variable
   nor the problem. So the shapes people actually paste are handled here, and
   anything left is rejected with a message that says what to fix. */
export function normalisePrivateKey(raw: string): string {
  let k = raw.trim();

  /* The whole service-account JSON file, rather than one field out of it. */
  if (k.startsWith("{")) {
    try {
      const parsed = JSON.parse(k) as { private_key?: string };
      if (parsed.private_key) k = parsed.private_key.trim();
    } catch {
      /* fall through to the PEM check below */
    }
  }

  /* The field copied together with its surrounding JSON quotes, which leaves a
     quote character at each end of the PEM. */
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }

  /* Vercel stores the value on one line, so the PEM's newlines arrive escaped. */
  k = k.replace(/\\r/g, "").replace(/\\n/g, "\n");

  /* OpenSSL wants the final newline. */
  if (!k.endsWith("\n")) k += "\n";
  return k;
}

function auth(): JWT {
  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const raw = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!email || !raw) throw new DriveNotConfiguredError("The Drive export is not configured on the server.");

  const key = normalisePrivateKey(raw);
  if (!/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(key)) {
    throw new DriveNotConfiguredError(
      "GOOGLE_DRIVE_PRIVATE_KEY isn't a PEM key. It must be the private_key field from the service account JSON, " +
        "starting with -----BEGIN PRIVATE KEY----- — not the whole file, and without the surrounding quotes.",
    );
  }

  if (!client) client = new JWT({ email, key, scopes: [SCOPE] });
  return client;
}

async function token(): Promise<string> {
  let res;
  try {
    res = await auth().getAccessToken();
  } catch (ex) {
    const message = ex instanceof Error ? ex.message : String(ex);
    /* OpenSSL's decode failure names neither the variable nor the cause, and
       on its own reads like a Drive problem rather than a config one. */
    if (/DECODER|unsupported|asn1|PEM/i.test(message)) {
      throw new DriveNotConfiguredError(
        `GOOGLE_DRIVE_PRIVATE_KEY could not be read as a key (${message}). Re-copy the private_key value from the ` +
          "service account JSON — the whole PEM, without the surrounding quotes.",
      );
    }
    throw new Error(`Could not authenticate with Google Drive: ${message}`);
  }
  const t = typeof res === "string" ? res : res?.token;
  if (!t) throw new Error("Could not authenticate with Google Drive.");
  return t;
}

/** Shared Drive calls need both of these or they 404 on anything not in My Drive. */
const SHARED = "supportsAllDrives=true&includeItemsFromAllDrives=true";

async function findByName(name: string, folderId: string, accessToken: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&${SHARED}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Drive search failed (${res.status}).`);
  const body = (await res.json()) as { files?: Array<{ id: string }> };
  return body.files?.[0]?.id || null;
}

/**
 * Writes a file into the configured Shared Drive folder, replacing the
 * previous copy of the same name rather than adding a second one — Drive
 * happily allows duplicate names, so without this a re-export would leave
 * the design team choosing between three files called the same thing.
 *
 * Returns "created" or "updated" so the caller can report what happened.
 */
export async function upsertFile({
  name,
  mimeType,
  body,
}: {
  name: string;
  mimeType: string;
  body: ArrayBuffer;
}): Promise<"created" | "updated"> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new DriveNotConfiguredError("The Drive export is not configured on the server.");

  const accessToken = await token();
  const existing = await findByName(name, folderId, accessToken);

  const metadata = existing ? { name } : { name, parents: [folderId] };
  const boundary = "grensrock" + Math.random().toString(36).slice(2);
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata,
  )}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;

  const payload = new Blob([head, body, tail], { type: `multipart/related; boundary=${boundary}` });

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart&${SHARED}`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&${SHARED}`;

  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: payload,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Drive upload failed (${res.status}). ${detail.slice(0, 200)}`);
  }
  return existing ? "updated" : "created";
}
