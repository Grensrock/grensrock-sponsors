import { supabase } from "@/lib/supabase/client";
import { orEmpty, unwrap, type Row } from "@/lib/api/util";
import { defaultTickoweb } from "@/lib/integrations/tickoweb";
import { defaultVatLookup } from "@/lib/integrations/vat-lookup";
import type { Settings, TickowebConfig, TickowebMode, VatLookupMode } from "@/types";

/* ============================================================
   app_settings (singleton row, id = true)
   ============================================================
   Readable by the team, writable by admins. The Tickoweb API key is
   deliberately NOT a column here: secrets live in integration_secrets,
   which has RLS on and zero policies (service-role only), so it can
   never be read or written from the browser. The settings screen keeps
   its field, but the value is not persisted from the client — Tickoweb
   stays in "manual" mode per the plan.
   ============================================================ */

const COLUMNS =
  "id, vat_lookup_mode, tickoweb_mode, tickoweb_base_url, tickoweb_proxy_url, tickoweb_event_id, tickoweb_product_ids";

export function rowToSettings(row: Row): Settings {
  return {
    vatLookup: {
      mode: (row.vat_lookup_mode || defaultVatLookup.mode) as VatLookupMode,
    },
    tickoweb: {
      mode: (row.tickoweb_mode || "manual") as TickowebMode,
      baseUrl: orEmpty(row.tickoweb_base_url),
      proxyUrl: orEmpty(row.tickoweb_proxy_url),
      apiKey: "", // never leaves the server — see the note above
      eventId: orEmpty(row.tickoweb_event_id),
      productIds: (row.tickoweb_product_ids || {}) as TickowebConfig["productIds"],
    },
  };
}

export function settingsToRow(s: Settings): Row {
  const r: Row = {};
  if (s.vatLookup !== undefined) {
    r.vat_lookup_mode = s.vatLookup?.mode || defaultVatLookup.mode;
  }
  if (s.tickoweb !== undefined) {
    r.tickoweb_mode = s.tickoweb?.mode || "manual";
    r.tickoweb_base_url = s.tickoweb?.baseUrl || defaultTickoweb.baseUrl;
    r.tickoweb_proxy_url = s.tickoweb?.proxyUrl || "";
    r.tickoweb_event_id = s.tickoweb?.eventId || "";
    r.tickoweb_product_ids = s.tickoweb?.productIds || {};
  }
  return r;
}

/** Falls back to the in-code defaults when the row isn't readable (e.g. a portal session). */
export async function getSettings(): Promise<Settings> {
  const row = unwrap<Row | null>(await supabase.from("app_settings").select(COLUMNS).maybeSingle());
  return row ? rowToSettings(row as Row) : { vatLookup: defaultVatLookup, tickoweb: defaultTickoweb };
}

export async function updateSettings(patch: Settings): Promise<Settings> {
  const row = unwrap<Row | null>(
    await supabase.from("app_settings").update(settingsToRow(patch)).eq("id", true).select(COLUMNS).single(),
  );
  return rowToSettings(row as Row);
}
