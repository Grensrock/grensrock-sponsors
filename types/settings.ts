import type { VoucherType } from "./voucher";

/** "manual" = off, enter company details by hand. "cbe" = look them up in the Belgian registry. */
export type VatLookupMode = "manual" | "cbe";

export interface VatLookupConfig {
  mode: VatLookupMode;
}

/** A Tickoweb product: a voucher type with its amount ("drink:27.50"), or the type alone. */
export type ProductKey = VoucherType | `${VoucherType}:${string}`;

export type TickowebMode = "manual" | "live";

export interface TickowebConfig {
  mode: TickowebMode;
  baseUrl: string;
  /** Your own server that holds the API key. */
  proxyUrl: string;
  apiKey: string;
  eventId: string;
  /** Tickoweb product/ticket-type id, keyed by voucher type and amount ("drink:27.50"),
      or by type alone as the fallback for every amount of that type. */
  productIds: Partial<Record<ProductKey, string>>;
}

export interface Settings {
  vatLookup?: VatLookupConfig;
  tickoweb?: TickowebConfig;
  /** Legacy field from the shared-code era. */
  teamCode?: string;
}
