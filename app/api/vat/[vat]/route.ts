import { NextResponse, type NextRequest } from "next/server";
import { CbeError, cbeLang, fetchCompany } from "@/lib/integrations/cbe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { belgianEnterpriseNumber, validateVat, vatCountry } from "@/lib/vat";
import type { VatLookupResult } from "@/types";

/* ============================================================
   GET /api/vat/{vat}?lang=nl — check a VAT number
   ============================================================
   Two layers, in this order:

     1. Local validation (lib/vat.ts): country prefix, per-country
        format, and for Belgian numbers the modulo-97 check digits.
        A number that fails here never leaves the server.
     2. The Belgian company registry (lib/integrations/cbe.ts), which
        confirms the enterprise actually exists and hands back the
        official name and registered address to fill the form with.

   This route exists because the registry key is a server secret — see
   the banner in lib/integrations/cbe.ts. Sign-in is required (any
   session: team member or sponsor-portal contact) so the key can't be
   turned into a public lookup service by anyone who finds the URL.

   Always returns a VatLookupResult; the HTTP status mirrors it so a
   plain `fetch` in the browser can still tell a real failure apart.
   ============================================================ */

const json = (result: VatLookupResult, status = 200) => NextResponse.json(result, { status });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/vat/[vat]">) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { vat } = await ctx.params;
  const raw = decodeURIComponent(vat || "");

  const local = validateVat(raw);
  if (!local) return json({ status: "invalid", code: "format" }, 400);
  if (!local.valid) return json({ status: "invalid", code: local.code }, 400);

  /* The CBE registry only knows Belgian enterprises. A valid FR/NL/… number
     is not wrong — we simply can't look its details up here. */
  const number = belgianEnterpriseNumber(raw);
  if (!number) return json({ status: "unsupported_country", country: vatCountry(raw) });

  try {
    const company = await fetchCompany(number, cbeLang(request.nextUrl.searchParams.get("lang")));
    if (!company) return json({ status: "not_found" });
    return json({ status: "found", company });
  } catch (ex) {
    if (ex instanceof CbeError && ex.status === 503) return json({ status: "unavailable" }, 503);
    const message = ex instanceof CbeError ? ex.message : "The VAT check failed. Try again in a moment.";
    return json({ status: "error", message }, ex instanceof CbeError ? ex.status : 502);
  }
}
