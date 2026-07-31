/* Contact persons of a sponsor (embedded in the sponsor record). */

export type Language = "nl" | "fr" | "en";
export type TeamLanguage = "nl" | "en";

/* Which kinds of communication a contact wants to receive.
   `vouchers` is a legacy pref that older saved data may still carry; it is
   stripped by the migration in lib/migrate.ts. */
export interface ContactPrefs {
  info: boolean;
  invoice: boolean;
  vouchers?: boolean;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: Language;
  prefs: ContactPrefs;
  portalAccess: boolean;
}
