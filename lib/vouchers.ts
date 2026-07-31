import {
  DRINK_TICKET_VALUE,
  FOLDER_OPTS,
  POSTER_OPTS,
  WEBSITE_OPTS,
  emptyDeal,
  type ReturnExampleType,
} from "@/lib/constants";
import { eur } from "@/lib/money";
import { ledLabel, normFolder, normLed } from "@/lib/normalize";
import type { Deal, Formula, FormulaFields, Language, VoucherRow, VoucherType } from "@/types";

type BenefitSource = Partial<FormulaFields> | null | undefined;

export const drinkPoolValue = (d?: BenefitSource) => (Number(d?.drinkTickets) || 0) * DRINK_TICKET_VALUE;

export const voucherTotal = (rows?: VoucherRow[] | null) =>
  (rows || []).reduce((s, r) => s + (Number(r.value) || 0) * (Number(r.qty) || 0), 0);

export const voucherText = (rows?: VoucherRow[] | null) =>
  (rows || [])
    .filter((r) => Number(r.qty) > 0 && Number(r.value) > 0)
    .map((r) => `${r.qty} × ${eur(r.value)}`)
    .join(", ");

export interface ExpectedVoucher {
  type: VoucherType;
  value: number;
}

/* What an agreement entitles the sponsor to, as individual vouchers */
export function expectedVouchers(deal: Deal): ExpectedVoucher[] {
  const out: ExpectedVoucher[] = [];
  const push = (type: VoucherType, value: unknown, n: unknown) => {
    for (let i = 0; i < Number(n || 0); i++) out.push({ type, value: Number(value) || 0 });
  };
  push("vipFriday", 0, deal.vipFriday);
  push("vipSaturday", 0, deal.vipSaturday);
  push("vipGuests", 0, deal.vipGuests);
  const drinkRows = (deal.drinkVouchers || []).filter((r) => Number(r.qty) > 0 && Number(r.value) > 0);
  if (drinkRows.length) drinkRows.forEach((r) => push("drink", r.value, r.qty));
  else push("drink", DRINK_TICKET_VALUE, deal.drinkTickets);
  const rows = (deal.foodDrinkVouchers || []).filter((r) => Number(r.qty) > 0 && Number(r.value) > 0);
  if (rows.length) rows.forEach((r) => push("food", r.value, r.qty));
  else if (Number(deal.foodDrinkValue) > 0) push("food", deal.foodDrinkValue, 1); // no split defined yet
  // extra food & drink vouchers ordered by the sponsor on top of the formula
  return out;
}

/* Build an agreement straight from a formula — no edits, used when a sponsor picks one themselves */
export function dealFromFormula(f: Formula, sponsorId: string, editionId: string): Omit<Deal, "id"> {
  return {
    ...emptyDeal,
    sponsorId,
    editionId,
    formulaName: f.name,
    cost: f.cost,
    vipFriday: f.vipFriday,
    vipSaturday: f.vipSaturday,
    vipGuests: f.vipGuests,
    drinkTickets: f.drinkTickets,
    drinkVouchers: f.drinkVouchers || [],
    foodDrinkValue: f.foodDrinkValue,
    baseFoodDrink: f.foodDrinkValue,
    folderMention: f.folderMention,
    websiteMention: f.websiteMention,
    posterMention: f.posterMention || "none",
    ledboarding: normLed(f.ledboarding),
    barrierCovers: f.barrierCovers || 0,
    herasCovers: f.herasCovers || 0,
  };
}

/* Human-readable benefit list for a formula or agreement, in a given language */
export function ticketLines(v: BenefitSource, lang: Language = "nl"): string[] {
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang] || en;
  const out: string[] = [];
  if (!v) return out;
  if (Number(v.vipFriday) > 0)
    out.push(`${v.vipFriday} ${B("VIP-tickets vrijdag", "tickets VIP vendredi", "VIP tickets Friday")}`);
  if (Number(v.vipSaturday) > 0)
    out.push(`${v.vipSaturday} ${B("VIP-tickets zaterdag", "tickets VIP samedi", "VIP tickets Saturday")}`);
  if (Number(v.vipGuests) > 0)
    out.push(`${v.vipGuests} ${B("VIP-tickets genodigden", "tickets VIP invités", "VIP tickets guests")}`);
  if (Number(v.drinkTickets) > 0) {
    const dvt = voucherText(v.drinkVouchers);
    out.push(
      `${B("Drankbonnen", "Bons boissons", "Drink vouchers")}: ${eur(drinkPoolValue(v))}${
        dvt ? ` (${dvt})` : ` (${v.drinkTickets} × ${eur(DRINK_TICKET_VALUE)})`
      }`,
    );
  }
  if (Number(v.foodDrinkValue) > 0) {
    const split = voucherText(v.foodDrinkVouchers);
    out.push(
      `${B("Eten & drinken", "Food & boissons", "Food & drinks")}: ${eur(v.foodDrinkValue)}${
        split ? ` (${split})` : ""
      }`,
    );
  }
  return out;
}

export function visibilityLines(v: BenefitSource, lang: Language = "nl"): string[] {
  const B = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang] || en;
  const out: string[] = [];
  if (!v) return out;
  if (normFolder(v.folderMention) !== "none")
    out.push(`${B("Folder", "Dépliant", "Folder")}: ${FOLDER_OPTS[normFolder(v.folderMention)]}`);
  if (v.posterMention && v.posterMention !== "none")
    out.push(`${B("Affiche", "Affiche", "Poster")}: ${POSTER_OPTS[v.posterMention]}`);
  if (v.websiteMention !== "none") out.push(`Website: ${WEBSITE_OPTS[v.websiteMention as keyof typeof WEBSITE_OPTS]}`);
  if (normLed(v.ledboarding).length) out.push(`LED: ${ledLabel(v.ledboarding)}`);
  if (Number(v.barrierCovers) > 0)
    out.push(`${v.barrierCovers} × ${B("nadarhoes", "housse Nadar", "barrier cover")}`);
  if (Number(v.herasCovers) > 0) out.push(`${v.herasCovers} × ${B("Heras-hoes", "housse Heras", "Heras cover")}`);
  return out;
}

export const benefitLines = (v: BenefitSource, lang: Language = "nl") => [
  ...ticketLines(v, lang),
  ...visibilityLines(v, lang),
];

/* Which example pictures apply to a formula or agreement */
export function returnTypesOf(v: BenefitSource): ReturnExampleType[] {
  const types: ReturnExampleType[] = [];
  if (!v) return types;
  if (v.websiteMention === "logo") types.push("websiteLogo");
  if (v.websiteMention === "name") types.push("websiteName");
  if (v.posterMention && v.posterMention !== "none") types.push("poster");
  if (normFolder(v.folderMention) !== "none") types.push("folder");
  if (normLed(v.ledboarding).length) types.push("ledboarding");
  if (Number(v.barrierCovers) > 0) types.push("barrier");
  if (Number(v.herasCovers) > 0) types.push("heras");
  return types;
}
