import { NextResponse, type NextRequest } from "next/server";
import { issuePortalInvite, toInviteContact } from "@/lib/auth/portal-invite";
import { MailNotConfiguredError, mailConfigured, sendMail } from "@/lib/email/send";
import { validateEmail } from "@/lib/email-validate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   POST /api/deals/send-agreement
     { dealId, contactIds[], subject, body }
   ============================================================
   Mails the confirmation of an agreement to the sponsor's contact
   person(s) and marks the agreement as sent. Server-side because the
   Workspace App Password must never reach a browser — same reasoning as
   the CBE key and the team access mail.

   Unlike the other mail routes, the text IS taken from the request: the
   team edits the message in the preview before sending, so a route that
   rebuilt it server-side would send something other than what was
   approved on screen. The property that actually matters is kept
   regardless — only contact IDS cross the wire, and every address is
   read back from the row. So this cannot be pointed at an arbitrary
   recipient no matter what is in the body, and the message can only
   reach people who are already contacts of that agreement's sponsor.

   Recipients that cannot yet sign in are activated here rather than
   being left for the team to notice. The message's whole purpose is a
   link that says "accept this"; sending that to someone with no way in
   is a dead end, so portal access is switched on and the set-password
   link goes out alongside — the same act, and the same code, as the
   team pressing "activate" on the contact.
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

  /* Both roles may send an agreement — this is everyday sponsor work, not
     administration — but an account still waiting for approval may not. */
  const { data: caller } = await supabase.from("profiles").select("id, role, approved").eq("id", user.id).maybeSingle();
  if (!caller || !caller.approved) {
    return NextResponse.json({ error: "Your account doesn't have access yet." }, { status: 403 });
  }

  /* Read through the CALLER's session, so RLS is the permission check: a
     sponsor portal session can see its own deal but has no profiles row, and
     was already turned away above. */
  const { data: deal } = await supabase.from("deals").select("id, sponsor_id").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "No such agreement." }, { status: 404 });

  /* Scoped to the agreement's own sponsor, so a valid id belonging to some
     other company cannot be smuggled into the recipient list. */
  const { data: rows } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, language, pref_info, pref_invoice, portal_access")
    .eq("sponsor_id", deal.sponsor_id)
    .in("id", contactIds.filter(Boolean));

  const chosen = (rows || []).filter((r) => validateEmail(String(r.email || ""))?.valid);
  if (chosen.length === 0) {
    return NextResponse.json(
      { error: "None of the selected contacts has a usable email address." },
      { status: 409 },
    );
  }

  if (!mailConfigured()) {
    return NextResponse.json(
      { error: "Sending email isn't configured on the server (GOOGLE_SMTP_USER / GOOGLE_SMTP_PASSWORD)." },
      { status: 503 },
    );
  }

  /* ---------- make sure the link in the message actually works ----------
     Reported, never fatal: a contact whose address is already a portal login
     under another sponsor trips the unique index in 0001_schema.sql. That is
     worth telling the team about, but it is no reason to withhold a contract
     from the other recipients. */
  const warnings: string[] = [];
  const invited: string[] = [];
  const admin = createSupabaseAdminClient();
  for (const row of chosen) {
    if (row.portal_access) continue;
    const who = [row.first_name, row.last_name].filter(Boolean).join(" ") || String(row.email);
    const { error } = await admin.from("contacts").update({ portal_access: true }).eq("id", row.id);
    if (error) {
      warnings.push(`${who} could not be given portal access (${error.message}), so they can't accept online yet.`);
      continue;
    }
    const result = await issuePortalInvite(toInviteContact(row), request.nextUrl.origin);
    if (result.sent) invited.push(String(row.email));
    else warnings.push(`${who} was given portal access, but the password link failed: ${result.reason}`);
  }

  /* One message to all of them: the text was written and approved once, as
     one text, and the recipients are colleagues at the same company — so a
     single thread they can all reply into is what the team meant to send. */
  try {
    await sendMail({ to: chosen.map((r) => String(r.email)), subject, text });
  } catch (ex) {
    const status = ex instanceof MailNotConfiguredError ? 503 : 502;
    return NextResponse.json({ error: ex instanceof Error ? ex.message : "Could not send the email." }, { status });
  }

  /* Through the caller's session on purpose: the audit trail (0005_audit.sql)
     then records the team member who sent it, not the service role. */
  const sentAt = new Date().toISOString();
  const { error: markError } = await supabase.from("deals").update({ email_sent_at: sentAt }).eq("id", dealId);
  /* The mail is gone; failing the request now would invite a second send. */
  if (markError) warnings.push(`The email was sent, but the agreement wasn't marked as sent: ${markError.message}`);

  return NextResponse.json({
    sent: true,
    sentAt,
    to: chosen.map((r) => String(r.email)),
    invited,
    warnings,
  });
}
