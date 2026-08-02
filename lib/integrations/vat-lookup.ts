import type { VatLookupConfig, VatLookupResult } from "@/types";

/* ============================================================
   VAT lookup — browser side
   ============================================================
   Thin wrapper around our own /api/vat/{vat} route, which holds the
   cbeapi.be key and does the actual registry call (see
   lib/integrations/cbe.ts). Nothing secret lives in this file, so it
   is safe in the client bundle.
   ============================================================ */

export const defaultVatLookup: VatLookupConfig = {
  mode: "cbe", // "manual" = off | "cbe" = Belgian company registry
};

export const vatLookup = {
  enabled: (cfg?: VatLookupConfig | null) => (cfg?.mode ?? defaultVatLookup.mode) === "cbe",

  /** Never throws: a network failure comes back as { status: "error" }. */
  async lookup(vat: string, lang = "nl", signal?: AbortSignal): Promise<VatLookupResult> {
    try {
      const res = await fetch(`/api/vat/${encodeURIComponent(vat)}?lang=${encodeURIComponent(lang)}`, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (res.status === 401) return { status: "unavailable" };
      return (await res.json()) as VatLookupResult;
    } catch (ex) {
      if ((ex as Error)?.name === "AbortError") throw ex; // the caller moved on; not a failure
      return { status: "error", message: "Could not reach the VAT check." };
    }
  },
};
