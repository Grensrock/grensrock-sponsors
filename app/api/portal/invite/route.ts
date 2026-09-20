import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_CONTACT_COLUMNS, toPortalContact } from "@/lib/auth/portal-account";
import { issuePortalInvite } from "@/lib/auth/portal-invite";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   POST /api/portal/invite  { contactId }
   ============================================================
   Team-side: sends a contact the link to set their portal password.
   Fired when portal access is switched on, and again from the resend
   button whenever someone needs a fresh one.

   Used by the team when they switch access on or press resend, and by a
   sponsor in their own portal adding a colleague — both are the same
   act, so both go through here.

   The contact is re-read through the CALLER's session, and that read IS
   the permission check: contacts_select_team lets a team member see
   every contact, contacts_select_own_portal limits a portal session to
   its own company's (0003_rls.sql). A caller who cannot see the row
   gets a 404 and no mail is sent. Writing that rule out again here
   would only be a second copy to keep in step with the first.

   Only the id crosses the wire — address, name and language all come
   from the row, so this cannot be pointed at an arbitrary address, and
   the email always describes the contact that actually exists.
   ============================================================ */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { contactId?: string };
  try {
    body = (await request.json()) as { contactId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const contactId = String(body.contactId || "").trim();
  if (!contactId) return NextResponse.json({ error: "A contact id is required." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: row } = await supabase
    .from("contacts")
    .select(PORTAL_CONTACT_COLUMNS)
    .eq("id", contactId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "No such contact." }, { status: 404 });

  if (!row.portal_access) {
    return NextResponse.json({ error: "This contact doesn't have portal access." }, { status: 409 });
  }

  const contact = toPortalContact(row);
  const result = await issuePortalInvite(contact, request.nextUrl.origin);
  if (!result.sent) return NextResponse.json({ error: result.reason || "Could not send the link." }, { status: 502 });
  return NextResponse.json({ sent: true, to: contact.email });
}
