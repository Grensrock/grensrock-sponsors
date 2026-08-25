import { supabase } from "@/lib/supabase/client";
import { formulaFieldsToRow, orEmpty, rowToFormulaFields, unwrap, type Row } from "@/lib/api/util";
import type { Formula } from "@/types";

/* ============================================================
   formulas
   ============================================================
   A formula's identity in the app is (edition, name) — the type has no
   id field (Stage 1 kept the prototype's shape). The table does have a
   uuid pk, but every call here addresses rows by edition_id + name so
   the component types stay untouched.
   ============================================================ */

const COLUMNS =
  "id, edition_id, name, cost, vip_friday, vip_saturday, vip_guests, drink_value, drink_vouchers, food_drink_value, base_food_drink, food_drink_vouchers, folder_mention, website_mention, poster_mention, ledboarding, barrier_covers, heras_covers";

export interface FormulaWithEdition extends Formula {
  editionId: string;
}

export function rowToFormula(row: Row): FormulaWithEdition {
  return {
    ...rowToFormulaFields(row),
    editionId: String(row.edition_id),
    name: orEmpty(row.name),
  };
}

export async function listFormulas(): Promise<FormulaWithEdition[]> {
  const rows = unwrap<Row[]>(await supabase.from("formulas").select(COLUMNS).order("name"));
  return (rows as Row[]).map(rowToFormula);
}

export async function createFormula(editionId: string, f: Formula): Promise<FormulaWithEdition> {
  const row = unwrap<Row | null>(
    await supabase
      .from("formulas")
      .insert({ ...formulaFieldsToRow(f), edition_id: editionId, name: f.name || "" })
      .select(COLUMNS)
      .single(),
  );
  return rowToFormula(row as Row);
}

export async function updateFormula(
  editionId: string,
  originalName: string,
  f: Formula,
): Promise<FormulaWithEdition> {
  const row = unwrap<Row | null>(
    await supabase
      .from("formulas")
      .update({ ...formulaFieldsToRow(f), name: f.name || "" })
      .eq("edition_id", editionId)
      .eq("name", originalName)
      .select(COLUMNS)
      .single(),
  );
  return rowToFormula(row as Row);
}

export async function deleteFormula(editionId: string, name: string): Promise<void> {
  const { error } = await supabase.from("formulas").delete().eq("edition_id", editionId).eq("name", name);
  if (error) throw new Error(error.message);
}
