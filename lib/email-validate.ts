import { normStr } from "@/lib/normalize";
import type { Language } from "@/types";

/* Pragmatic check: one @, a sensible local part, a dotted domain with a real TLD. */
export const EMAIL_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export type EmailResult = { valid: true; formatted: string } | { valid: false; code: string };

export function validateEmail(raw: unknown): EmailResult | null {
  const v = normStr(raw);
  if (!v) return null; // empty is allowed
  if (/\s/.test(v)) return { valid: false, code: "space" };
  if ((v.match(/@/g) || []).length !== 1) return { valid: false, code: "at" };
  if (!EMAIL_RE.test(v)) return { valid: false, code: "format" };
  return { valid: true, formatted: v.toLowerCase() };
}

export const MAIL_MSG: Record<string, Record<Language, string>> = {
  at: {
    nl: "Een e-mailadres bevat één @-teken.",
    fr: "Une adresse e-mail contient un seul @.",
    en: "An email address contains exactly one @.",
  },
  space: {
    nl: "Een e-mailadres mag geen spaties bevatten.",
    fr: "Une adresse e-mail ne peut pas contenir d'espaces.",
    en: "An email address can't contain spaces.",
  },
  format: {
    nl: "Dit lijkt geen geldig e-mailadres (bv. naam@bedrijf.be).",
    fr: "Ceci ne semble pas être une adresse e-mail valide (p.ex. nom@societe.be).",
    en: "This doesn't look like a valid email address (e.g. name@company.be).",
  },
};

export const mailMessage = (code: string, lang: Language = "en") =>
  (MAIL_MSG[code] || MAIL_MSG.format)[lang] || MAIL_MSG.format.en;

export const emailToStore = (raw: unknown) => {
  const res = validateEmail(raw);
  return res && res.valid ? res.formatted : normStr(raw);
};

export const sameEmail = (a: unknown, b: unknown) => normStr(a).toLowerCase() === normStr(b).toLowerCase();
