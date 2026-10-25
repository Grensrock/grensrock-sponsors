import {
  FOLDER_OPTS,
  POSTER_OPTS,
  VOUCHER_TYPES,
  WEBSITE_OPTS,
  emptyDeal,
  label,
  type ReturnExampleType,
} from "@/lib/constants";
import { eur } from "@/lib/money";
import { ledLabel, normFolder, normLed } from "@/lib/normalize";
import type { Deal, Formula, FormulaFields, Language, ProductKey, Voucher, VoucherRow, VoucherType } from "@/types";

type BenefitSource = Partial<FormulaFields> | null | undefined;

export const drinkPoolValue = (d?: BenefitSource) => Number(d?.drinkValue) || 0;

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
  else if (Number(deal.drinkValue) > 0) push("drink", deal.drinkValue, 1); // no split defined yet
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
    drinkValue: f.drinkValue,
    drinkVouchers: f.drinkVouchers || [],
    foodDrinkValue: f.foodDrinkValue,
    baseFoodDrink: f.foodDrinkValue,
    folderMention: f.folderMention,
    websiteMention: f.websiteMention,
    posterMention: f.posterMention || "none",
    ledboarding: normLed(f.ledboarding),
    fenceCovers: f.fenceCovers || 0,
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
  if (Number(v.drinkValue) > 0) {
    const dvt = voucherText(v.drinkVouchers);
    out.push(
      `${B("Drankbonnen", "Bons boissons", "Drink vouchers")}: ${eur(drinkPoolValue(v))}${dvt ? ` (${dvt})` : ""}`,
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
    out.push(`${B("Folder", "Dépliant", "Folder")}: ${label(FOLDER_OPTS, normFolder(v.folderMention), lang)}`);
  if (v.posterMention && v.posterMention !== "none")
    out.push(`${B("Affiche", "Affiche", "Poster")}: ${label(POSTER_OPTS, v.posterMention, lang)}`);
  if (v.websiteMention !== "none") out.push(`Website: ${label(WEBSITE_OPTS, v.websiteMention || "none", lang)}`);
  if (normLed(v.ledboarding).length) out.push(`LED: ${ledLabel(v.ledboarding, lang)}`);
  if (Number(v.fenceCovers) > 0) out.push(`${v.fenceCovers} × banner`);
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
  if (Number(v.fenceCovers) > 0) types.push("banner");
  return types;
}

/* Tickoweb needs its own product for every type and amount, e.g. "drink:27.50".
   VIP tickets carry no amount, so their key is just the type. */
export const productKey = (type: VoucherType, value: unknown): ProductKey =>
  Number(value) > 0 ? `${type}:${Number(value).toFixed(2)}` : type;

export interface VoucherProduct {
  key: ProductKey;
  type: VoucherType;
  value: number;
  /** Vouchers the agreements entitle to */
  expected: number;
  /** Voucher records already generated, cancelled ones left out */
  generated: number;
  sponsors: number;
}

/* Every distinct product an edition needs, from its agreements and its generated vouchers */
export function voucherProducts(deals: Deal[], vouchers: Voucher[]): VoucherProduct[] {
  const map = new Map<string, VoucherProduct & { sponsorIds: Set<string> }>();
  const at = (type: VoucherType, value: number) => {
    const key = productKey(type, value);
    if (!map.has(key))
      map.set(key, { key, type, value: Number(value) || 0, expected: 0, generated: 0, sponsors: 0, sponsorIds: new Set() });
    return map.get(key)!;
  };
  deals.forEach((d) =>
    expectedVouchers(d).forEach((w) => {
      const p = at(w.type, w.value);
      p.expected++;
      p.sponsorIds.add(d.sponsorId);
    }),
  );
  vouchers
    .filter((v) => v.status !== "cancelled")
    .forEach((v) => {
      const p = at(v.type, v.value);
      p.generated++;
      p.sponsorIds.add(v.sponsorId);
    });
  const order = Object.keys(VOUCHER_TYPES);
  return [...map.values()]
    .map(({ sponsorIds, ...p }) => ({ ...p, sponsors: sponsorIds.size }))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.value - b.value);
}
