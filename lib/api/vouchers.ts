import { supabase } from "@/lib/supabase/client";
import { num, orEmpty, orNull, unwrap, type Row } from "@/lib/api/util";
import type { Voucher, VoucherStatus, VoucherType } from "@/types";

/* ============================================================
   vouchers
   ============================================================
   Team side does everything through table calls (is_team()); the portal
   may only reassign a recipient, and only via assign_voucher_recipient().
   ============================================================ */

const COLUMNS =
  "id, sponsor_id, edition_id, deal_id, type, value, status, code, url, recipient_name, recipient_email, created_at, sent_at, cancelled_at, error";

export function rowToVoucher(row: Row): Voucher {
  return {
    id: String(row.id),
    sponsorId: String(row.sponsor_id),
    editionId: String(row.edition_id),
    dealId: String(row.deal_id),
    type: row.type as VoucherType,
    value: num(row.value),
    status: (row.status || "pending") as VoucherStatus,
    code: orEmpty(row.code),
    url: orEmpty(row.url),
    recipientName: orEmpty(row.recipient_name),
    recipientEmail: orEmpty(row.recipient_email),
    createdAt: (row.created_at as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    error: orEmpty(row.error),
  };
}

export function voucherToRow(v: Partial<Voucher>): Row {
  const r: Row = {};
  if (v.sponsorId !== undefined) r.sponsor_id = v.sponsorId;
  if (v.editionId !== undefined) r.edition_id = v.editionId;
  if (v.dealId !== undefined) r.deal_id = v.dealId;
  if (v.type !== undefined) r.type = v.type;
  if (v.value !== undefined) r.value = num(v.value);
  if (v.status !== undefined) r.status = v.status || "pending";
  if (v.code !== undefined) r.code = v.code || "";
  if (v.url !== undefined) r.url = v.url || "";
  if (v.recipientName !== undefined) r.recipient_name = v.recipientName || "";
  if (v.recipientEmail !== undefined) r.recipient_email = v.recipientEmail || "";
  if (v.createdAt !== undefined) r.created_at = orNull(v.createdAt);
  if (v.sentAt !== undefined) r.sent_at = orNull(v.sentAt);
  if (v.cancelledAt !== undefined) r.cancelled_at = orNull(v.cancelledAt);
  if (v.error !== undefined) r.error = v.error || "";
  return r;
}

export async function listVouchers(): Promise<Voucher[]> {
  const rows = unwrap<Row[]>(await supabase.from("vouchers").select(COLUMNS));
  return (rows as Row[]).map(rowToVoucher);
}

/* ----- team ----- */

export async function createVouchers(list: Array<Partial<Voucher>>): Promise<Voucher[]> {
  if (list.length === 0) return [];
  const rows = unwrap<Row[]>(await supabase.from("vouchers").insert(list.map(voucherToRow)).select(COLUMNS));
  return (rows as Row[]).map(rowToVoucher);
}

export async function updateVoucher(id: string, patch: Partial<Voucher>): Promise<Voucher> {
  const row = unwrap<Row | null>(await supabase.from("vouchers").update(voucherToRow(patch)).eq("id", id).select(COLUMNS).single());
  return rowToVoucher(row as Row);
}

export async function deleteVouchers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("vouchers").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

/* ----- sponsor portal (RPC only) ----- */

export async function portalAssignRecipient(
  voucherId: string,
  recipientName: string,
  recipientEmail: string,
): Promise<void> {
  const { error } = await supabase.rpc("assign_voucher_recipient", {
    p_voucher_id: voucherId,
    p_recipient_name: recipientName || "",
    p_recipient_email: recipientEmail || "",
  });
  if (error) throw new Error(error.message);
}
