import type { VoucherType } from "./voucher";

/** "manual" = off, enter company details by hand. "cbe" = look them up in the Belgian registry. */
export type VatLookupMode = "manual" | "cbe";

export interface VatLookupConfig {
  mode: VatLookupMode;
}

export type TickowebMode = "manual" | "live";

export interface TickowebConfig {
  mode: TickowebMode;
  baseUrl: string;
  /** Your own server that holds the API key. */
  proxyUrl: string;
  apiKey: string;
  eventId: string;
  /** Voucher type -> Tickoweb product/ticket-type id. */
  productIds: Partial<Record<VoucherType, string>>;
}

export interface Settings {
  vatLookup?: VatLookupConfig;
  tickoweb?: TickowebConfig;
  /** Legacy field from the shared-code era. */
  teamCode?: string;
}
