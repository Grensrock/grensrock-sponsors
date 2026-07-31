import type { VoucherType } from "./voucher";

export type ViesMode = "manual" | "test" | "proxy";

export interface ViesConfig {
  mode: ViesMode;
  /** Your own server, e.g. https://api.grensrock.be/vies (it appends /{vat}). */
  proxyUrl: string;
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
  vies?: ViesConfig;
  tickoweb?: TickowebConfig;
  /** Legacy field from the shared-code era. */
  teamCode?: string;
}
