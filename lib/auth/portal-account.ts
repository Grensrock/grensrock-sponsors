import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Language } from "@/types";

/* ============================================================
   The auth account behind a sponsor contact — SERVER ONLY
   ============================================================
   Both ways into the portal start here. A contact is a row in
   `contacts`; signing in needs an auth.users row bound to it, and
   neither the set-password invite nor the sign-in link can assume one
   exists yet. That provisioning is the same act in both cases, so it
   lives once, here, rather than in each of them.
   ============================================================ */

/* Deliberately not the Contact type: lib/api/contacts.ts (where rowToContact
   lives) imports the browser Supabase client, so a route handler must not pull
   it in. These five fields are all an email to a contact needs. */
export interface PortalContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  language: Language;
}

/** Maps a raw contacts row without going through the client-side API module. */
export const toPortalContact = (row: Record<string, unknown>): PortalContact => ({
  id: String(row.id),
  email: String(row.email || ""),
  firstName: String(row.first_name || ""),
  lastName: String(row.last_name || ""),
  language: (row.language || "nl") as Language,
});

/** What every "send this contact a link" route answers with. */
export interface IssueResult {
  sent: boolean;
  /** Set when nothing was sent and the caller may care why (team-facing routes only). */
  reason?: string;
}

export interface EnsureResult {
  userId?: string;
  reason?: string;
}

/**
 * Returns the auth user id for a contact, creating and binding one if this
 * is their first link.
 *
 * Callers must have established that this contact may be given access — this
 * does not check permissions.
 */
export async function ensurePortalAuthUser(contact: PortalContact, email: string): Promise<EnsureResult> {
  const admin = createSupabaseAdminClient();

  /* It may already exist — anyone who used a magic link before 0012, or who
     has a password today — so look before creating. auth_user_id is not on the
     Contact type (the client has no business with it), so it is read here
     rather than passed in. */
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
         this the contact would have to confirm by email as well as follow
         the link, for no added assurance. */
      email_confirm: true,
    });
    if (error || !created?.user) {
      return { reason: error?.message || "Could not create the login for this contact." };
    }
    userId = created.user.id;
  }

  /* Bind it, so claim_portal_contact() has nothing left to guess at. */
  await admin.from("contacts").update({ auth_user_id: userId }).eq("id", contact.id);

  return { userId };
}

/* The columns every issuer reads off `contacts`. One list, so a route that
   forgets `portal_access` can't quietly send a link to someone without it. */
export const PORTAL_CONTACT_COLUMNS =
  "id, first_name, last_name, email, phone, language, pref_info, pref_invoice, portal_access";
