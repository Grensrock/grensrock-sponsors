import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_CONTACT_COLUMNS, toPortalContact } from "@/lib/auth/portal-account";
import { issuePortalMagicLink } from "@/lib/auth/portal-magic-link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   POST /api/portal/magic-link  { email }
   ============================================================
   "Send me a link instead" from the sign-in page. Unauthenticated by
   necessity: the person asking is precisely the one who has no session.

   It is the twin of /api/portal/request-link and keeps the same two
   rules, for the same reasons:

   - It ALWAYS answers the same way. Saying "no such contact" would turn
     this into a way to ask whether a given company works with
     Grensrock, one address at a time — sponsor relationships are not
     ours to disclose. Same response, same shape, whatever happens
     behind it.
   - A contact who was sent a link minutes ago is not sent another, so
     submitting the form in a loop cannot bury someone's inbox. The one
     already in their mail still works.

   What it is NOT is the same operation: that route hands over a
   password, this one hands over a session. A contact may have both, or
   only this.
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

/* Shorter than request-link's five minutes: these links expire within the
   hour, so someone who waited a few minutes and saw nothing arrive has a real
   reason to try again rather than a link sitting in their inbox. */
const RESEND_GAP_MS = 2 * 60 * 1000;

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
      .select(PORTAL_CONTACT_COLUMNS)
      .ilike("email", email)
      .eq("portal_access", true)
      .limit(1);

    const row = rows?.[0];
    if (!row) return always();

    const { data: recent } = await admin
      .from("portal_magic_links")
      .select("created_at")
      .eq("contact_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const last = recent?.[0]?.created_at ? new Date(recent[0].created_at as string).getTime() : 0;
    if (Date.now() - last < RESEND_GAP_MS) return always();

    await issuePortalMagicLink(toPortalContact(row), request.nextUrl.origin);
  } catch {
    /* Swallowed on purpose: an error here would be a side channel telling the
       caller their address matched something. The team can send a link by hand
       if a sponsor says nothing came. */
  }

  return always();
}
