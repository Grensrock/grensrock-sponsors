import type { Contact, Language } from "./contact";

export type EntityType = "legal" | "person";

export interface Sponsor {
  id: string;
  companyName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  vatNumber: string;
  /** Ticked on purpose: this sponsor has no VAT number, so a blank one is fine. */
  noVatNumber: boolean;
  entityType: EntityType;
  contacts: Contact[];
  /** The single contact who receives the vouchers ("" = automatic). */
  voucherContactId: string | null;
  /** Team member responsible for this sponsor ("" = not assigned). */
  responsibleId: string | null;
  refRequired: boolean;
  /** Legacy free-text responsible, kept as a fallback for old data. */
  responsible?: string;
  /** Legacy single inline contact, still shown by the sponsor picker if present. */
  contactName?: string;
}

/* Shape of a sponsor as it may come out of storage: older records kept a single
   free-text address and one inline contact. The migration helpers accept this
   looser shape and return a proper Sponsor. */
export type StoredSponsor = Partial<Sponsor> & {
  id: string;
  companyName: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLanguage?: Language;
};
