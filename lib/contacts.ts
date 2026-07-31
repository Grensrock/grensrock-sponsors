import { emptyContact, uid, type CommKey } from "@/lib/constants";
import type { Contact, StoredSponsor } from "@/types";

type SponsorLike = {
  contacts?: Contact[];
  voucherContactId?: string | null;
} | null | undefined;

export const canLogIn = (c?: Contact | null) => !!c?.email && !!c.portalAccess;

export const contactName = (c?: Partial<Contact> | null) =>
  [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim();

export const sponsorContacts = (s?: SponsorLike): Contact[] => (Array.isArray(s?.contacts) ? s.contacts : []);

export const primaryContact = (s?: SponsorLike): Contact | null =>
  sponsorContacts(s).find((c) => c.email) || sponsorContacts(s)[0] || null;

/* Contacts who should receive a given kind of communication (falls back to the first contact) */
export const contactsFor = (s: SponsorLike, kind: CommKey): Contact[] => {
  const withMail = sponsorContacts(s).filter((c) => c.email);
  const picked = withMail.filter((c) => c.prefs?.[kind]);
  return picked.length ? picked : withMail.slice(0, 1);
};

/* Exactly one contact receives the vouchers for a sponsor (sponsor-level setting) */
export const voucherContact = (s?: SponsorLike): Contact | null => {
  const withMail = sponsorContacts(s).filter((c) => c.email);
  if (s?.voucherContactId) {
    const hit = withMail.find((c) => c.id === s.voucherContactId);
    if (hit) return hit;
  }
  const pc = primaryContact(s);
  return pc && pc.email ? pc : withMail[0] || null;
};

/* Old single-contact sponsors become a one-entry contact list */
export const withVoucherContact = (s: StoredSponsor): StoredSponsor => {
  if (s.voucherContactId !== undefined) {
    // still make sure no stray per-contact vouchers pref lingers
    if ((s.contacts || []).some((c) => c.prefs && "vouchers" in c.prefs)) {
      return {
        ...s,
        contacts: (s.contacts || []).map((c) => {
          if (!c.prefs || !("vouchers" in c.prefs)) return c;
          const { vouchers: _vouchers, ...rest } = c.prefs;
          return { ...c, prefs: rest };
        }),
      };
    }
    return s;
  }
  const list = sponsorContacts(s);
  const old = list.find((c) => c.email && c.prefs?.vouchers) || list.find((c) => c.email) || null;
  return {
    ...s,
    voucherContactId: old ? old.id : "",
    contacts: list.map((c) => {
      if (!c.prefs || !("vouchers" in c.prefs)) return c;
      const { vouchers: _vouchers, ...rest } = c.prefs;
      return { ...c, prefs: rest };
    }),
  };
};

export const withContacts = (s: StoredSponsor): StoredSponsor => {
  if (Array.isArray(s.contacts)) {
    /* Contacts from before portal activation existed keep their access */
    return s.contacts.every((c) => c.portalAccess !== undefined)
      ? s
      : { ...s, contacts: s.contacts.map((c) => ({ ...c, portalAccess: c.portalAccess ?? !!c.email })) };
  }
  const had = s.contactName || s.contactEmail || s.contactPhone;
  return {
    ...s,
    contacts: had
      ? [
          {
            ...emptyContact,
            id: uid(),
            lastName: s.contactName || "",
            email: s.contactEmail || "",
            phone: s.contactPhone || "",
            language: s.contactLanguage || "nl",
            prefs: { info: true, invoice: true },
            portalAccess: !!s.contactEmail,
          },
        ]
      : [],
  };
};
