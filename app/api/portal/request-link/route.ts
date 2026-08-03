import { NextResponse, type NextRequest } from "next/server";
import { issuePortalInvite, toInviteContact } from "@/lib/auth/portal-invite";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   POST /api/portal/request-link  { email }
   ============================================================
   "I can't get in" from the sign-in page. Unauthenticated by necessity:
   the person asking is precisely the one who cannot sign in.

   It ALWAYS answers the same way. Saying "no such contact" would turn
   this into a way to ask whether a given company works with Grensrock,
   one address at a time — sponsor relationships are not ours to
   disclose. Same response, same shape, whatever happens behind it.

   A contact with an unexpired link already waiting is not sent another,
   so repeatedly submitting the form cannot be used to flood someone's
   inbox. They keep the link they were sent.
   ============================================================ */

export const runtime = "nodejs";

/* Deliberately identical in every branch — and built fresh each time: a
   Response body is a stream that can only be read once, so a shared instance
   serves an empty body to every request after the first. */
const always = () =>
  NextResponse.json({
    ok: true,
    message: "If that address belongs to a sponsor contact with portal access, a link is on its way.",
  });

const RESEND_GAP_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return always();
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return always();

  try {
    const admin = createSupabaseAdminClient();

    /* Service-role: RLS would hide the row from an unauthenticated caller, and
       there is no session here by definition. The narrowness of what this can
       do — email the address that was submitted, and only if it is already a
       portal contact — is what makes that safe. */
    const { data: rows } = await admin
      .from("contacts")
      .select("id, first_name, last_name, email, phone, language, pref_info, pref_invoice, portal_access")
      .ilike("email", email)
      .eq("portal_access", true)
      .limit(1);

    const row = rows?.[0];
    if (!row) return always();

    const { data: recent } = await admin
      .from("portal_invites")
      .select("created_at")
      .eq("contact_id", row.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    const last = recent?.[0]?.created_at ? new Date(recent[0].created_at as string).getTime() : 0;
    if (Date.now() - last < RESEND_GAP_MS) return always();

    await issuePortalInvite(toInviteContact(row), request.nextUrl.origin);
  } catch {
    /* Swallowed on purpose: an error here would be a side channel telling the
       caller their address matched something. It is logged nowhere the caller
       can see, and the team can resend by hand if a sponsor says nothing came. */
  }

  return always();
}
