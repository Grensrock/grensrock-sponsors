import type { PostgrestError } from "@supabase/supabase-js";
import type { FormulaFields, FolderMention, LedZone, PosterMention, VoucherRow, WebsiteMention } from "@/types";

/* ============================================================
   Shared row<->model helpers for lib/api/*
   ============================================================
   The database is snake_case (see supabase/migrations/0001_schema.sql);
   the TypeScript types from Stage 1 are camelCase and must not change.
   Everything that translates between the two lives in lib/api.
   ============================================================ */

export type Row = Record<string, unknown>;

/** Unwrap a PostgREST result, turning an error into a real exception. */
export function unwrap<T = Row>({ data, error }: { data: unknown; error: PostgrestError | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** `select()` without a generated Database type gives back loosely typed rows. */
export const asRows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

/** Numeric inputs keep "" while a field is being cleared — the DB wants a number. */
export const num = (v: unknown): number => Number(v) || 0;

/** "" / null / undefined -> null (uuid + date columns reject ""). */
export const orNull = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.trim() === "" ? null : s;
};

/** null -> "" (the components expect strings, never null, for text fields). */
export const orEmpty = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/* Ids that came from the database are uuids; ids the forms invent for a row
   that hasn't been saved yet (lib/constants.ts `uid()`) are not. Used to tell
   "new" from "existing" before handing an id to Postgres, which would reject
   a non-uuid outright. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): boolean => typeof v === "string" && UUID_RE.test(v);

export const voucherRows = (v: unknown): VoucherRow[] => (Array.isArray(v) ? (v as VoucherRow[]) : []);

/** Only keep {value, qty} as numbers — never write UI strings into jsonb. */
export const voucherRowsToJson = (rows?: VoucherRow[] | null) =>
  (rows || []).map((r) => ({ value: num(r.value), qty: num(r.qty) }));

/* ---------- FormulaFields: shared by `formulas` and `deals` ---------- */

export function rowToFormulaFields(row: Row): FormulaFields {
  return {
    cost: num(row.cost),
    vipFriday: num(row.vip_friday),
    vipSaturday: num(row.vip_saturday),
    vipGuests: num(row.vip_guests),
    drinkTickets: num(row.drink_tickets),
    drinkVouchers: voucherRows(row.drink_vouchers),
    foodDrinkValue: num(row.food_drink_value),
    baseFoodDrink: num(row.base_food_drink),
    foodDrinkVouchers: voucherRows(row.food_drink_vouchers),
    folderMention: (row.folder_mention || "none") as FolderMention,
    websiteMention: (row.website_mention || "none") as WebsiteMention,
    posterMention: (row.poster_mention || "none") as PosterMention,
    ledboarding: (Array.isArray(row.ledboarding) ? row.ledboarding : []) as LedZone[],
    barrierCovers: num(row.barrier_covers),
    herasCovers: num(row.heras_covers),
  };
}

/** Patch-shaped: only the keys actually present in `f` end up in the row. */
export function formulaFieldsToRow(f: Partial<FormulaFields>): Row {
  const r: Row = {};
  if (f.cost !== undefined) r.cost = num(f.cost);
  if (f.vipFriday !== undefined) r.vip_friday = num(f.vipFriday);
  if (f.vipSaturday !== undefined) r.vip_saturday = num(f.vipSaturday);
  if (f.vipGuests !== undefined) r.vip_guests = num(f.vipGuests);
  if (f.drinkTickets !== undefined) r.drink_tickets = num(f.drinkTickets);
  if (f.drinkVouchers !== undefined) r.drink_vouchers = voucherRowsToJson(f.drinkVouchers);
  if (f.foodDrinkValue !== undefined) r.food_drink_value = num(f.foodDrinkValue);
  if (f.baseFoodDrink !== undefined) r.base_food_drink = num(f.baseFoodDrink);
  if (f.foodDrinkVouchers !== undefined) r.food_drink_vouchers = voucherRowsToJson(f.foodDrinkVouchers);
  if (f.folderMention !== undefined) r.folder_mention = f.folderMention || "none";
  if (f.websiteMention !== undefined) r.website_mention = f.websiteMention || "none";
  if (f.posterMention !== undefined) r.poster_mention = f.posterMention || "none";
  if (f.ledboarding !== undefined) r.ledboarding = Array.isArray(f.ledboarding) ? f.ledboarding : [];
  if (f.barrierCovers !== undefined) r.barrier_covers = num(f.barrierCovers);
  if (f.herasCovers !== undefined) r.heras_covers = num(f.herasCovers);
  return r;
}
