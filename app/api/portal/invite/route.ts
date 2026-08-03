import { NextResponse, type NextRequest } from "next/server";
import { issuePortalInvite, toInviteContact } from "@/lib/auth/portal-invite";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   POST /api/portal/invite  { contactId }
   ============================================================
   Team-side: sends a contact the link to set their portal password.
   Fired when portal access is switched on, and again from the resend
   button whenever someone needs a fresh one.

   The contact is re-read through the CALLER's session, so RLS decides
   who may be invited. Only the id crosses the wire — address, name and
   language all come from the row, so this cannot be used to mail an
   arbitrary person, and the email always describes the contact that
   actually exists.
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

  /* Team only. A sponsor-portal session can read its own company's contacts,
     which would otherwise let one contact trigger mail to a colleague. */
  const { data: profile } = await supabase.from("profiles").select("id, approved").eq("id", user.id).maybeSingle();
  if (!profile || !profile.approved) {
    return NextResponse.json({ error: "Only the Grensrock team can do this." }, { status: 403 });
  }

  const { data: row } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, language, pref_info, pref_invoice, portal_access")
    .eq("id", contactId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "No such contact." }, { status: 404 });

  if (!row.portal_access) {
    return NextResponse.json({ error: "This contact doesn't have portal access." }, { status: 409 });
  }

  const contact = toInviteContact(row);
  const result = await issuePortalInvite(contact, request.nextUrl.origin);
  if (!result.sent) return NextResponse.json({ error: result.reason || "Could not send the link." }, { status: 502 });
  return NextResponse.json({ sent: true, to: contact.email });
}
