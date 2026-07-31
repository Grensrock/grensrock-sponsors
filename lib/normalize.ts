import { FOLDER_OPTS, LED_ZONES, POSTER_OPTS, SETTLEMENTS } from "@/lib/constants";
import type { Deal, FolderMention, LedZone, Language, NumLike, VoucherRow } from "@/types";

export const normStr = (v: unknown) => String(v ?? "").trim();
export const normVatKey = (v: unknown) => normStr(v).replace(/[^0-9a-z]/gi, "").toLowerCase();
export const normNameKey = (v: unknown) => normStr(v).toLowerCase().replace(/\s+/g, " ");

export const normLang = (v: unknown): Language => {
  const t = normStr(v).toLowerCase();
  if (/^fr|fran|frans/.test(t)) return "fr";
  if (/^en|eng/.test(t)) return "en";
  return "nl";
};

export const normEntity = (v: unknown) =>
  /pers|natuur|individu|physique/.test(normStr(v).toLowerCase()) ? "person" : "legal";

/* Migrate older saved data: ledboarding was a single value, folderMention a yes/no */
export const normLed = (v: unknown): LedZone[] =>
  Array.isArray(v)
    ? (v.filter((x) => LED_ZONES[x as LedZone]) as LedZone[])
    : v && v !== "none"
      ? [v as LedZone]
      : [];

export const normFolder = (v: unknown): FolderMention =>
  typeof v === "boolean"
    ? v
      ? "full"
      : "none"
    : v && FOLDER_OPTS[v as FolderMention]
      ? (v as FolderMention)
      : "none";

type BenefitInput = Partial<Deal> & {
  extraFoodDrink?: NumLike;
  extraFoodDrinkVouchers?: VoucherRow[];
};

export function normBenefits<T extends BenefitInput>(o: T): T {
  return {
    ...o,
    ledboarding: normLed(o.ledboarding),
    folderMention: normFolder(o.folderMention),
    drinkVouchers: Array.isArray(o.drinkVouchers) ? o.drinkVouchers : [],
    posterMention: POSTER_OPTS[o.posterMention as keyof typeof POSTER_OPTS] ? o.posterMention : "none",
    barrierCovers: Number(o.barrierCovers) || 0,
    herasCovers: Number(o.herasCovers) || 0,
    // Additional F&D used to be a separate field; it now lives inside foodDrinkValue.
    // baseFoodDrink records what the formula included, so we can still bill the top-up.
    foodDrinkValue: (Number(o.foodDrinkValue) || 0) + (Number(o.extraFoodDrink) || 0),
    baseFoodDrink: o.baseFoodDrink !== undefined ? Number(o.baseFoodDrink) || 0 : Number(o.foodDrinkValue) || 0,
    foodDrinkVouchers: [
      ...(Array.isArray(o.foodDrinkVouchers) ? o.foodDrinkVouchers : []),
      ...(Array.isArray(o.extraFoodDrinkVouchers) ? o.extraFoodDrinkVouchers : []),
    ],
    settlement: SETTLEMENTS[o.settlement as keyof typeof SETTLEMENTS] ? o.settlement : "invoice",
    inKindDescription: o.inKindDescription || "",
    inKindValue: o.inKindValue ?? "",
    refRequired: !!o.refRequired,
    invoiceReference: o.invoiceReference || "",
  } as T;
}

export const ledLabel = (arr: unknown) =>
  normLed(arr)
    .map((z) => LED_ZONES[z])
    .join(" + ");
