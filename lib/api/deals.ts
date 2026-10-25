import { supabase } from "@/lib/supabase/client";
import {
  formulaFieldsToRow,
  num,
  orEmpty,
  orNull,
  rowToFormulaFields,
  unwrap,
  voucherRows,
  voucherRowsToJson,
  type Row,
} from "@/lib/api/util";
import type { Acceptance, Deal, Language, PendingMail, Settlement, VoucherRow } from "@/types";

/* ============================================================
   deals (agreements)
   ============================================================
   Team side: plain table calls under is_team() (delete is admin-only).
   Portal side: never a table write — request_formula(),
   update_deal_food_drink(), update_deal_voucher_split() and
   accept_deal() are the only ways in, and each re-derives the caller's
   own sponsor_id server-side (0004_rpc.sql).
   ============================================================ */

const COLUMNS =
  "id, sponsor_id, edition_id, formula_name, cost, vip_friday, vip_saturday, vip_guests, drink_value, drink_vouchers, food_drink_value, base_food_drink, food_drink_vouchers, folder_mention, website_mention, poster_mention, ledboarding, fence_covers, notes, settlement, in_kind_description, in_kind_value, ref_required, invoice_reference, invoice_created, invoice_number, email_sent_at, created_at, requested_at, requested_by, confirmed_at, responsible, acceptance, benefits_changed_at, benefits_approved_at, benefits_approved_by, pending_mail";

export function rowToDeal(row: Row): Deal {
  return {
    ...rowToFormulaFields(row),
    /* Optional on FormulaFields, always present on a Deal. */
    baseFoodDrink: num(row.base_food_drink),
    foodDrinkVouchers: voucherRows(row.food_drink_vouchers),
    id: String(row.id),
    sponsorId: String(row.sponsor_id),
    editionId: String(row.edition_id),
    formulaName: orEmpty(row.formula_name),
    notes: orEmpty(row.notes),
    settlement: (row.settlement || "invoice") as Settlement,
    inKindDescription: orEmpty(row.in_kind_description),
    inKindValue: num(row.in_kind_value),
    refRequired: !!row.ref_required,
    invoiceReference: orEmpty(row.invoice_reference),
    invoiceCreated: !!row.invoice_created,
    invoiceNumber: orEmpty(row.invoice_number),
    emailSentAt: (row.email_sent_at as string) ?? null,
    createdAt: (row.created_at as string) ?? null,
    requestedAt: (row.requested_at as string) ?? null,
    requestedBy: orEmpty(row.requested_by),
    confirmedAt: (row.confirmed_at as string) ?? null,
    responsible: orEmpty(row.responsible),
    acceptance: (row.acceptance as Acceptance) ?? null,
    benefitsChangedAt: (row.benefits_changed_at as string) ?? null,
    benefitsApprovedAt: (row.benefits_approved_at as string) ?? null,
    benefitsApprovedBy: orEmpty(row.benefits_approved_by),
    pendingMail: (row.pending_mail as PendingMail) ?? null,
  };
}

/* The benefits' approval and the held mail are not in here: the database
   sets the first (0026) and the mail routes the second. */
export function dealToRow(d: Partial<Deal>): Row {
  const r: Row = formulaFieldsToRow(d);
  if (d.sponsorId !== undefined) r.sponsor_id = d.sponsorId;
  if (d.editionId !== undefined) r.edition_id = d.editionId;
  if (d.formulaName !== undefined) r.formula_name = d.formulaName || "";
  if (d.notes !== undefined) r.notes = d.notes || "";
  if (d.settlement !== undefined) r.settlement = d.settlement || "invoice";
  if (d.inKindDescription !== undefined) r.in_kind_description = d.inKindDescription || "";
  if (d.inKindValue !== undefined) r.in_kind_value = num(d.inKindValue);
  if (d.refRequired !== undefined) r.ref_required = !!d.refRequired;
  if (d.invoiceReference !== undefined) r.invoice_reference = d.invoiceReference || "";
  if (d.invoiceCreated !== undefined) r.invoice_created = !!d.invoiceCreated;
  if (d.invoiceNumber !== undefined) r.invoice_number = d.invoiceNumber || "";
  if (d.emailSentAt !== undefined) r.email_sent_at = orNull(d.emailSentAt);
  if (d.requestedAt !== undefined) r.requested_at = orNull(d.requestedAt);
  if (d.requestedBy !== undefined) r.requested_by = d.requestedBy || "";
  if (d.confirmedAt !== undefined) r.confirmed_at = orNull(d.confirmedAt);
  if (d.responsible !== undefined) r.responsible = d.responsible || "";
  if (d.acceptance !== undefined) r.acceptance = d.acceptance ?? null;
  return r;
}

export async function listDeals(): Promise<Deal[]> {
  const rows = unwrap<Row[]>(await supabase.from("deals").select(COLUMNS));
  return (rows as Row[]).map(rowToDeal);
}

export async function getDeal(id: string): Promise<Deal | null> {
  const row = unwrap<Row | null>(await supabase.from("deals").select(COLUMNS).eq("id", id).maybeSingle());
  return row ? rowToDeal(row as Row) : null;
}

/* ----- team ----- */

export async function createDeal(d: Partial<Deal>): Promise<Deal> {
  const row = unwrap<Row | null>(
    await supabase
      .from("deals")
      .insert({ ...dealToRow(d), sponsor_id: d.sponsorId, edition_id: d.editionId })
      .select(COLUMNS)
      .single(),
  );
  return rowToDeal(row as Row);
}

/** One insert for the whole list, so an import goes in entirely or not at all
    — a clash on one row never leaves half a file behind. */
export async function createDeals(list: Array<Partial<Deal>>): Promise<Deal[]> {
  if (list.length === 0) return [];
  const rows = unwrap<Row[]>(
    await supabase
      .from("deals")
      .insert(list.map((d) => ({ ...dealToRow(d), sponsor_id: d.sponsorId, edition_id: d.editionId })))
      .select(COLUMNS),
  );
  return (rows as Row[]).map(rowToDeal);
}

export async function updateDeal(id: string, patch: Partial<Deal>): Promise<Deal> {
  const row = unwrap<Row | null>(await supabase.from("deals").update(dealToRow(patch)).eq("id", id).select(COLUMNS).single());
  return rowToDeal(row as Row);
}

/**
 * Admin only. Matches the original app's deleteDeal exactly: pending vouchers
 * are removed outright, already-issued ones (created/sent) are kept as a
 * record but flipped to "cancelled" — only after that does the deal itself
 * go, so the FK (on delete set null) just detaches the survivors rather than
 * destroying them.
 */
export async function deleteDeal(id: string): Promise<void> {
  const cancelled = await supabase
    .from("vouchers")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("deal_id", id)
    .not("status", "in", "(pending,cancelled)");
  if (cancelled.error) throw new Error(cancelled.error.message);

  const pending = await supabase.from("vouchers").delete().eq("deal_id", id).eq("status", "pending");
  if (pending.error) throw new Error(pending.error.message);

  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ----- sponsor portal (RPC only) ----- */

/** Returns the id of the created (or already existing) deal. */
export async function portalRequestFormula(
  editionId: string,
  formulaName: string,
  requestedBy: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_formula", {
    p_edition_id: editionId,
    p_formula_name: formulaName,
    p_requested_by: requestedBy || "",
  });
  if (error) throw new Error(error.message);
  return String(data);
}

/** Top up the food & drink value; drops the pending split + pending food vouchers. */
export async function portalUpdateFoodDrink(dealId: string, foodDrinkValue: unknown): Promise<void> {
  const { error } = await supabase.rpc("update_deal_food_drink", {
    p_deal_id: dealId,
    p_food_drink_value: num(foodDrinkValue),
  });
  if (error) throw new Error(error.message);
}

export async function portalUpdateSplit(
  dealId: string,
  pool: "drink" | "food",
  rows: VoucherRow[],
): Promise<void> {
  const { error } = await supabase.rpc("update_deal_voucher_split", {
    p_deal_id: dealId,
    p_pool: pool,
    p_rows: voucherRowsToJson(rows),
  });
  if (error) throw new Error(error.message);
}

/** The RPC derives who accepted from the caller's own contacts row. */
export async function portalAcceptDeal(dealId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_deal", { p_deal_id: dealId });
  if (error) throw new Error(error.message);
}

/** Admin only (checked in the RPC): records the acceptance in the sponsor's
 *  place, flagged byTeam and in the admin's name. */
export async function teamAcceptDeal(dealId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_deal_for_sponsor", { p_deal_id: dealId });
  if (error) throw new Error(error.message);
}

/* ----- telling the admins about a new agreement ----- */

/**
 * Mails the admins that this agreement was just created, or that its benefits
 * were just set apart from the formula and wait for their approval. Call it
 * once, right after the save that did either — the route refuses an agreement
 * that is neither brand new nor newly waiting.
 *
 * Throws on failure. The agreement exists regardless, so callers should only
 * log that, not undo or block anything.
 */
export async function notifyAdmins(dealId: string): Promise<void> {
  const res = await fetch("/api/deals/notify-created", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Could not notify the admins.");
  }
}

/* ----- sending the confirmation email ----- */

export interface SendAgreementResult {
  /** "" when the mail was held rather than sent. */
  sentAt: string;
  /** The benefits wait for an admin, so the mail is held until they approve
      them and nothing went out yet (0026). */
  held: boolean;
  /** Addresses the message actually went to, as stored on the contacts — or,
      when held, the ones it will go to. */
  to: string[];
  /** The sponsor's responsible, if they were put in Cc and got their copy. */
  cc: string | null;
  /** Non-fatal problems worth telling the team about; the mail still went. */
  warnings: string[];
}

const toSendResult = (data: Record<string, unknown>) => ({
  to: Array.isArray(data.to) ? data.to.map(String) : [],
  cc: data.cc ? String(data.cc) : null,
  warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
});

/**
 * Emails an agreement's confirmation to the chosen contacts and marks it sent
 * — or, while its benefits wait for an admin, holds it until they approve.
 *
 * Only the ids of the recipients travel — the route reads their addresses from
 * the contacts rows, so an edited body can never redirect the message. Throws
 * on failure; the caller decides how loudly to say so.
 */
export async function sendAgreementEmail(
  dealId: string,
  contactIds: string[],
  subject: string,
  body: string,
  language: Language,
): Promise<SendAgreementResult> {
  const res = await fetch("/api/deals/send-agreement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, contactIds, subject, body, language }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Could not send the email.");
  return {
    sentAt: data.held ? "" : String(data.sentAt || new Date().toISOString()),
    held: !!data.held,
    ...toSendResult(data),
  };
}

/* ----- approving benefits that differ from the formula ----- */

export interface ApproveBenefitsResult {
  /** The held mail, as it went out; null when none was held, or it failed. */
  sent: Omit<SendAgreementResult, "held"> | null;
  /** The approval stands, but the held mail could not be sent. */
  mailError: string | null;
}

/**
 * Admin only. Approves the agreement's benefits and sends the mail that was
 * held for it, if any. Throws only when the approval itself failed.
 */
export async function approveBenefits(dealId: string): Promise<ApproveBenefitsResult> {
  const res = await fetch("/api/deals/approve-benefits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Could not approve the benefits.");
  return {
    sent: data.sent ? { sentAt: String(data.sent.sentAt || ""), ...toSendResult(data.sent) } : null,
    mailError: data.mailError ? String(data.mailError) : null,
  };
}
