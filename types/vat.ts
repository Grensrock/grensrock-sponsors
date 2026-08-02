import type { EntityType } from "./sponsor";

/* ============================================================
   VAT registry lookup (CBE / KBO / BCE)
   ============================================================
   The shape /api/vat/{vat} hands back to the browser. It is a
   normalised subset of the cbeapi.be CompanyResource — deliberately
   only the fields a sponsor record actually needs, so the raw
   registry payload (establishments, NACE codes, contact details)
   never travels to the client.
   ============================================================ */

export interface VatCompany {
  /** Formatted VAT number, e.g. "BE 0403.227.515". */
  vatNumber: string;
  /** Bare enterprise number, e.g. "0403227515". */
  enterpriseNumber: string;
  /** Name including the legal form, e.g. "KBC Groep NV" — what belongs on an invoice. */
  name: string;
  /** Name without the legal form, e.g. "KBC Groep". */
  shortName: string;
  /** Abbreviated legal form, e.g. "NV". */
  legalForm: string;
  entityType: EntityType;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  /** ISO country code of the registered seat, e.g. "BE". */
  country: string;
  /** False when the registry says the entity is stopped or struck off. */
  active: boolean;
  /** Juridical situation in the requested language, e.g. "Normale toestand". */
  situation: string;
  /** Date the served registry snapshot reflects (YYYY-MM-DD), when known. */
  dataAsOf: string;
}

export type VatLookupStatus =
  | "found"
  /** Well-formed Belgian number, but no such enterprise in the registry. */
  | "not_found"
  /** Valid VAT number outside Belgium — the CBE registry only covers BE. */
  | "unsupported_country"
  /** The number itself doesn't pass the local format/check-digit test. */
  | "invalid"
  /** Lookup is switched off, or the server has no API key configured. */
  | "unavailable"
  /** The registry could not be reached. */
  | "error";

export type VatLookupResult =
  | { status: "found"; company: VatCompany }
  | { status: "not_found" }
  | { status: "unsupported_country"; country: string }
  | { status: "invalid"; code: string }
  | { status: "unavailable" }
  | { status: "error"; message: string };
