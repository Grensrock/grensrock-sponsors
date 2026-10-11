import { NextResponse, type NextRequest } from "next/server";
import { tokenHash } from "@/lib/auth/portal-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   GET /auth/accept?token=…
   ============================================================
   The personal link in an agreement mail (lib/auth/portal-accept-link.ts).
   A valid one signs the contact in and lands them on "/", where the
   portal opens on "Sponsoring" with the agreement waiting to be
   accepted — no sign-in form in between.

   The session itself still has to come from Supabase Auth, and only a
   one-time token of Auth's own can be traded for one. So the link's
   long-lived token is checked here, and on the spot Auth mints a
   sign-in token (generateLink, which sends nothing) that is redeemed
   straight away through the server client — writing the session
   cookies the same way app/auth/callback does for an emailed sign-in
   link.

   A link that doesn't work lands on the sign-in page with the same
   "linkexpired" code app/auth/callback uses, whatever the reason: the
   page then offers a fresh sign-in link, which is all the sponsor can
   do about it, and saying more would tell a guesser something.
   ============================================================ */

export const runtime = "nodejs";

const failed = (origin: string) => NextResponse.redirect(`${origin}/?auth_error=linkexpired`);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token = searchParams.get("token") || "";
  if (!token) return failed(origin);

  /* Service-role: the person following the link has no session yet, so RLS
     would show them nothing. What it can do is narrow — sign in the contact
     the link was minted for, and only them. */
  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("portal_accept_links")
    .select("id, contact_id, email")
    .eq("token_hash", tokenHash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!link) return failed(origin);

  /* Still a contact with portal access, at the address the link was mailed
     to. Access withdrawn or the address changed since: the link was meant
     for someone the contact no longer is. */
  const { data: contact } = await admin
    .from("contacts")
    .select("email, portal_access")
    .eq("id", link.contact_id)
    .maybeSingle();
  const email = String(contact?.email || "").trim().toLowerCase();
  if (!contact?.portal_access || email !== link.email) return failed(origin);

  const { data: minted, error: mintError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashedToken = minted?.properties?.hashed_token;
  if (mintError || !hashedToken) return failed(origin);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hashedToken });
  if (error) return failed(origin);

  /* As in app/auth/callback: binds the session to its contacts row. Team
     provisioning is not run here, for the reason given there. */
  await supabase.rpc("claim_portal_contact");

  await admin.from("portal_accept_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);

  return NextResponse.redirect(origin + "/");
}
