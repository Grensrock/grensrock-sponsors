import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   Auth callback — sponsor sign-in links and team Google sign-in
   ============================================================
   Turns whichever one-time credential arrived in the query string into
   a real session (the cookies are written by the server client), then
   binds that session to the account it belongs to. Which credential it
   was decides how far that binding goes — see the note above
   ensure_team_profile() at the bottom.

   Two credentials land here, because two things issue one:
     - `code`, from Google's OAuth redirect.
     - `token_hash`, from a sponsor's emailed sign-in link
       (lib/auth/portal-magic-link.ts).
   Redeeming the second here, rather than pointing the email at
   Supabase's own action_link, is what keeps the session in cookies the
   server can see instead of in a URL fragment only the browser reads.

   The app is a single page (Stage 1's routing decision stands), so
   everything lands back on "/" — GrensrockApp derives team vs portal
   from the session itself on mount.
   ============================================================ */

/* Sponsor-facing, so the landing page has to be able to say this in NL, FR and
   EN. A code travels instead of Supabase's English "Token has expired or is
   invalid", which tells a sponsor nothing they can act on. */
const failed = (origin: string, code: string) =>
  NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(code)}`);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const authError = searchParams.get("error_description") || searchParams.get("error");

  if (authError) return failed(origin, authError);

  const supabase = await createSupabaseServerClient();

  /* Which credential arrived decides what the session is allowed to become,
     which is why this is tracked rather than inferred afterwards. */
  let fromGoogle = false;

  if (tokenHash) {
    /* Only our own sign-in links come through here, and they all say
       magiclink. Passing the parameter straight through would hand an
       attacker-chosen verification type to Auth for free. */
    if (type !== "magiclink") return failed(origin, "linkbroken");

    const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    /* One code for every way a link can fail — expired, already used, never
       real. They mean the same thing to the person holding it ("ask for
       another"), and telling them apart would confirm to someone guessing
       that a token had once existed. */
    if (error) return failed(origin, "linkexpired");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failed(origin, error.message);
    fromGoogle = true;
  } else {
    return failed(origin, "linkbroken");
  }

  /* Binds the session to the contacts row matching its email, if that contact
     has portal access. A no-op for a session that isn't a sponsor's, so it is
     safe to call on every sign-in. Failure here is not fatal — an unrecognised
     session simply lands on a page with nothing on it. */
  await supabase.rpc("claim_portal_contact");

  /* Team provisioning is deliberately NOT run for a sign-in link.
     ensure_team_profile() gates on the address ending in @grensrock.be and
     nothing else, and says why in 0008: reaching it meant coming through
     Google, which only ever hands back a verified address. A sign-in link is a
     second way to arrive, so that reasoning has to be re-made rather than
     inherited — and it does not hold. A link is issued to any contact with
     portal access, and a @grensrock.be address sitting in `contacts` (someone
     on the team added as a portal contact to see a sponsor's view, say) is an
     ordinary thing for the team to have done. Running it here would turn that
     row into a team account, an admin one if profiles happened to be empty.

     Nothing is lost by the omission: a sign-in link only ever goes to a
     sponsor contact, and team members have the Google button. */
  if (fromGoogle) await supabase.rpc("ensure_team_profile");

  return NextResponse.redirect(origin + "/");
}
