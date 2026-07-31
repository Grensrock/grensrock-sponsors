import { normStr } from "@/lib/normalize";
import type { Language } from "@/types";

export type VatResult = { valid: true; formatted: string } | { valid: false; code: string };

export const cleanVat = (raw: unknown) => normStr(raw).toUpperCase().replace(/[\s.\-]/g, "");

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
  if (!/^[A-Z]{2}[0-9A-Z]{2,12}$/.test(v)) return { valid: false, code: "format" };
  return { valid: true, formatted: v };
}

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

/* Returns the value to store: formatted when valid, as-typed otherwise */
export const vatToStore = (raw: unknown) => {
  const res = validateVat(raw);
  return res && res.valid ? res.formatted : normStr(raw);
};
