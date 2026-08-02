import { normStr } from "@/lib/normalize";
import type { Language } from "@/types";

export type VatResult = { valid: true; formatted: string } | { valid: false; code: string };

export const cleanVat = (raw: unknown) => normStr(raw).toUpperCase().replace(/[\s.\-]/g, "");

/* EU member states (EL = Greece, XI = Northern Ireland), plus the non-EU
   neighbours a Belgian sponsor plausibly invoices from. */
const VAT_COUNTRIES = new Set(
  "AT BE BG CH CY CZ DE DK EE EL ES FI FR GB HR HU IE IT LT LU LV MT NL NO PL PT RO SE SI SK XI".split(" "),
);

export function validateVat(raw: unknown): VatResult | null {
  let v = cleanVat(raw);
  if (!v) return null; // empty is allowed (e.g. persons)
  if (/^\d{9,10}$/.test(v)) v = "BE" + (v.length === 9 ? "0" + v : v); // bare number: assume Belgian
  if (!/^[A-Z]{2}/.test(v)) return { valid: false, code: "format" };
  const cc = v.slice(0, 2);
  if (cc === "BE") {
    const d = v.slice(2);
    if (!/^\d{10}$/.test(d) || !/^[01]/.test(d)) return { valid: false, code: "be_format" };
    const check = 97 - (Number(d.slice(0, 8)) % 97);
    if (check !== Number(d.slice(8))) return { valid: false, code: "be_check" };
    return { valid: true, formatted: `BE ${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}` };
  }
  if (cc === "FR") {
    if (!/^FR[0-9A-Z]{2}\d{9}$/.test(v)) return { valid: false, code: "fr_format" };
    return { valid: true, formatted: `FR ${v.slice(2, 4)} ${v.slice(4, 7)} ${v.slice(7, 10)} ${v.slice(10)}` };
  }
  if (cc === "NL") {
    if (!/^NL\d{9}B\d{2}$/.test(v)) return { valid: false, code: "nl_format" };
    return { valid: true, formatted: v };
  }
  /* Other countries: we don't know every national check rule, but a real VAT
     number always starts with a country we recognise and carries digits —
     without that, "NONSENSE" would sail through as country "NO". */
  if (!VAT_COUNTRIES.has(cc)) return { valid: false, code: "format" };
  const rest = v.slice(2);
  if (!/^[0-9A-Z]{2,12}$/.test(rest) || (rest.match(/\d/g) || []).length < 2) {
    return { valid: false, code: "format" };
  }
  return { valid: true, formatted: v };
}

/** Country code of a well-formed VAT number ("BE", "FR", …), or "" when it isn't one. */
export const vatCountry = (raw: unknown) => {
  const res = validateVat(raw);
  return res && res.valid ? cleanVat(res.formatted).slice(0, 2) : "";
};

/** The 10-digit enterprise number behind a Belgian VAT number, or "" for anything else. */
export const belgianEnterpriseNumber = (raw: unknown) => {
  const res = validateVat(raw);
  if (!res || !res.valid) return "";
  const v = cleanVat(res.formatted);
  return v.startsWith("BE") ? v.slice(2) : "";
};

export const VAT_MSG: Record<string, Record<Language, string>> = {
  format: {
    nl: "Dit lijkt geen geldig BTW-nummer.",
    fr: "Ceci ne semble pas être un numéro de TVA valide.",
    en: "This doesn't look like a valid VAT number.",
  },
  be_format: {
    nl: "Een Belgisch BTW-nummer heeft de vorm BE 0123.456.789.",
    fr: "Un numéro de TVA belge a la forme BE 0123.456.789.",
    en: "A Belgian VAT number looks like BE 0123.456.789.",
  },
  be_check: {
    nl: "De controlecijfers van dit Belgische BTW-nummer kloppen niet — kijk het even na.",
    fr: "Les chiffres de contrôle de ce numéro de TVA belge ne correspondent pas — vérifiez-le.",
    en: "The check digits of this Belgian VAT number don't match — please verify it.",
  },
  fr_format: {
    nl: "Een Frans BTW-nummer heeft de vorm FR XX 123456789.",
    fr: "Un numéro de TVA français a la forme FR XX 123456789.",
    en: "A French VAT number looks like FR XX 123456789.",
  },
  nl_format: {
    nl: "Een Nederlands BTW-nummer heeft de vorm NL123456789B01.",
    fr: "Un numéro de TVA néerlandais a la forme NL123456789B01.",
    en: "A Dutch VAT number looks like NL123456789B01.",
  },
};

export const vatMessage = (code: string, lang: Language = "en") =>
  (VAT_MSG[code] || VAT_MSG.format)[lang] || VAT_MSG.format.en;

/* ---------- registry lookup (see lib/integrations/vat-lookup.ts) ---------- */

export const VAT_LOOKUP_MSG: Record<string, Record<Language, string>> = {
  checking: {
    nl: "Controleren in de KBO…",
    fr: "Vérification à la BCE…",
    en: "Checking the company registry…",
  },
  not_found: {
    nl: "Dit nummer staat niet in de Kruispuntbank van Ondernemingen. Kijk het even na.",
    fr: "Ce numéro ne figure pas à la Banque-Carrefour des Entreprises. Veuillez le vérifier.",
    en: "This number isn't in the Belgian company registry. Please check it.",
  },
  inactive: {
    nl: "Deze onderneming is stopgezet volgens de KBO.",
    fr: "Cette entreprise est arrêtée selon la BCE.",
    en: "The registry lists this company as stopped.",
  },
  unsupported_country: {
    nl: "Het nummer is geldig, maar alleen Belgische nummers kunnen we in de KBO opzoeken.",
    fr: "Le numéro est valide, mais seuls les numéros belges peuvent être vérifiés à la BCE.",
    en: "The number is valid, but only Belgian numbers can be checked against the registry.",
  },
  unavailable: {
    nl: "De KBO-controle staat momenteel uit.",
    fr: "La vérification BCE est actuellement désactivée.",
    en: "The registry check is switched off right now.",
  },
  error: {
    nl: "De KBO-controle lukte niet. Probeer het zo dadelijk opnieuw.",
    fr: "La vérification BCE a échoué. Réessayez dans un instant.",
    en: "The registry check failed. Try again in a moment.",
  },
  filled: {
    nl: "Naam en adres ingevuld vanuit de KBO.",
    fr: "Nom et adresse remplis depuis la BCE.",
    en: "Name and address filled in from the company registry.",
  },
  use: {
    nl: "Deze gegevens overnemen",
    fr: "Utiliser ces données",
    en: "Use these details",
  },
};

export const vatLookupMessage = (code: string, lang: Language = "en") =>
  (VAT_LOOKUP_MSG[code] || VAT_LOOKUP_MSG.error)[lang] || VAT_LOOKUP_MSG.error.en;

/* Returns the value to store: formatted when valid, as-typed otherwise */
export const vatToStore = (raw: unknown) => {
  const res = validateVat(raw);
  return res && res.valid ? res.formatted : normStr(raw);
};
