/* ============================================================
   VIES API (viesapi.eu) — company lookup by EU VAT number
   ============================================================
   Endpoints (documented at viesapi.eu/vies-rest-api-documentation):
     GET /get/vies/euvat/{euvat}        → name + address (one string)
     GET /get/vies/euvat/parsed/{euvat} → name + split address components
   Auth is HMAC-SHA256 or Basic, with a PRIVATE key. That key must never sit
   in a browser, and the Authorization header can't be sent cross-origin from
   one anyway, so live lookups go through a small proxy of your own that holds
   the credentials. Until that exists, "test" mode uses the public test service
   (no account needed) and "manual" mode simply does nothing.
   ============================================================ */

import { normStr } from "@/lib/normalize";
import type { ViesConfig } from "@/types";

export const defaultVies: ViesConfig = {
  mode: "manual", // "manual" | "test" | "proxy"
  proxyUrl: "", // your server, e.g. https://api.grensrock.be/vies  (it appends /{vat})
};

export interface ViesLookupResult {
  valid: boolean;
  name: string;
  legalForm: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  raw: unknown;
}

interface ViesResponse {
  code?: string;
  description?: string;
  valid?: boolean;
  traderName?: string;
  countryCode?: string;
  traderAddressComponent?: {
    street?: string;
    streetNumber?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  traderNameComponents?: {
    name?: string;
    legalFromCanonicalName?: string;
    legalForm?: string;
  };
}

export const vies = {
  enabled: (cfg?: ViesConfig | null) => cfg?.mode === "test" || (cfg?.mode === "proxy" && !!cfg.proxyUrl),

  /* Look a VAT number up. Returns { valid, name, street, houseNumber, postalCode, city, country, raw } */
  async lookup(cfg: ViesConfig, vatRaw: unknown): Promise<ViesLookupResult> {
    const euvat = normStr(vatRaw).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    if (!euvat) throw new Error("Enter a VAT number first.");

    let url: string;
    if (cfg.mode === "proxy") {
      url = cfg.proxyUrl.replace(/\/$/, "") + "/" + euvat;
    } else if (cfg.mode === "test") {
      // public test service accepts these credentials in the URL; only test numbers return data
      url = `https://test_id:test_key@viesapi.eu/api-test/get/vies/euvat/parsed/${euvat}`;
    } else {
      throw new Error("VAT lookup isn't switched on. An admin can enable it under VAT lookup settings.");
    }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok)
      throw new Error(
        `Lookup failed (${res.status}). ${res.status === 404 ? "Unknown VAT number." : "Try again later."}`,
      );
    const d: ViesResponse = await res.json();
    if (d.code) throw new Error(d.description || `VIES error ${d.code}`);

    const ac = d.traderAddressComponent || {};
    const nc = d.traderNameComponents || {};
    return {
      valid: d.valid !== false,
      name: nc.name || d.traderName || "",
      legalForm: nc.legalFromCanonicalName || nc.legalForm || "",
      street: ac.street || "",
      houseNumber: ac.streetNumber || ac.houseNumber || "",
      postalCode: ac.postalCode || "",
      city: ac.city || "",
      country: ac.country || d.countryCode || "",
      raw: d,
    };
  },
};
