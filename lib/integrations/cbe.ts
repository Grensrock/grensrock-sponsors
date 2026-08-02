import { normStr } from "@/lib/normalize";
import type { VatCompany } from "@/types";

/* ============================================================
   CBE / KBO / BCE registry (cbeapi.be) — SERVER ONLY
   ============================================================
   Official Belgian Crossroads Bank for Enterprises data: company
   name, legal form, registered seat, juridical situation.

   Docs: https://cbeapi.be/docs/api
   Auth: `Authorization: Bearer <CBE_API_KEY>` — the key is a server
   secret, so this module must never be imported from a "use client"
   file. The browser talks to app/api/vat/[vat]/route.ts instead.

   Endpoint used:
     GET /api/v1/company/{cbeNumber}?lang=nl
       200 -> { data: CompanyResource }
       404 -> { errors: [{ message: "Company not found" }] }
     Response headers X-Data-Freshness (monthly|live) and X-Data-As-Of
     say how fresh the served snapshot is; the free plan is a monthly
     freeze, which is why lookups are cached for a day below.
   ============================================================ */

const CBE_BASE = "https://cbeapi.be/api/v1";

/** The registry speaks fr/nl/de; the app's English falls back to Dutch. */
export type CbeLang = "nl" | "fr" | "de";
export const cbeLang = (lang: unknown): CbeLang => (normStr(lang).toLowerCase() === "fr" ? "fr" : "nl");

export class CbeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CbeError";
  }
}

interface CbeAddress {
  street?: string | null;
  street_number?: string | null;
  box?: string | null;
  post_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  date_striking_off?: string | null;
}

interface CbeCompany {
  cbe_number?: string;
  cbe_number_formatted?: string;
  denomination?: string | null;
  abbreviation?: string | null;
  commercial_name?: string | null;
  denomination_with_legal_form?: string | null;
  juridical_form?: string | null;
  juridical_form_short?: string | null;
  address?: CbeAddress | null;
  status?: string | null;
  juridical_situation?: string | null;
  juridical_situation_code?: string | null;
  type?: string | null;
}

export const cbeConfigured = () => !!process.env.CBE_API_KEY;

/**
 * Look an enterprise number up in the registry.
 * Returns null when the registry has no such enterprise (HTTP 404).
 * Throws CbeError for anything else (no key, rate limit, upstream down).
 */
export async function fetchCompany(enterpriseNumber: string, lang: CbeLang = "nl"): Promise<VatCompany | null> {
  const key = process.env.CBE_API_KEY;
  if (!key) throw new CbeError("The VAT registry key is not configured on the server.", 503);

  const number = enterpriseNumber.replace(/\D/g, "");
  if (number.length !== 10) throw new CbeError("Not a Belgian enterprise number.", 400);

  let res: Response;
  try {
    res = await fetch(`${CBE_BASE}/company/${number}?lang=${lang}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      // The free plan serves a monthly snapshot, so a day-long cache costs no
      // freshness and keeps the request quota for numbers we haven't seen yet.
      next: { revalidate: 86_400 },
    });
  } catch {
    throw new CbeError("Could not reach the company registry.", 502);
  }

  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new CbeError("The VAT registry rejected our API key.", 502);
  if (res.status === 429) throw new CbeError("Too many registry lookups right now — try again shortly.", 429);
  if (!res.ok) throw new CbeError(`The company registry returned an error (${res.status}).`, 502);

  let body: { data?: CbeCompany };
  try {
    body = (await res.json()) as { data?: CbeCompany };
  } catch {
    throw new CbeError("The company registry sent an unreadable response.", 502);
  }
  if (!body.data) return null;

  return toVatCompany(body.data, res.headers.get("X-Data-As-Of") || "");
}

function toVatCompany(d: CbeCompany, dataAsOf: string): VatCompany {
  const a = d.address || {};
  const number = normStr(d.cbe_number).replace(/\D/g, "");
  /* A box number is part of the address but has its own field upstream. */
  const box = normStr(a.box).replace(/^\.$/, ""); // the feed uses "." for "no box"
  const houseNumber = [normStr(a.street_number), box && `bus ${box}`].filter(Boolean).join(" ");

  return {
    vatNumber: number.length === 10 ? `BE ${number.slice(0, 4)}.${number.slice(4, 7)}.${number.slice(7)}` : "",
    enterpriseNumber: number,
    name: normStr(d.denomination_with_legal_form) || normStr(d.denomination) || normStr(d.commercial_name),
    shortName: normStr(d.denomination) || normStr(d.commercial_name),
    legalForm: normStr(d.juridical_form_short) || normStr(d.juridical_form),
    entityType: normStr(d.type) === "natural_person" ? "person" : "legal",
    street: normStr(a.street),
    houseNumber,
    postalCode: normStr(a.post_code),
    city: normStr(a.city),
    country: normStr(a.country_code).toUpperCase() || "BE",
    /* "active" is the registry's own verdict; a struck-off seat is the other
       way an entity shows up as no longer trading. */
    active: (!d.status || d.status === "active") && !a.date_striking_off,
    situation: normStr(d.juridical_situation),
    dataAsOf,
  };
}
