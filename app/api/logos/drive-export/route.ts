import { NextResponse, type NextRequest } from "next/server";
import { DriveNotConfiguredError, driveConfigured, upsertFile } from "@/lib/integrations/drive";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   POST /api/logos/drive-export  { sponsorId, name }
   ============================================================
   Copies one sponsor's logo from Supabase Storage into the Shared Drive
   folder the design team works from. Supabase remains the system of
   record; this is one-way and nothing reads back.

   One sponsor per request on purpose. Doing the whole edition in a
   single call would mean an unpredictable number of download/upload
   round trips inside one serverless invocation, and the failure mode is
   a timeout partway through with no idea what got exported. The client
   loops instead, so progress is visible and one bad file doesn't sink
   the rest.

   The logo is read with the CALLER's session, so RLS decides what may be
   exported (0006_storage.sql). That matters: the service account can see
   the whole Shared Drive, so this route is the only place where "may
   this person export this logo" is answered, and it answers it by
   letting the database answer it.
   ============================================================ */

export const runtime = "nodejs";
export const maxDuration = 60;

const MIME: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  ai: "application/postscript",
  eps: "application/postscript",
};

export async function POST(request: NextRequest) {
  let body: { sponsorId?: string; name?: string; path?: string };
  try {
    body = (await request.json()) as { sponsorId?: string; name?: string; path?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sponsorId = String(body.sponsorId || "").trim();
  if (!sponsorId) return NextResponse.json({ error: "A sponsor id is required." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!driveConfigured()) {
    return NextResponse.json({ error: "The Drive export is not configured on the server." }, { status: 503 });
  }

  /* Since 0014 a sponsor has several logos and the caller says which one, by
     object path. It is still checked against the sponsor id rather than
     trusted: a path is a client-supplied string, and without this the caller
     could name any object in the bucket, including another company's. */
  const path = String(body.path || "");
  if (!path || !path.startsWith(`${sponsorId}/`) || path.includes("..")) {
    return NextResponse.json({ error: "No logo selected for this sponsor." }, { status: 400 });
  }
  const { data: file, error: downloadError } = await supabase.storage.from("sponsor-logos").download(path);
  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message || "Could not read the logo." }, { status: 502 });
  }

  const ext = (path.split(".").pop() || "").toLowerCase();
  /* Falls back to the sponsor id so a file can never be written without a
     name, but the client supplies the readable one the design team wants. */
  const base = String(body.name || sponsorId)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  try {
    const outcome = await upsertFile({
      name: `${base}.${ext}`,
      mimeType: file.type || MIME[ext] || "application/octet-stream",
      body: await file.arrayBuffer(),
    });
    return NextResponse.json({ outcome, name: `${base}.${ext}` });
  } catch (ex) {
    const status = ex instanceof DriveNotConfiguredError ? 503 : 502;
    return NextResponse.json({ error: ex instanceof Error ? ex.message : "Drive export failed." }, { status });
  }
}
