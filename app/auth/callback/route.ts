import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   Magic-link / e-mail-confirmation callback
   ============================================================
   Exchanges the one-time code for a real session (the cookies are
   written by the server client), then binds the session to the
   sponsor's contacts row via claim_portal_contact(). The RPC is a
   no-op for team members and for already-claimed contacts, so it is
   safe to call on every sign-in.

   The app is a single page (Stage 1's routing decision stands), so
   everything lands back on "/" — GrensrockApp derives team vs portal
   from the session itself on mount.
   ============================================================ */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const authError = searchParams.get("error_description") || searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(authError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent("Missing login code.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
  }

  /* Sponsor contacts: bind this auth user to their contacts row. Failure here
     is not fatal — the portal's own "sponsor not found" state covers it. */
  await supabase.rpc("claim_portal_contact");

  return NextResponse.redirect(origin + "/");
}
