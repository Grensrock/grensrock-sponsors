import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { ensurePortalAuthUser, type IssueResult, type PortalContact } from "@/lib/auth/portal-account";
import { buildPortalPasswordLink } from "@/lib/email-templates";
import { mailConfigured, sendMail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   Set-password invites for sponsor contacts — SERVER ONLY
   ============================================================
   Shared by the routes that issue a link: the team activating a
   contact, and a contact asking for a new one from the login form. Both
   end in exactly the same email, which is the point — "forgot my
   password" is the same operation as "here is your access", so it is
   the same code rather than a second flow to keep in step.

   A sign-in link (lib/auth/portal-magic-link.ts) is the other way in,
   and a different thing: it opens the portal once and changes nothing.
   This one hands over a password, so it is our own token with its own
   long lifetime.

   The token is returned to the caller once, to put in the email, and
   only its SHA-256 is written down.
   ============================================================ */

/** 14 days, as specified. Long because sponsors read their mail on their own schedule. */
export const INVITE_DAYS = 14;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Constant-time compare, so a stored hash can't be recovered by timing lookups. */
export function hashesMatch(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const tokenHash = hash;

/**
 * Makes sure the contact has an auth user, invalidates any link sent
 * earlier, stores a fresh one and emails it.
 *
 * Callers must have established that this contact may be invited — this
 * function does not check permissions.
 */
export async function issuePortalInvite(contact: PortalContact, origin: string): Promise<IssueResult> {
  const email = (contact.email || "").trim().toLowerCase();
  if (!email) return { sent: false, reason: "This contact has no email address." };

  /* Checked before anything is written. Without this a missing SMTP key
     surfaced as an unhandled throw out of the route — a 500 with no body,
     which reads like the app is broken rather than like a setting is
     missing, and left an invite row behind for a mail that never went. */
  if (!mailConfigured()) {
    return {
      sent: false,
      reason: "Sending email isn't configured on the server (GOOGLE_SMTP_USER / GOOGLE_SMTP_PASSWORD).",
    };
  }

  const { userId, reason } = await ensurePortalAuthUser(contact, email);
  if (!userId) return { sent: false, reason };

  const admin = createSupabaseAdminClient();

  /* Earlier links stop working. Issuing a new one is either an activation
     or a "I can't get in" — in both cases the old link should not still
     open the account. */
  await admin
    .from("portal_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("contact_id", contact.id)
    .is("used_at", null);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  const { error: insertError } = await admin.from("portal_invites").insert({
    contact_id: contact.id,
    email,
    token_hash: hash(token),
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) return { sent: false, reason: insertError.message };

  const url = `${origin.replace(/\/$/, "")}/set-password?token=${encodeURIComponent(token)}`;
  const { subject, body } = buildPortalPasswordLink(contact, url, expiresAt);
  try {
    await sendMail({ to: email, subject, text: body });
  } catch (ex) {
    /* Reported rather than thrown: the caller can then say which contact and
       why, instead of the route collapsing into a bodyless 500. */
    return { sent: false, reason: ex instanceof Error ? ex.message : "The mail server refused the message." };
  }

  return { sent: true };
}
