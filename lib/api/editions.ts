import { supabase } from "@/lib/supabase/client";
import { orEmpty, orNull, unwrap, type Row } from "@/lib/api/util";
import type { Edition } from "@/types";

/* ============================================================
   editions
   ============================================================
   Team reads for everyone with a profile; writes are admin-only
   (0003_rls.sql). Sponsor portals can read active editions so they can
   pick a formula themselves.

   Formulas live in their own table — listEditions() returns editions
   with an empty formulas array; GrensrockApp groups the formula rows in.
   ============================================================ */

const COLUMNS = "id, name, start_date, end_date, location, active";

export function rowToEdition(row: Row): Edition {
  return {
    id: String(row.id),
    name: orEmpty(row.name),
    startDate: orEmpty(row.start_date),
    endDate: orEmpty(row.end_date),
    location: orEmpty(row.location),
    active: !!row.active,
    formulas: [],
  };
}

export function editionToRow(e: Partial<Edition>): Row {
  const r: Row = {};
  if (e.name !== undefined) r.name = e.name || "";
  if (e.startDate !== undefined) r.start_date = orNull(e.startDate);
  if (e.endDate !== undefined) r.end_date = orNull(e.endDate);
  if (e.location !== undefined) r.location = e.location || "";
  if (e.active !== undefined) r.active = !!e.active;
  return r;
}

export async function listEditions(): Promise<Edition[]> {
  const rows = unwrap<Row[]>(await supabase.from("editions").select(COLUMNS).order("start_date", { ascending: false }));
  return (rows as Row[]).map(rowToEdition);
}

export async function createEdition(e: Partial<Edition>): Promise<Edition> {
  const row = unwrap<Row | null>(
    await supabase
      .from("editions")
      .insert({ ...editionToRow(e), name: e.name || "" })
      .select(COLUMNS)
      .single(),
  );
  return rowToEdition(row as Row);
}

export async function updateEdition(id: string, patch: Partial<Edition>): Promise<Edition> {
  const row = unwrap<Row | null>(await supabase.from("editions").update(editionToRow(patch)).eq("id", id).select(COLUMNS).single());
  return rowToEdition(row as Row);
}

/** Cascades to formulas, deals and vouchers. */
export async function deleteEdition(id: string): Promise<void> {
  const { error } = await supabase.from("editions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
