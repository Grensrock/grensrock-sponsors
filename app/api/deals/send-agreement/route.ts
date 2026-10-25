import { NextResponse, type NextRequest } from "next/server";
import { LANGS } from "@/lib/constants";
import { deliverAgreement, mailableContacts } from "@/lib/email/agreement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Language, PendingMail } from "@/types";

/* ============================================================
   POST /api/deals/send-agreement
     { dealId, contactIds[], subject, body, language }
   ============================================================
   Mails the confirmation of an agreement to the sponsor's contact
   person(s) and marks the agreement as sent. Server-side because the
   Workspace App Password must never reach a browser — same reasoning as
   the CBE key and the team access mail.

   Unlike the other mail routes, the text IS taken from the request: the
   team edits the message in the preview before sending, so a route that
   rebuilt it server-side would send something other than what was
   approved on screen. The language comes along with it: it is the
   text's, and it picks the words on the button the link becomes in the
   laid-out mail. How the mail is delivered, and why it can still only
   reach the sponsor's own contacts, is in lib/email/agreement.ts.

   An agreement whose benefits wait for an admin (0026) is not sent yet.
   A team member's mail is held on the agreement instead, as written, and
   goes out when an admin approves (app/api/deals/approve-benefits). An
   admin sending it is that approval, so theirs goes out straight away.
   ============================================================ */

export const runtime = "nodejs"; // nodemailer opens a TCP connection; not available on edge

/* Generous, but bounded: the body is free text from a trusted team member,
   and the point of a limit is only to keep a runaway paste out of SMTP. */
const MAX_SUBJECT = 300;
const MAX_BODY = 50_000;

interface Payload {
  dealId?: string;
  contactIds?: unknown;
  subject?: string;
  body?: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const dealId = String(payload.dealId || "").trim();
  const contactIds = Array.isArray(payload.contactIds) ? payload.contactIds.map((x) => String(x || "").trim()) : [];
  const subject = String(payload.subject || "").trim();
  const text = String(payload.body || "");
  const language = (payload.language && Object.hasOwn(LANGS, payload.language) ? payload.language : "nl") as Language;

  if (!dealId) return NextResponse.json({ error: "An agreement id is required." }, { status: 400 });
  if (contactIds.filter(Boolean).length === 0) {
    return NextResponse.json({ error: "Select at least one contact person." }, { status: 400 });
  }
  if (!subject) return NextResponse.json({ error: "The email needs a subject." }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ error: "The email has no message." }, { status: 400 });
  if (subject.length > MAX_SUBJECT || text.length > MAX_BODY) {
    return NextResponse.json({ error: "That message is too long to send." }, { status: 413 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  /* Both roles may send an agreement (this is everyday sponsor work, not
     administration), but an account still waiting for approval may not, and
     a user only for a sponsor they are responsible for (checked below). */
  const { data: caller } = await supabase
    .from("profiles")
    .select("id, role, approved, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller || !caller.approved) {
    return NextResponse.json({ error: "Your account doesn't have access yet." }, { status: 403 });
  }
  const callerName = [caller.first_name, caller.last_name].filter(Boolean).join(" ");

  /* Read through the CALLER's session, so RLS is the permission check: a
     sponsor portal session can see its own deal but has no profiles row, and
     was already turned away above. */
  const { data: deal } = await supabase
    .from("deals")
    .select("id, sponsor_id, benefits_changed_at, benefits_approved_at")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "No such agreement." }, { status: 404 });

  /* Sending the contract is changing the agreement, so the same rule as
     editing it applies (0024): the sponsor's responsible, or an admin. Asked
     before anything goes out — marking it sent at the end would be refused
     too, but by then the sponsor would already have the mail. */
  const { data: allowed } = await supabase.rpc("can_manage_sponsor", { p_sponsor_id: deal.sponsor_id });
  if (!allowed) {
    return NextResponse.json(
      { error: "Only the team member responsible for this sponsor, or an admin, can send this agreement." },
      { status: 403 },
    );
  }

  const mail = { contactIds, subject, body: text, language };

  if (deal.benefits_changed_at && !deal.benefits_approved_at) {
    if (caller.role !== "admin") {
      /* Checked now rather than only when it is sent, so whoever wrote it
         hears about a recipient without an address while they still can. */
      const to = await mailableContacts(supabase, deal.sponsor_id, contactIds);
      if (to.length === 0) {
        return NextResponse.json(
          { error: "None of the selected contacts has a usable email address." },
          { status: 409 },
        );
      }
      const held: PendingMail = { ...mail, heldAt: new Date().toISOString(), heldBy: callerName };
      const { error } = await supabase.from("deals").update({ pending_mail: held }).eq("id", dealId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ held: true, to: to.map((r) => String(r.email)), cc: null, warnings: [] });
    }
    const { error } = await supabase
      .from("deals")
      .update({ benefits_approved_at: new Date().toISOString(), benefits_approved_by: callerName })
      .eq("id", dealId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = await deliverAgreement(supabase, deal, mail, request.nextUrl.origin);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ sent: true, sentAt: result.sentAt, to: result.to, cc: result.cc, warnings: result.warnings });
}
