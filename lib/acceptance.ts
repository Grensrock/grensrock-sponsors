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
  "drinkTickets",
  "drinkVouchers",
  "foodDrinkValue",
  "foodDrinkVouchers",
  "baseFoodDrink",
  "folderMention",
  "posterMention",
  "websiteMention",
  "ledboarding",
  "barrierCovers",
  "herasCovers",
  "notes",
  "invoiceReference",
];

export const termsSnapshot = (d: Partial<Deal>): Partial<Deal> =>
  SNAPSHOT_FIELDS.reduce((a, k) => ({ ...a, [k]: d[k] ?? null }), {} as Partial<Deal>);

export const isAccepted = (d?: Partial<Deal> | null) => !!d?.acceptance?.acceptedAt;

/* Have the terms been altered since the sponsor accepted them? */
export const changedSinceAcceptance = (d?: Partial<Deal> | null) =>
  isAccepted(d) && JSON.stringify(termsSnapshot(d as Deal)) !== JSON.stringify(d?.acceptance?.snapshot);

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
