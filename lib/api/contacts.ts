import { supabase } from "@/lib/supabase/client";
import { isUuid, orEmpty, unwrap, type Row } from "@/lib/api/util";
import type { Contact, Language } from "@/types";

/* ============================================================
   contacts
   ============================================================
   Flat table; GrensrockApp groups the rows under their sponsor so the
   in-memory Sponsor.contacts[] shape stays exactly as it was.
   Portal writes go through the upsert_sponsor_contact() RPC — the
   portal has no INSERT/UPDATE/DELETE policy on this table.
   ============================================================ */

const COLUMNS =
  "id, sponsor_id, first_name, last_name, email, phone, language, pref_info, pref_invoice, portal_access";

export interface ContactWithSponsor extends Contact {
  sponsorId: string;
}

export function rowToContact(row: Row): ContactWithSponsor {
  return {
    id: String(row.id),
    sponsorId: String(row.sponsor_id),
    firstName: orEmpty(row.first_name),
    lastName: orEmpty(row.last_name),
    email: orEmpty(row.email),
    phone: orEmpty(row.phone),
    language: (row.language || "nl") as Language,
    prefs: { info: !!row.pref_info, invoice: !!row.pref_invoice },
    portalAccess: !!row.portal_access,
  };
}

export function contactToRow(c: Partial<Contact>): Row {
  const r: Row = {};
  if (c.firstName !== undefined) r.first_name = c.firstName || "";
  if (c.lastName !== undefined) r.last_name = c.lastName || "";
  if (c.email !== undefined) r.email = c.email || "";
  if (c.phone !== undefined) r.phone = c.phone || "";
  if (c.language !== undefined) r.language = c.language || "nl";
  if (c.prefs !== undefined) {
    r.pref_info = !!c.prefs?.info;
    r.pref_invoice = !!c.prefs?.invoice;
  }
  if (c.portalAccess !== undefined) r.portal_access = !!c.portalAccess;
  return r;
}

export async function listContacts(): Promise<ContactWithSponsor[]> {
  const rows = unwrap<Row[]>(await supabase.from("contacts").select(COLUMNS));
  return (rows as Row[]).map(rowToContact);
}

/** The contacts row bound to the current magic-link session, if any. */
export async function getMyContact(): Promise<ContactWithSponsor | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const row = unwrap<Row | null>(await supabase.from("contacts").select(COLUMNS).eq("auth_user_id", user.id).maybeSingle());
  return row ? rowToContact(row as Row) : null;
}

/* ----- team ----- */

export async function createContact(sponsorId: string, c: Partial<Contact>): Promise<ContactWithSponsor> {
  const row = unwrap<Row | null>(
    await supabase
      .from("contacts")
      .insert({ ...contactToRow(c), sponsor_id: sponsorId })
      .select(COLUMNS)
      .single(),
  );
  return rowToContact(row as Row);
}

export async function createContacts(
  list: Array<{ sponsorId: string; contact: Partial<Contact> }>,
): Promise<ContactWithSponsor[]> {
  if (list.length === 0) return [];
  const rows = unwrap<Row[]>(
    await supabase
      .from("contacts")
      .insert(list.map(({ sponsorId, contact }) => ({ ...contactToRow(contact), sponsor_id: sponsorId })))
      .select(COLUMNS),
  );
  return (rows as Row[]).map(rowToContact);
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<ContactWithSponsor> {
  const row = unwrap<Row | null>(await supabase.from("contacts").update(contactToRow(patch)).eq("id", id).select(COLUMNS).single());
  return rowToContact(row as Row);
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ----- sponsor portal (RPC only) ----- */

/** upsert_sponsor_contact() takes a camelCase jsonb contact and returns its id. */
export async function portalUpsertContact(c: Partial<Contact>): Promise<string> {
  const payload: Row = {
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    email: c.email || "",
    phone: c.phone || "",
    language: c.language || "nl",
    prefs: { info: !!c.prefs?.info, invoice: !!c.prefs?.invoice },
    portalAccess: !!c.portalAccess,
  };
  // A form-generated id means "not saved yet" — the RPC would try to cast it to uuid.
  if (isUuid(c.id)) payload.id = c.id;

  const { data, error } = await supabase.rpc("upsert_sponsor_contact", { contact: payload });
  if (error) throw new Error(error.message);
  return String(data);
}

/** delete_sponsor_contact() — matches SponsorPortal's removeContact, unguarded. */
export async function portalDeleteContact(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_sponsor_contact", { p_contact_id: id });
  if (error) throw new Error(error.message);
}

/**
 * Emails a portal contact the link to set their password (14 days).
 * Used when access is switched on, and by the resend button.
 * Throws on failure — the caller decides how loudly to say so.
 */
export async function sendPortalLink(contactId: string): Promise<string> {
  const res = await fetch("/api/portal/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Could not send the portal link.");
  return String(body.to || "");
}
