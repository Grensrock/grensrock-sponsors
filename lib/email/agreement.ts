import type { SupabaseClient } from "@supabase/supabase-js";
import { createAcceptLink } from "@/lib/auth/portal-accept-link";
import { PORTAL_CONTACT_COLUMNS, toPortalContact } from "@/lib/auth/portal-account";
import { ACCEPT_PATH } from "@/lib/constants";
import { MailNotConfiguredError, mailConfigured, sendMail } from "@/lib/email/send";
import { renderAgreementHtml } from "@/lib/email-templates";
import { sameEmail, validateEmail } from "@/lib/email-validate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Language } from "@/types";

/* ============================================================
   Delivering an agreement mail — SERVER ONLY
   ============================================================
   An agreement mail leaves in one of two ways: straight from the preview
   (app/api/deals/send-agreement), or — when its benefits waited for an
   admin — held on the agreement and sent once they approve them
   (app/api/deals/approve-benefits). Both end here, so the sponsor gets
   the same mail either way.

   The text is the team's, as approved on screen. The property that
   actually matters is kept regardless: only contact IDS come in, and every
   address is read back from the row, scoped to the agreement's own
   sponsor. So this cannot be pointed at an arbitrary recipient no matter
   what is in the body, and the message can only reach people who are
   already contacts of that sponsor.

   The link in the message signs the reader in by itself
   (lib/auth/portal-accept-link.ts), so it is personal: each recipient
   gets their own copy of the text, with their own link where the preview
   showed the bare one. Recipients that had no portal access are given it
   here — the link is the way in, so no separate set-password mail is
   needed to make it work.

   The sponsor's responsible is in Cc on each contact's mail, so they see
   exactly what the sponsor got and a reply-all reaches them. There is no
   separate copy for them. That does mean they receive each contact's
   personal link, which signs in AS that contact: an accepted trade-off,
   since the responsible is the team member who handles this sponsor.
   ============================================================ */

export interface AgreementMail {
  contactIds: string[];
  subject: string;
  body: string;
  language: Language;
}

export type Delivery =
  | { ok: true; sentAt: string; to: string[]; cc: string | null; warnings: string[] }
  | { ok: false; status: number; error: string };

/** The chosen contacts of this sponsor that have an address to send to. Read
    through the caller's session, so RLS has its say as well. */
export async function mailableContacts(supabase: SupabaseClient, sponsorId: string, contactIds: string[]) {
  const ids = contactIds.filter(Boolean);
  if (ids.length === 0) return [];
  const { data: rows } = await supabase
    .from("contacts")
    .select(PORTAL_CONTACT_COLUMNS)
    .eq("sponsor_id", sponsorId)
    .in("id", ids);
  return (rows || []).filter((r) => validateEmail(String(r.email || ""))?.valid);
}

/**
 * Sends the mail and marks the agreement sent. `supabase` is the caller's own
 * session: the audit trail (0005_audit.sql) then records the team member who
 * sent it, not the service role.
 */
export async function deliverAgreement(
  supabase: SupabaseClient,
  deal: { id: string; sponsor_id: string },
  mail: AgreementMail,
  origin: string,
): Promise<Delivery> {
  const { subject, body: text, language } = mail;
  const chosen = await mailableContacts(supabase, deal.sponsor_id, mail.contactIds);
  if (chosen.length === 0) {
    return { ok: false, status: 409, error: "None of the selected contacts has a usable email address." };
  }

  if (!mailConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "Sending email isn't configured on the server (GOOGLE_SMTP_USER / GOOGLE_SMTP_PASSWORD).",
    };
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
  const bareLink = `${origin}${ACCEPT_PATH}`;
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
    let personalLink: string | undefined;

    if (hasLink) {
      if (!row.portal_access) {
        const { error } = await admin.from("contacts").update({ portal_access: true }).eq("id", row.id);
        if (error) {
          warnings.push(`${who} could not be given portal access (${error.message}), so the mail to them wasn't sent.`);
          continue;
        }
      }
      const link = await createAcceptLink(toPortalContact(row), deal.id, origin);
      if (!link.url) {
        warnings.push(`No personal link could be made for ${who} (${link.reason}), so the mail to them wasn't sent.`);
        continue;
      }
      personalLink = link.url;
      personal = text.split(bareLink).join(link.url);
    }

    try {
      await sendMail({
        to: String(row.email),
        ...(cc && { cc }),
        subject,
        text: personal,
        html: renderAgreementHtml(personal, subject, language, personalLink),
      });
      sentTo.push(String(row.email));
    } catch (ex) {
      if (ex instanceof MailNotConfiguredError) return { ok: false, status: 503, error: ex.message };
      warnings.push(`The mail to ${who} could not be sent: ${ex instanceof Error ? ex.message : "unknown error"}`);
    }
  }

  if (sentTo.length === 0) {
    return { ok: false, status: 502, error: warnings.join("\n") || "Could not send the email." };
  }

  const sentAt = new Date().toISOString();
  const { error: markError } = await supabase.from("deals").update({ email_sent_at: sentAt }).eq("id", deal.id);
  /* The mail is gone; failing the request now would invite a second send. */
  if (markError) warnings.push(`The email was sent, but the agreement wasn't marked as sent: ${markError.message}`);

  return { ok: true, sentAt, to: sentTo, cc: cc || null, warnings };
}
