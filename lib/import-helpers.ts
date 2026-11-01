import { FOLDER_OPTS, LED_ZONES, POSTER_OPTS, WEBSITE_OPTS, type LabelMap } from "@/lib/constants";
import { normNameKey, normStr } from "@/lib/normalize";
import { userName } from "@/lib/users";
import type { Deal, Edition, LedZone, User } from "@/types";

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
  | "contactLanguage"
  | "responsible";

/* Each field with the TEAM_TEXT key of its label in the column mapping. */
export const IMPORT_FIELDS: Array<[ImportField, string]> = [
  ["companyName", "imf.companyName"],
  ["street", "imf.street"],
  ["houseNumber", "imf.houseNumber"],
  ["postalCode", "imf.postalCode"],
  ["city", "imf.city"],
  ["vatNumber", "imf.vatNumber"],
  ["entityType", "imf.entityType"],
  ["contactFirstName", "imf.contactFirstName"],
  ["contactLastName", "imf.contactLastName"],
  ["contactPhone", "imf.contactPhone"],
  ["contactEmail", "imf.contactEmail"],
  ["contactLanguage", "imf.contactLanguage"],
  ["responsible", "imf.responsible"],
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
  responsible: [
    "verantwoordelijke",
    "responsible",
    "responsable",
    "account manager",
    "accountmanager",
    "toegewezen",
    "assigned",
  ],
};

export type ColumnMap<K extends string> = Partial<Record<K, number>>;

/* Walks the fields in `order`, giving each the first header that contains one
   of its synonyms and that no earlier field took. The order matters: a
   generic word ("naam", "sponsor") must come after the fields whose headers
   also contain it. */
function mapBySynonyms<K extends string>(
  headers: string[],
  order: K[],
  synonyms: Record<K, string[]>,
): ColumnMap<K> {
  const map: ColumnMap<K> = {};
  const used = new Set<number>();
  for (const field of order) {
    let hit = -1;
    for (const syn of synonyms[field]) {
      hit = headers.findIndex((h, i) => !used.has(i) && normStr(h).toLowerCase().includes(syn));
      if (hit >= 0) break;
    }
    map[field] = hit;
    if (hit >= 0) used.add(hit);
  }
  return map;
}

export function autoMap(headers: string[]): ColumnMap<ImportField> {
  // contact* fields first so "contact naam" doesn't get claimed by companyName's "naam";
  // responsible before those, or "Contactverantwoordelijke" would go to contactLastName's "contact"
  return mapBySynonyms(
    headers,
    [
      "responsible",
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
    ],
    HEADER_SYNONYMS,
  );
}

/** Lower case, accents off and spaces collapsed, so "Jérôme" in a cell finds "jerome". */
const personKey = (v: unknown) =>
  normNameKey(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * The team member a cell names: by e-mail address or full name, else by a
 * first name only one account carries. Null when it is none of those, or
 * when that first name is shared.
 */
export function matchUser(cell: unknown, users: User[]): User | null {
  const key = personKey(cell);
  if (!key) return null;
  const exact = users.find((u) => personKey(u.email) === key || personKey(userName(u)) === key);
  if (exact) return exact;
  const byFirst = users.filter((u) => personKey(u.firstName) === key);
  return byFirst.length === 1 ? byFirst[0] : null;
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

/* Each field with the TEAM_TEXT key of its label, as for IMPORT_FIELDS. */
export const CONTACT_FIELDS: Array<[ContactField, string]> = [
  ["company", "imf.company"],
  ["firstName", "imf.firstName"],
  ["lastName", "imf.lastName"],
  ["email", "imf.email"],
  ["phone", "imf.phone"],
  ["language", "imf.language"],
  ["info", "imf.info"],
  ["invoice", "imf.invoice"],
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
  return mapBySynonyms(
    headers,
    ["company", "firstName", "email", "phone", "language", "info", "invoice", "lastName"],
    CONTACT_SYNONYMS,
  );
}

/* ---------- Agreement import (xlsx / csv) ---------- */

/* The benefits an agreement carries, named as on Deal so a cell's value goes
   straight onto it. A filled cell replaces the formula's; an empty one keeps it. */
export type BenefitField =
  | "vipFriday"
  | "vipSaturday"
  | "vipGuests"
  | "drinkValue"
  | "foodDrinkValue"
  | "folderMention"
  | "posterMention"
  | "websiteMention"
  | "fenceCovers"
  | "ledboarding";

export type AgreementField = "sponsor" | "vatNumber" | "edition" | "formula" | "amount" | "notes" | BenefitField;

/* In the order the agreement form lists them. */
export const BENEFIT_FIELDS: Array<[BenefitField, string]> = [
  ["vipFriday", "bf.vipfri"],
  ["vipSaturday", "bf.vipsat"],
  ["vipGuests", "bf.vipguest"],
  ["drinkValue", "aif.drink"],
  ["foodDrinkValue", "aif.food"],
  ["folderMention", "bf.folder"],
  ["posterMention", "bf.poster"],
  ["websiteMention", "bf.website"],
  ["fenceCovers", "bf.fence"],
  ["ledboarding", "aif.led"],
];

/* Each field with the TEAM_TEXT key of its label, as for IMPORT_FIELDS. */
export const AGREEMENT_FIELDS: Array<[AgreementField, string]> = [
  ["sponsor", "imf.company"],
  ["vatNumber", "imf.vatNumber"],
  ["edition", "aif.edition"],
  ["formula", "aif.formula"],
  ["amount", "aif.amount"],
  ["notes", "aif.notes"],
  ...BENEFIT_FIELDS,
];

export const AGREEMENT_SYNONYMS: Record<AgreementField, string[]> = {
  sponsor: ["sponsor", "bedrijfsnaam", "bedrijf", "company", "firma", "organisatie", "société", "societe", "naam", "name"],
  vatNumber: ["btw", "vat", "tva", "ondernemingsnummer"],
  edition: ["editie", "edition", "édition", "jaar", "year", "année"],
  formula: ["formule", "formula", "pakket", "package", "forfait"],
  amount: ["bedrag", "amount", "prijs", "price", "montant", "kostprijs", "cost"],
  notes: ["opmerking", "notitie", "notes", "note", "remarque", "commentaar", "comment"],
  vipFriday: ["vrijdag", "friday", "vendredi"],
  vipSaturday: ["zaterdag", "saturday", "samedi"],
  vipGuests: ["gasten", "genodigde", "gast", "guest", "invité", "invite"],
  drinkValue: ["drank", "drink", "boisson"],
  foodDrinkValue: ["eten", "food", "f&d", "nourriture", "repas", "catering"],
  folderMention: ["folder", "brochure", "dépliant", "depliant"],
  posterMention: ["affiche", "poster"],
  websiteMention: ["website", "site", "web"],
  fenceCovers: ["banner", "spandoek", "doek", "nadar", "heras", "bâche", "bache"],
  ledboarding: ["led"],
};

export function autoMapAgreements(headers: string[]): ColumnMap<AgreementField> {
  // sponsor last: "Sponsorformule" or "Bedrag sponsoring" belong to the others;
  // the benefits before the amount, so "Drank (bedrag)" stays a benefit, and
  // food before drink, or "Eten & drinken" would go to the drink vouchers
  return mapBySynonyms(
    headers,
    [
      "vatNumber",
      "edition",
      "formula",
      "vipFriday",
      "vipSaturday",
      "vipGuests",
      "foodDrinkValue",
      "drinkValue",
      "folderMention",
      "posterMention",
      "websiteMention",
      "fenceCovers",
      "ledboarding",
      "amount",
      "notes",
      "sponsor",
    ],
    AGREEMENT_SYNONYMS,
  );
}

/* ---------- reading a benefit cell ----------
   The option labels in every language are accepted, and the stored keys, and
   a few words people type instead. Case, accents and spacing don't matter. */

/* "Geen", "nee", "0", "-": nothing of that benefit, as opposed to an empty cell. */
const NONE = ["geen", "nee", "neen", "none", "no", "non", "aucun", "aucune", "-", "0"];
const ALL_ZONES = ["alle", "alles", "all", "tous", "toutes"];

function optionLookup<K extends string>(opts: LabelMap<K>, extra: Partial<Record<K, string[]>>): Map<string, K> {
  const out = new Map<string, K>();
  for (const key of Object.keys(opts) as K[]) {
    [key, ...Object.values<string>(opts[key]), ...(extra[key] || [])].forEach((word) => out.set(personKey(word), key));
  }
  return out;
}

const MENTION_WORDS = { none: NONE, name: ["naam", "nom", "tekst", "text"], logo: ["met logo", "avec logo"] };
const OPTIONS = {
  folderMention: optionLookup(FOLDER_OPTS, {
    none: NONE,
    // the fractions as Excel hands back a number typed as one
    full: ["volledig", "hele pagina", "1/1", "1"],
    half: ["halve", "1/2", "demi", "0.5", "0,5"],
    quarter: ["kwart", "kwart pagina", "1/4", "quart", "0.25", "0,25"],
    eighth: ["achtste", "1/8", "huitieme", "0.125", "0,125"],
  }),
  posterMention: optionLookup(POSTER_OPTS, MENTION_WORDS),
  websiteMention: optionLookup(WEBSITE_OPTS, MENTION_WORDS),
};
const ZONES = optionLookup(LED_ZONES, { foodvillage: ["food", "village", "food-village"], stage: ["hoofdpodium", "main stage"] });

/**
 * One benefit from a spreadsheet cell, as the fields to set on the agreement.
 * Null for an empty cell, which leaves the formula's; undefined for one that
 * can't be read, so the row is skipped rather than imported wrong.
 */
export function parseBenefit(field: BenefitField, cell: unknown): Partial<Deal> | null | undefined {
  const key = personKey(typeof cell === "number" ? String(cell) : cell);
  if (!key) return null;
  switch (field) {
    case "folderMention":
    case "posterMention":
    case "websiteMention": {
      const value = OPTIONS[field].get(key);
      return value ? { [field]: value } : undefined;
    }
    case "ledboarding": {
      if (NONE.includes(key)) return { ledboarding: [] };
      if (ALL_ZONES.includes(key)) return { ledboarding: Object.keys(LED_ZONES) as LedZone[] };
      /* "VIP, Podium", "VIP + Food village", "vip en podium" */
      const parts = key.split(/\s*(?:[,;+/&]|\s(?:en|and|et)\s)\s*/).filter(Boolean);
      const zones = parts.map((p) => ZONES.get(p));
      if (!zones.length || zones.some((z) => !z)) return undefined;
      return { ledboarding: [...new Set(zones as LedZone[])] };
    }
    default: {
      const n = NONE.includes(key) ? 0 : parseAmount(cell);
      if (n === null || !(n >= 0)) return undefined;
      /* Tickets and banners come whole; the vouchers are an amount in euro. */
      const whole = field !== "drinkValue" && field !== "foodDrinkValue";
      return whole && !Number.isInteger(n) ? undefined : { [field]: n };
    }
  }
}

/** What a formula cell can say instead of a formula's name. */
export const isCustomFormula = (v: unknown) =>
  /^(op maat|maatwerk|custom|sur mesure)$/i.test(normStr(v));

/**
 * The edition a cell names: its exact name, or else a year ("2026") that
 * exactly one edition starts in or carries in its name. Null when it is
 * neither, or when the year fits more than one.
 */
export function matchEdition(cell: unknown, editions: Edition[]): Edition | null {
  const key = normNameKey(cell);
  if (!key) return null;
  const named = editions.find((e) => normNameKey(e.name) === key);
  if (named) return named;
  if (!/^\d{4}$/.test(key)) return null;
  const inYear = editions.filter((e) => (e.startDate || "").startsWith(key) || e.name.includes(key));
  return inYear.length === 1 ? inYear[0] : null;
}

/**
 * An amount from a spreadsheet cell. Excel hands real numbers over as they
 * are; typed text is read the Belgian way first ("€ 1.250,50"), falling back
 * to a decimal point ("1250.50") when there is no comma. Null for an empty
 * cell, NaN for one that isn't an amount.
 */
export function parseAmount(cell: unknown): number | null {
  if (typeof cell === "number") return cell;
  const raw = normStr(cell).replace(/[€\s ]|eur/gi, "");
  if (!raw) return null;
  if (!/^-?[\d.,]+$/.test(raw)) return NaN;
  const lastComma = raw.lastIndexOf(","),
    lastDot = raw.lastIndexOf(".");
  let plain: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // both: whichever comes last is the decimal mark
    plain = lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    plain = raw.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
    // "1.250" is a thousand two hundred and fifty, not one and a quarter
    plain = raw.replace(/\./g, "");
  } else {
    plain = raw;
  }
  return /^-?\d+(\.\d+)?$/.test(plain) ? Number(plain) : NaN;
}
