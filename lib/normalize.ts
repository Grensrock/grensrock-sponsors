import {
  FOLDER_OPTS,
  LED_ZONES,
  LEGACY_DRINK_TICKET_VALUE,
  POSTER_OPTS,
  SETTLEMENTS,
  label,
} from "@/lib/constants";
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
  drinkTickets?: NumLike;
  barrierCovers?: NumLike;
  herasCovers?: NumLike;
};

export function normBenefits<T extends BenefitInput>(o: T): T {
  return {
    ...o,
    ledboarding: normLed(o.ledboarding),
    folderMention: normFolder(o.folderMention),
    drinkVouchers: Array.isArray(o.drinkVouchers) ? o.drinkVouchers : [],
    // Drink vouchers used to be a number of tickets of a fixed value; they are an amount now.
    drinkValue:
      o.drinkValue !== undefined
        ? Number(o.drinkValue) || 0
        : (Number(o.drinkTickets) || 0) * LEGACY_DRINK_TICKET_VALUE,
    posterMention: POSTER_OPTS[o.posterMention as keyof typeof POSTER_OPTS] ? o.posterMention : "none",
    // Nadar and Heras covers used to be counted apart; they are one count now.
    fenceCovers:
      o.fenceCovers !== undefined
        ? Number(o.fenceCovers) || 0
        : (Number(o.barrierCovers) || 0) + (Number(o.herasCovers) || 0),
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

export const ledLabel = (arr: unknown, lang: Language = "nl") =>
  normLed(arr)
    .map((z) => label(LED_ZONES, z, lang))
    .join(" + ");
