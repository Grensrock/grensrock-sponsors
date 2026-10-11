import { supabase } from "@/lib/supabase/client";
import { orEmpty, unwrap, type Row } from "@/lib/api/util";
import type { SponsorDecline } from "@/types";

/* ============================================================
   sponsor_declines
   ============================================================
   One row per sponsor that decided not to sponsor an edition (0022).
   Team-only; a portal session reads none. Creating an agreement for the
   same sponsor and edition deletes the row server-side.
   ============================================================ */

const COLUMNS = "id, sponsor_id, edition_id, reason, declined_at, recorded_by";

export function rowToDecline(row: Row): SponsorDecline {
  return {
    id: String(row.id),
    sponsorId: String(row.sponsor_id),
    editionId: String(row.edition_id),
    reason: orEmpty(row.reason),
    declinedAt: orEmpty(row.declined_at),
    recordedBy: orEmpty(row.recorded_by),
  };
}

export async function listDeclines(): Promise<SponsorDecline[]> {
  const rows = unwrap<Row[]>(await supabase.from("sponsor_declines").select(COLUMNS));
  return (rows as Row[]).map(rowToDecline);
}

export async function createDecline(d: Omit<SponsorDecline, "id" | "declinedAt">): Promise<SponsorDecline> {
  const row = unwrap<Row | null>(
    await supabase
      .from("sponsor_declines")
      .insert({
        sponsor_id: d.sponsorId,
        edition_id: d.editionId,
        reason: d.reason.trim(),
        recorded_by: d.recordedBy,
      })
      .select(COLUMNS)
      .single(),
  );
  return rowToDecline(row as Row);
}

export async function deleteDecline(id: string): Promise<void> {
  const { error } = await supabase.from("sponsor_declines").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
