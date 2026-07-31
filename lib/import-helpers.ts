import { normStr } from "@/lib/normalize";

/* ---------- Sponsor import (xlsx / csv) ---------- */

export type ImportField =
  | "companyName"
  | "street"
  | "houseNumber"
  | "postalCode"
  | "city"
  | "vatNumber"
  | "entityType"
  | "contactFirstName"
  | "contactLastName"
  | "contactPhone"
  | "contactEmail"
  | "contactLanguage";

export const IMPORT_FIELDS: Array<[ImportField, string]> = [
  ["companyName", "Company / name *"],
  ["street", "Street"],
  ["houseNumber", "House number"],
  ["postalCode", "Postal code"],
  ["city", "City"],
  ["vatNumber", "VAT number"],
  ["entityType", "Type (legal/person)"],
  ["contactFirstName", "Contact first name"],
  ["contactLastName", "Contact last name"],
  ["contactPhone", "Contact phone"],
  ["contactEmail", "Contact email"],
  ["contactLanguage", "Language (NL/FR/EN)"],
];

export const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  contactFirstName: ["voornaam", "first name", "prénom", "prenom", "firstname"],
  contactLastName: [
    "achternaam",
    "contactpersoon",
    "contact person",
    "contact name",
    "contactnaam",
    "personne de contact",
    "last name",
    "familienaam",
    "naam contact",
    "contact",
  ],
  contactPhone: ["phone", "telefoon", "tel", "gsm", "mobile", "téléphone", "telephone"],
  contactEmail: ["e-mail", "email", "mail", "e-mailadres", "courriel"],
  contactLanguage: ["taal", "language", "langue", "lang"],
  vatNumber: ["btw", "vat", "tva", "ondernemingsnummer", "btw-nummer", "vat number"],
  companyName: [
    "bedrijfsnaam",
    "company name",
    "company",
    "bedrijf",
    "firma",
    "sponsor",
    "organisatie",
    "société",
    "naam",
    "name",
  ],
  street: ["straat", "street", "rue", "adres", "address", "adresse"],
  houseNumber: ["huisnummer", "nummer", "number", "nr", "numéro", "numero"],
  postalCode: ["postcode", "postal", "zip", "code postal"],
  city: ["gemeente", "stad", "city", "plaats", "commune", "ville"],
  entityType: ["rechtsvorm", "entity", "type"],
};

export type ColumnMap<K extends string> = Partial<Record<K, number>>;

export function autoMap(headers: string[]): ColumnMap<ImportField> {
  const map: ColumnMap<ImportField> = {};
  const used = new Set<number>();
  // contact* fields first so "contact naam" doesn't get claimed by companyName's "naam"
  const order: ImportField[] = [
    "contactFirstName",
    "contactLastName",
    "contactPhone",
    "contactEmail",
    "contactLanguage",
    "vatNumber",
    "postalCode",
    "houseNumber",
    "street",
    "city",
    "entityType",
    "companyName",
  ];
  for (const field of order) {
    const syns = HEADER_SYNONYMS[field];
    let hit = -1;
    for (const syn of syns) {
      hit = headers.findIndex((h, i) => !used.has(i) && normStr(h).toLowerCase().includes(syn));
      if (hit >= 0) break;
    }
    map[field] = hit;
    if (hit >= 0) used.add(hit);
  }
  return map;
}

/* ---------- Contact import (xlsx / csv) ---------- */

export type ContactField =
  | "company"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "language"
  | "info"
  | "invoice";

export const CONTACT_FIELDS: Array<[ContactField, string]> = [
  ["company", "Sponsor / company *"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["language", "Language"],
  ["info", "Wants information (yes/no)"],
  ["invoice", "Wants invoicing (yes/no)"],
];

export const CONTACT_SYNONYMS: Record<ContactField, string[]> = {
  company: ["bedrijfsnaam", "company", "sponsor", "bedrijf", "firma", "organisatie", "société", "societe"],
  firstName: ["voornaam", "first name", "prénom", "prenom", "firstname"],
  lastName: ["achternaam", "last name", "familienaam", "naam", "nom", "contactpersoon", "contact"],
  email: ["e-mail", "email", "mail", "e-mailadres", "courriel"],
  phone: ["telefoon", "phone", "tel", "gsm", "mobile", "téléphone"],
  language: ["taal", "language", "langue", "lang"],
  info: ["informatie", "information", "info", "algemeen"],
  invoice: ["facturatie", "factuur", "invoicing", "invoice", "facturation"],
};

export const isYes = (v: unknown) => /^(ja|yes|oui|x|1|true|waar|y)$/i.test(normStr(v));

export function autoMapContacts(headers: string[]): ColumnMap<ContactField> {
  const map: ColumnMap<ContactField> = {};
  const used = new Set<number>();
  const order: ContactField[] = [
    "company",
    "firstName",
    "email",
    "phone",
    "language",
    "info",
    "invoice",
    "lastName",
  ];
  for (const field of order) {
    let hit = -1;
    for (const syn of CONTACT_SYNONYMS[field]) {
      hit = headers.findIndex((h, i) => !used.has(i) && normStr(h).toLowerCase().includes(syn));
      if (hit >= 0) break;
    }
    map[field] = hit;
    if (hit >= 0) used.add(hit);
  }
  return map;
}
