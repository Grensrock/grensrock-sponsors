import { ensurePortalAuthUser, type IssueResult, type PortalContact } from "@/lib/auth/portal-account";
import { buildPortalSignInLink } from "@/lib/email-templates";
import { mailConfigured, sendMail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   Sign-in links ("magic links") for sponsor contacts — SERVER ONLY
   ============================================================
   The second way into the portal, beside email + password. A contact
   types their address, we mail them a link, following it opens the
   portal. Nothing is set, nothing is changed: a contact who signs in
   this way still has whatever password they had, or none at all.

   Why Supabase's token and not our own, when the set-password invite
   in portal-invite.ts rolls its own: a sign-in link has to END in a
   session, and only Supabase Auth can mint one. Its own one-time token
   is exactly that, redeemed in app/auth/callback. The invite's token
   buys a 14-day lifetime that Supabase's project-wide setting could not
   give it (see 0012) — a sign-in link wants the opposite, a short life,
   so it has no reason to leave Supabase's.

   We generate the token rather than letting Supabase mail it: the
   project sends no auth email of its own (supabase/config.toml has no
   [auth.email.smtp]), and a sponsor should get the same NL/FR/EN
   message from sponsors@grensrock.be as every other mail we send.
   ============================================================ */

/** Mirrors auth.email.otp_expiry in supabase/config.toml — Supabase enforces it, we only say it. */
export const MAGIC_LINK_MINUTES = 60;

/**
 * Makes sure the contact has an auth user, mints a one-time sign-in token
 * and emails the link.
 *
 * Callers must have established that this contact may be sent one — this
 * function does not check permissions.
 */
export async function issuePortalMagicLink(contact: PortalContact, origin: string): Promise<IssueResult> {
  const email = (contact.email || "").trim().toLowerCase();
  if (!email) return { sent: false, reason: "This contact has no email address." };

  if (!mailConfigured()) {
    return {
      sent: false,
      reason: "Sending email isn't configured on the server (GOOGLE_SMTP_USER / GOOGLE_SMTP_PASSWORD).",
    };
  }

  const { userId, reason } = await ensurePortalAuthUser(contact, email);
  if (!userId) return { sent: false, reason };

  const admin = createSupabaseAdminClient();

  /* generateLink mints the token WITHOUT sending anything — that is the whole
     reason it is used here instead of signInWithOtp, which would hand the mail
     to Supabase's built-in sender. */
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    return { sent: false, reason: error?.message || "Could not create a sign-in link for this contact." };
  }

  /* Our own callback rather than Supabase's action_link: action_link verifies
     at Supabase and redirects back, which leaves the session in a URL fragment
     the server never sees. Handing the token to app/auth/callback instead lets
     it be redeemed server-side, so the cookies are written before the page
     renders — the same path the Google sign-in already takes. */
  const url =
    `${origin.replace(/\/$/, "")}/auth/callback` +
    `?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`;

  const { subject, body, html } = buildPortalSignInLink(contact, url, MAGIC_LINK_MINUTES);
  try {
    await sendMail({ to: email, subject, text: body, html });
  } catch (ex) {
    return { sent: false, reason: ex instanceof Error ? ex.message : "The mail server refused the message." };
  }

  /* Logged only after the mail is away, so a send that failed doesn't count
     against the resend gap and lock the contact out of trying again. The token
     is deliberately NOT stored: Supabase holds it, and a row here would be a
     second copy of a working key into someone's account for no gain. */
  await admin.from("portal_magic_links").insert({ contact_id: contact.id, email });

  return { sent: true };
}
