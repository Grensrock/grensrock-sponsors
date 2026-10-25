/* ---------- contract acceptance ----------
   A snapshot freezes the agreed terms at the moment of acceptance, so a later
   change to the agreement can never rewrite what the sponsor actually accepted. */

import type { Deal } from "@/types";

export const SNAPSHOT_FIELDS: Array<keyof Deal> = [
  "formulaName",
  "cost",
  "settlement",
  "inKindDescription",
  "inKindValue",
  "vipFriday",
  "vipSaturday",
  "vipGuests",
  "drinkValue",
  "drinkVouchers",
  "foodDrinkValue",
  "foodDrinkVouchers",
  "baseFoodDrink",
  "folderMention",
  "posterMention",
  "websiteMention",
  "ledboarding",
  "fenceCovers",
  "notes",
  "invoiceReference",
];

export const termsSnapshot = (d: Partial<Deal>): Partial<Deal> =>
  SNAPSHOT_FIELDS.reduce((a, k) => ({ ...a, [k]: d[k] ?? null }), {} as Partial<Deal>);

export const isAccepted = (d?: Partial<Deal> | null) => !!d?.acceptance?.acceptedAt;

/* The snapshot is written by accept_deal() in SQL, the agreement is read
   through rowToDeal — so the same terms arrive in two shapes. jsonb stores
   keys in its own order (shortest first), an empty text column is null there
   and "" here, and numbers can come back as numeric strings. Comparing the
   two as raw JSON therefore saw every accepted agreement as changed. Each
   field is brought to one form first, objects with their keys sorted. */
const sameForm = (v: unknown): unknown => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  if (Array.isArray(v)) return v.map(sameForm);
  if (typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce((a, k) => ({ ...a, [k]: sameForm((v as Record<string, unknown>)[k]) }), {});
  }
  return v;
};

/* How the amounts are split into vouchers is frozen with the rest, but it is
   not a change of terms: the portal has the sponsor divide them below the
   agreement, often after accepting. The amounts themselves (drinkValue,
   foodDrinkValue, so a top-up too) still count. */
const SPLIT_FIELDS: Array<keyof Deal> = ["drinkVouchers", "foodDrinkVouchers"];

/* Have the terms been altered since the sponsor accepted them? */
export const changedSinceAcceptance = (d?: Partial<Deal> | null) => {
  if (!isAccepted(d)) return false;
  const snap = (d?.acceptance?.snapshot || {}) as Partial<Deal>;
  return SNAPSHOT_FIELDS.filter((k) => !SPLIT_FIELDS.includes(k)).some(
    (k) => JSON.stringify(sameForm(d?.[k])) !== JSON.stringify(sameForm(snap[k])),
  );
};

export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const dt = new Date(iso);
  return dt.toLocaleString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
