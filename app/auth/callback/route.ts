import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   Auth callback — sponsor magic links and team Google sign-in
   ============================================================
   Exchanges the one-time code for a real session (the cookies are
   written by the server client), then binds the session to whichever
   kind of account it belongs to. Both RPCs below are no-ops for the
   case they don't apply to, so they are safe to call on every sign-in.

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

  /* One callback serves both sign-in kinds, so run both bindings: each is a
     no-op for the session it doesn't apply to. Failure here is not fatal —
     an unrecognised session simply lands on a page with nothing on it.
       - claim_portal_contact(): binds a sponsor contact to their contacts row.
       - ensure_team_profile(): provisions a team profile for a verified
         @grensrock.be Google account (the real domain check lives there). */
  await supabase.rpc("claim_portal_contact");
  await supabase.rpc("ensure_team_profile");

  return NextResponse.redirect(origin + "/");
}
