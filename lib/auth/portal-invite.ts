import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { buildPortalPasswordLink } from "@/lib/email-templates";
import { mailConfigured, sendMail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Language } from "@/types";

/* ============================================================
   Set-password invites for sponsor contacts — SERVER ONLY
   ============================================================
   Shared by the two routes that issue a link: the team activating a
   contact, and a contact asking for a new one from the login form. Both
   end in exactly the same email, which is the point — "forgot my
   password" is the same operation as "here is your access", so it is
   the same code rather than a second flow to keep in step.

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

/* Deliberately not the Contact type: lib/api/contacts.ts (where rowToContact
   lives) imports the browser Supabase client, so a route handler must not pull
   it in. These five fields are all an invite needs. */
export interface InviteContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  language: Language;
}

/** Maps a raw contacts row without going through the client-side API module. */
export const toInviteContact = (row: Record<string, unknown>): InviteContact => ({
  id: String(row.id),
  email: String(row.email || ""),
  firstName: String(row.first_name || ""),
  lastName: String(row.last_name || ""),
  language: (row.language || "nl") as Language,
});

export interface IssueResult {
  sent: boolean;
  /** Set when nothing was sent and the caller may care why (team-facing routes only). */
  reason?: string;
}

/**
 * Makes sure the contact has an auth user, invalidates any link sent
 * earlier, stores a fresh one and emails it.
 *
 * Callers must have established that this contact may be invited — this
 * function does not check permissions.
 */
export async function issuePortalInvite(contact: InviteContact, origin: string): Promise<IssueResult> {
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

  const admin = createSupabaseAdminClient();

  /* 1. The auth user. It may already exist — anyone who used a magic link
        before this change has one — so look before creating. auth_user_id is
        not on the Contact type (the client has no business with it), so it is
        read here rather than passed in. */
  const { data: row } = await admin.from("contacts").select("auth_user_id").eq("id", contact.id).maybeSingle();
  let userId = (row?.auth_user_id as string | null) || null;
  if (!userId) {
    const { data: found } = await admin.rpc("auth_user_id_for_email", { p_email: email });
    userId = (found as string | null) || null;
  }
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      /* Confirmed on creation: the address is one the team entered and the
         link we are about to send is itself the proof of control. Without
         this the contact would have to confirm by email as well as set a
         password, for no added assurance. */
      email_confirm: true,
    });
    if (error || !created?.user) {
      return { sent: false, reason: error?.message || "Could not create the login for this contact." };
    }
    userId = created.user.id;
  }

  /* Bind it, so claim_portal_contact() has nothing left to guess at. */
  await admin.from("contacts").update({ auth_user_id: userId }).eq("id", contact.id);

  /* 2. Earlier links stop working. Issuing a new one is either an activation
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
