import { NextResponse, type NextRequest } from "next/server";
import { hashesMatch, tokenHash } from "@/lib/auth/portal-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   POST /api/portal/set-password  { token, password }
   ============================================================
   Redeems a link from the email. Unauthenticated by necessity — the
   token IS the authentication, which is why it is 32 random bytes,
   stored only as a SHA-256, single-use, and dead after 14 days.

   The response never distinguishes "no such token" from "already used"
   or "expired": all three mean the same thing to the person holding a
   link that doesn't work, and telling them apart would confirm to
   someone guessing that a token had once been real.
   ============================================================ */

export const runtime = "nodejs";

/** Long enough to matter, short enough that people don't paste it into a note. */
const MIN_PASSWORD = 10;

/* `code` is what the page renders: this responds to sponsors, who read NL, FR
   or EN, and only the page knows which. `error` stays as an English fallback
   for anything reading the response without a translation table. */
const fail = (code: string, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ code, error, ...extra }, { status: 400 });

/* Built per call, not shared: a Response body can only be consumed once, so a
   module-level instance would answer every request after the first with an
   empty body — which reads as a server fault rather than an expired link. */
const dead = () => fail("invalidlink", "This link is no longer valid. Ask for a new one from the sign-in page.");

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = (await request.json()) as { token?: string; password?: string };
  } catch {
    return fail("badrequest", "Invalid request body.");
  }

  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token) return dead();
  if (password.length < MIN_PASSWORD) {
    return fail("tooshort", `Choose a password of at least ${MIN_PASSWORD} characters.`, { min: MIN_PASSWORD });
  }

  const admin = createSupabaseAdminClient();
  const hash = tokenHash(token);

  const { data: invite } = await admin
    .from("portal_invites")
    .select("id, contact_id, email, token_hash, expires_at, used_at")
    .eq("token_hash", hash)
    .maybeSingle();

  /* The lookup is by hash so this is belt and braces, but comparing in constant
     time costs nothing and keeps the guarantee local to this file. */
  if (!invite || !hashesMatch(String(invite.token_hash), hash)) return dead();
  if (invite.used_at) return dead();
  if (new Date(String(invite.expires_at)).getTime() < Date.now()) return dead();

  const { data: contact } = await admin
    .from("contacts")
    .select("id, auth_user_id, portal_access")
    .eq("id", invite.contact_id)
    .maybeSingle();
  /* Access can have been withdrawn between sending the link and clicking it. */
  if (!contact || !contact.portal_access || !contact.auth_user_id) return dead();

  const { error } = await admin.auth.admin.updateUserById(String(contact.auth_user_id), {
    password,
    email_confirm: true,
  });
  if (error) return fail("failed", error.message);

  /* Burned only after the password actually changed, so a failure here leaves a
     link that still works rather than one that spent itself for nothing. */
  await admin.from("portal_invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

  return NextResponse.json({ ok: true, email: invite.email });
}
