import type { Deal, Language, NumLike } from "@/types";

/* A no-break space after the sign, so an amount never wraps into a lone "€"
   on one line and the number on the next. */
export const eur = (n?: NumLike | null) => {
  const v = Number(n) || 0;
  return "€\u00a0" + v.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* Every amount the sponsor sees (emails, portal, PDF) is a price excluding
   VAT, and says so: the invoice adds VAT on top, and a bare amount reads as
   the full price. Team-only screens and mails leave the label off. */
export const EXCL_VAT: Record<Language, string> = { nl: "excl. btw", fr: "HTVA", en: "excl. VAT" };

/* An amount with the "excl. VAT" label, for anything addressed to a sponsor */
export const eurExcl = (n: NumLike | null | undefined, lang: Language) => `${eur(n)} ${EXCL_VAT[lang]}`;

/* The part of the F&D value the sponsor added on top of what the formula included */
export const foodDrinkExtra = (d: Partial<Deal>) =>
  Math.max(0, (Number(d.foodDrinkValue) || 0) - (Number(d.baseFoodDrink) || 0));

/* The agreement's total: the contribution plus the food & drink vouchers
   bought on top of it, e.g. a € 500 formula with € 100 of vouchers is € 600 */
export const dealTotalCost = (d: Partial<Deal>) => (Number(d.cost) || 0) + foodDrinkExtra(d);

/* Amount that actually has to be invoiced */
export const invoiceAmount = (d: Partial<Deal>) => {
  const cost = dealTotalCost(d);
  if (d.settlement === "inkind") return foodDrinkExtra(d); // the top-up is always billable, even for in-kind deals
  if (d.settlement === "mixed") return Math.max(0, cost - (Number(d.inKindValue) || 0));
  return cost;
};

export const needsInvoice = (d: Partial<Deal>) => invoiceAmount(d) > 0;

/* A reference is required when the sponsor is flagged as such (or the agreement overrides it) */
export const refRequiredFor = (d?: Partial<Deal> | null, sponsor?: { refRequired?: boolean } | null) =>
  !!(sponsor?.refRequired || d?.refRequired);

export const refMissing = (d: Partial<Deal>, sponsor?: { refRequired?: boolean } | null) =>
  needsInvoice(d) && refRequiredFor(d, sponsor) && !String(d.invoiceReference || "").trim();
