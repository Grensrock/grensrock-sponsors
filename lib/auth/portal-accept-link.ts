import { randomBytes } from "crypto";
import { ensurePortalAuthUser, type PortalContact } from "@/lib/auth/portal-account";
import { tokenHash } from "@/lib/auth/portal-invite";
import { ACCEPT_PATH } from "@/lib/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ============================================================
   The personal link in an agreement mail — SERVER ONLY
   ============================================================
   Following it signs the contact into the portal, where the agreement
   is waiting to be accepted. No sign-in form in between: the mail went
   to their address, and that is the same proof a sign-in link rests on.

   Our own token rather than Supabase's, for the lifetime (see
   0018_portal_accept_links.sql); app/auth/accept trades it for a real
   session when it is followed.
   ============================================================ */

/** As long as the set-password invite: sponsors read their mail on their own schedule. */
export const ACCEPT_LINK_DAYS = 14;

export interface AcceptLinkResult {
  url?: string;
  reason?: string;
}

/**
 * Makes sure the contact has an auth user and returns a fresh personal link
 * for this agreement.
 *
 * Callers must have established that this contact may sign in to the portal
 * (portal access on) — this function does not check permissions.
 */
export async function createAcceptLink(
  contact: PortalContact,
  dealId: string,
  origin: string,
): Promise<AcceptLinkResult> {
  const email = (contact.email || "").trim().toLowerCase();
  if (!email) return { reason: "This contact has no email address." };

  const { userId, reason } = await ensurePortalAuthUser(contact, email);
  if (!userId) return { reason };

  const token = randomBytes(32).toString("base64url");
  const { error } = await createSupabaseAdminClient()
    .from("portal_accept_links")
    .insert({
      contact_id: contact.id,
      deal_id: dealId,
      email,
      token_hash: tokenHash(token),
      expires_at: new Date(Date.now() + ACCEPT_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
  if (error) return { reason: error.message };

  return { url: `${origin.replace(/\/$/, "")}${ACCEPT_PATH}?token=${encodeURIComponent(token)}` };
}
