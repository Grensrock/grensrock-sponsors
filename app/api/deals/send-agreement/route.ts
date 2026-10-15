import { NextResponse, type NextRequest } from "next/server";
import { createAcceptLink } from "@/lib/auth/portal-accept-link";
import { PORTAL_CONTACT_COLUMNS, toPortalContact } from "@/lib/auth/portal-account";
import { ACCEPT_PATH } from "@/lib/constants";
import { MailNotConfiguredError, mailConfigured, sendMail } from "@/lib/email/send";
import { sameEmail, validateEmail } from "@/lib/email-validate";
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

   The link in the message signs the reader in by itself
   (lib/auth/portal-accept-link.ts), so it is personal: each recipient
   gets their own copy of the approved text, with their own link where
   the preview showed the bare one. Recipients that had no portal access
   are given it here — the link is the way in, so no separate
   set-password mail is needed to make it work.

   The sponsor's responsible is in Cc, so a reply-all from the sponsor
   reaches them too. Only in the headers, though: a contact's copy is
   delivered to that contact alone, since its link signs in AS them.
   The responsible gets one copy of their own, with the app's address
   where the link was.
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

  /* Both roles may send an agreement (this is everyday sponsor work, not
     administration), but an account still waiting for approval may not, and
     a user only for a sponsor they are responsible for (checked below). */
  const { data: caller } = await supabase.from("profiles").select("id, role, approved").eq("id", user.id).maybeSingle();
  if (!caller || !caller.approved) {
    return NextResponse.json({ error: "Your account doesn't have access yet." }, { status: 403 });
  }

  /* Read through the CALLER's session, so RLS is the permission check: a
     sponsor portal session can see its own deal but has no profiles row, and
     was already turned away above. */
  const { data: deal } = await supabase.from("deals").select("id, sponsor_id").eq("id", dealId).maybeSingle();
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

  /* Scoped to the agreement's own sponsor, so a valid id belonging to some
     other company cannot be smuggled into the recipient list. */
  const { data: rows } = await supabase
    .from("contacts")
    .select(PORTAL_CONTACT_COLUMNS)
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

  /* ---------- one personal mail per recipient ----------
     Per-recipient problems are reported, never fatal: a contact whose address
     is already a portal login under another sponsor trips the unique index in
     0001_schema.sql. That is worth telling the team about, but no reason to
     withhold the contract from the other recipients. */
  const warnings: string[] = [];
  const sentTo: string[] = [];
  const admin = createSupabaseAdminClient();
  /* The preview was built on this same origin, so this is exactly the text the
     link appears as in the approved body. */
  const bareLink = `${request.nextUrl.origin}${ACCEPT_PATH}`;
  const hasLink = text.includes(bareLink);

  /* No responsible, or one without a usable address: no Cc, and nothing to
     warn about — the sponsor still gets their mail. Nor when they are also
     one of the contacts, who already get it in To. */
  const { data: sponsorRow } = await admin
    .from("sponsors")
    .select("responsible_id")
    .eq("id", deal.sponsor_id)
    .maybeSingle();
  const { data: responsible } = sponsorRow?.responsible_id
    ? await admin.from("profiles").select("email").eq("id", sponsorRow.responsible_id).maybeSingle()
    : { data: null };
  const responsibleEmail = String(responsible?.email || "").trim();
  const cc =
    validateEmail(responsibleEmail)?.valid && !chosen.some((r) => sameEmail(String(r.email || ""), responsibleEmail))
      ? responsibleEmail
      : "";

  for (const row of chosen) {
    const who = [row.first_name, row.last_name].filter(Boolean).join(" ") || String(row.email);
    let personal = text;

    if (hasLink) {
      if (!row.portal_access) {
        const { error } = await admin.from("contacts").update({ portal_access: true }).eq("id", row.id);
        if (error) {
          warnings.push(`${who} could not be given portal access (${error.message}), so the mail to them wasn't sent.`);
          continue;
        }
      }
      const link = await createAcceptLink(toPortalContact(row), dealId, request.nextUrl.origin);
      if (!link.url) {
        warnings.push(`No personal link could be made for ${who} (${link.reason}), so the mail to them wasn't sent.`);
        continue;
      }
      personal = text.split(bareLink).join(link.url);
    }

    try {
      await sendMail({
        to: String(row.email),
        ...(cc && { cc, deliverTo: String(row.email) }),
        subject,
        text: personal,
      });
      sentTo.push(String(row.email));
    } catch (ex) {
      if (ex instanceof MailNotConfiguredError) {
        return NextResponse.json({ error: ex.message }, { status: 503 });
      }
      warnings.push(`The mail to ${who} could not be sent: ${ex instanceof Error ? ex.message : "unknown error"}`);
    }
  }

  if (sentTo.length === 0) {
    return NextResponse.json({ error: warnings.join("\n") || "Could not send the email." }, { status: 502 });
  }

  /* The responsible's copy: addressed like the ones that went out, so it reads
     as the same conversation, but with the app where the personal link was. */
  let ccSent: string | null = null;
  if (cc) {
    try {
      await sendMail({
        to: sentTo,
        cc,
        deliverTo: cc,
        subject,
        text: hasLink ? text.split(bareLink).join(request.nextUrl.origin) : text,
      });
      ccSent = cc;
    } catch (ex) {
      warnings.push(`The copy for ${cc} (cc) could not be sent: ${ex instanceof Error ? ex.message : "unknown error"}`);
    }
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
    to: sentTo,
    cc: ccSent,
    warnings,
  });
}
