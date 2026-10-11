/* ============================================================
   VOUCHERS + TICKOWEB
   ============================================================
   The Tickoweb OpenAPI reference at https://openapi.tickoweb.be/v1
   could not be read when this was written, so the exact endpoint
   paths, payload shape and auth header below are ASSUMPTIONS.
   Everything Tickoweb-specific lives in this one module: adjust
   ENDPOINTS/payloads here once you have the real spec and the rest
   of the app keeps working unchanged.

   Modes:
   - "manual" (default): nothing is called. The team creates the
     voucher in Tickoweb and pastes the code back in. Works today.
   - "live": calls the API. Needs a server-side proxy — see note
     in the settings screen about the API key and CORS.
   ============================================================ */

import { productKey } from "@/lib/vouchers";
import type { Edition, Sponsor, TickowebConfig, Voucher } from "@/types";

export const defaultTickoweb: TickowebConfig = {
  mode: "manual", // "manual" | "live"
  baseUrl: "https://openapi.tickoweb.be/v1",
  proxyUrl: "", // your own server that holds the API key
  apiKey: "",
  eventId: "",
  productIds: {}, // "drink:27.50" (or just the type, as fallback) -> Tickoweb product/ticket-type id
};

export interface VoucherRecipient {
  name: string;
  email: string;
}

export interface TickowebCreateArgs {
  voucher: Voucher;
  sponsor?: Sponsor | null;
  edition?: Edition | null;
  recipient?: VoucherRecipient | null;
}

export interface TickowebResult {
  manual?: boolean;
  code?: string;
  url?: string;
}

interface TickowebVoucherResponse {
  code?: string;
  id?: string;
  url?: string;
  downloadUrl?: string;
}

/* --- The only place that talks to Tickoweb --- */
export const tickoweb = {
  configured(cfg?: TickowebConfig | null) {
    return cfg?.mode === "live" && !!(cfg.proxyUrl || (cfg.baseUrl && cfg.apiKey));
  },
  _url(cfg: TickowebConfig, path: string) {
    return (cfg.proxyUrl ? cfg.proxyUrl.replace(/\/$/, "") : cfg.baseUrl.replace(/\/$/, "")) + path;
  },
  async _call(cfg: TickowebConfig, path: string, method: string, body?: unknown) {
    const res = await fetch(this._url(cfg, path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey && !cfg.proxyUrl ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new Error(`Tickoweb ${method} ${path} → ${res.status} ${res.statusText}`);
    return res.json();
  },
  /* Create a voucher and (optionally) let Tickoweb email it to the recipient */
  async create(cfg: TickowebConfig, { voucher, sponsor, edition, recipient }: TickowebCreateArgs): Promise<TickowebResult> {
    if (!this.configured(cfg)) {
      // Manual mode: nothing is called; the team fills in the code afterwards
      return { manual: true };
    }
    const data: TickowebVoucherResponse = await this._call(cfg, "/vouchers", "POST", {
      eventId: cfg.eventId || undefined,
      productId:
        cfg.productIds?.[productKey(voucher.type, voucher.value)] || cfg.productIds?.[voucher.type] || undefined,
      value: voucher.value || undefined,
      reference: `${edition?.name || ""} · ${sponsor?.companyName || ""}`.trim(),
      recipient: recipient?.email ? { name: recipient.name, email: recipient.email } : undefined,
    });
    return { code: data.code || data.id || "", url: data.url || data.downloadUrl || "" };
  },
  async send(
    cfg: TickowebConfig,
    { voucher, recipient }: { voucher: Voucher; recipient?: VoucherRecipient | null },
  ): Promise<TickowebResult> {
    if (!this.configured(cfg)) return { manual: true };
    await this._call(cfg, `/vouchers/${encodeURIComponent(voucher.code)}/send`, "POST", {
      email: recipient?.email,
      name: recipient?.name,
    });
    return {};
  },
  async cancel(cfg: TickowebConfig, { voucher }: { voucher: Voucher }): Promise<TickowebResult> {
    if (!this.configured(cfg)) return { manual: true };
    await this._call(cfg, `/vouchers/${encodeURIComponent(voucher.code)}`, "DELETE");
    return {};
  },
};
