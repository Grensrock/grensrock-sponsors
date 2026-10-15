import { supabase } from "@/lib/supabase/client";
import { orEmpty, orNull, unwrap, type Row } from "@/lib/api/util";
import type { EntityType, Sponsor } from "@/types";

/* ============================================================
   sponsors
   ============================================================
   Team writes are plain table calls under the is_team()/is_admin()
   policies. The sponsor portal has no write policy at all — its one
   write path is the update_sponsor_info() RPC (0004_rpc.sql).

   `contacts` is a separate table; listSponsors() returns sponsors with
   an empty contacts array and GrensrockApp groups the flat contact rows
   under their sponsor, keeping the in-memory shape components expect.
   ============================================================ */

const COLUMNS =
  "id, company_name, street, house_number, postal_code, city, vat_number, no_vat_number, entity_type, voucher_contact_id, responsible_id, ref_required";

export function rowToSponsor(row: Row): Sponsor {
  return {
    id: String(row.id),
    companyName: orEmpty(row.company_name),
    street: orEmpty(row.street),
    houseNumber: orEmpty(row.house_number),
    postalCode: orEmpty(row.postal_code),
    city: orEmpty(row.city),
    vatNumber: orEmpty(row.vat_number),
    noVatNumber: !!row.no_vat_number,
    entityType: (row.entity_type || "legal") as EntityType,
    contacts: [],
    voucherContactId: row.voucher_contact_id ? String(row.voucher_contact_id) : "",
    responsibleId: row.responsible_id ? String(row.responsible_id) : "",
    refRequired: !!row.ref_required,
  };
}

export function sponsorToRow(s: Partial<Sponsor>): Row {
  const r: Row = {};
  if (s.companyName !== undefined) r.company_name = s.companyName || "";
  if (s.street !== undefined) r.street = s.street || "";
  if (s.houseNumber !== undefined) r.house_number = s.houseNumber || "";
  if (s.postalCode !== undefined) r.postal_code = s.postalCode || "";
  if (s.city !== undefined) r.city = s.city || "";
  if (s.vatNumber !== undefined) r.vat_number = s.vatNumber || "";
  if (s.noVatNumber !== undefined) r.no_vat_number = !!s.noVatNumber;
  if (s.entityType !== undefined) r.entity_type = s.entityType || "legal";
  if (s.voucherContactId !== undefined) r.voucher_contact_id = orNull(s.voucherContactId);
  if (s.responsibleId !== undefined) r.responsible_id = orNull(s.responsibleId);
  if (s.refRequired !== undefined) r.ref_required = !!s.refRequired;
  return r;
}

export async function listSponsors(): Promise<Sponsor[]> {
  const rows = unwrap<Row[]>(await supabase.from("sponsors").select(COLUMNS).order("company_name"));
  return (rows as Row[]).map(rowToSponsor);
}

export async function getSponsor(id: string): Promise<Sponsor | null> {
  const row = unwrap<Row | null>(await supabase.from("sponsors").select(COLUMNS).eq("id", id).maybeSingle());
  return row ? rowToSponsor(row as Row) : null;
}

/* ----- team ----- */

export async function createSponsor(s: Partial<Sponsor>): Promise<Sponsor> {
  const row = unwrap<Row | null>(
    await supabase
      .from("sponsors")
      .insert({ ...sponsorToRow(s), company_name: s.companyName || "" })
      .select(COLUMNS)
      .single(),
  );
  return rowToSponsor(row as Row);
}

export async function createSponsors(list: Array<Partial<Sponsor>>): Promise<Sponsor[]> {
  if (list.length === 0) return [];
  const rows = unwrap<Row[]>(
    await supabase
      .from("sponsors")
      .insert(list.map((s) => ({ ...sponsorToRow(s), company_name: s.companyName || "" })))
      .select(COLUMNS),
  );
  return (rows as Row[]).map(rowToSponsor);
}

export async function updateSponsor(id: string, patch: Partial<Sponsor>): Promise<Sponsor> {
  const row = unwrap<Row | null>(await supabase.from("sponsors").update(sponsorToRow(patch)).eq("id", id).select(COLUMNS).single());
  return rowToSponsor(row as Row);
}

/** Cascades to contacts, deals and vouchers (see the FK definitions in 0001_schema.sql). */
export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ----- sponsor portal (RPC only) ----- */

/** update_sponsor_info() takes a camelCase jsonb patch and allowlists the columns itself. */
export async function portalUpdateSponsorInfo(patch: Partial<Sponsor>): Promise<void> {
  const p: Row = {};
  if (patch.companyName !== undefined) p.companyName = patch.companyName || "";
  if (patch.street !== undefined) p.street = patch.street || "";
  if (patch.houseNumber !== undefined) p.houseNumber = patch.houseNumber || "";
  if (patch.postalCode !== undefined) p.postalCode = patch.postalCode || "";
  if (patch.city !== undefined) p.city = patch.city || "";
  if (patch.vatNumber !== undefined) p.vatNumber = patch.vatNumber || "";
  if (patch.voucherContactId !== undefined) p.voucherContactId = patch.voucherContactId || "";
  if (patch.refRequired !== undefined) p.refRequired = !!patch.refRequired;

  const { error } = await supabase.rpc("update_sponsor_info", { patch: p });
  if (error) throw new Error(error.message);
}
