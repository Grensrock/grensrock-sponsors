"use client";

import { useEffect, useRef, useState } from "react";
import { defaultVatLookup, vatLookup } from "@/lib/integrations/vat-lookup";
import { cleanVat, validateVat, vatLookupMessage, vatMessage } from "@/lib/vat";
import type { Language, VatCompany, VatLookupConfig, VatLookupResult } from "@/types";

/* ============================================================
   VAT input — local validation + company registry check
   ============================================================
   Two things happen as you type:

     1. The number is validated offline (format + Belgian check
        digits). That feedback is instant and never leaves the browser.
     2. Once it is well-formed, it is looked up in the Belgian company
        registry through /api/vat/{vat}, which confirms the enterprise
        exists and returns its official name and registered address.

   Filling in: any field the form has left empty is filled from the
   registry straight away. Fields that already hold something different
   are never overwritten behind the user's back — they get a
   "Use these details" button instead.
   ============================================================ */

/** The sponsor fields a registry hit can fill. */
export interface VatFillTarget {
  companyName?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
}

const FIELDS: Array<[keyof VatFillTarget, keyof VatCompany]> = [
  ["companyName", "name"],
  ["street", "street"],
  ["houseNumber", "houseNumber"],
  ["postalCode", "postalCode"],
  ["city", "city"],
];

const same = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

/** Fields to change: `overwrite` includes ones that already differ, otherwise only empty ones. */
export function vatFillPatch(company: VatCompany, current: VatFillTarget, overwrite: boolean): VatFillTarget {
  const patch: VatFillTarget = {};
  for (const [field, source] of FIELDS) {
    const next = String(company[source] || "");
    const now = String(current[field] || "");
    if (!next || same(now, next)) continue;
    if (!now || overwrite) patch[field] = next;
  }
  return patch;
}

const hasConflict = (company: VatCompany, current: VatFillTarget) =>
  FIELDS.some(([field, source]) => {
    const next = String(company[source] || "");
    const now = String(current[field] || "");
    return !!next && !!now && !same(now, next);
  });

const addressLine = (c: VatCompany) =>
  [[c.street, c.houseNumber].filter(Boolean).join(" "), [c.postalCode, c.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

export default function VatInput({
  value,
  onChange,
  lang = "en",
  placeholder,
  cfg = defaultVatLookup,
  current,
  onApply,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  lang?: Language;
  placeholder?: string;
  /** Registry lookup runs only when this is enabled and `onApply` is given. */
  cfg?: VatLookupConfig | null;
  /** What the form currently holds, so filled-in values are never clobbered. */
  current?: VatFillTarget;
  onApply?: (patch: VatFillTarget, company: VatCompany) => void;
}) {
  const res = validateVat(value);
  const clean = cleanVat(value);
  const active = vatLookup.enabled(cfg) && !!onApply && !!res?.valid;

  /* `vat` records which number the rest of this state describes, so a state
     left over from the previous number is simply ignored on render rather
     than having to be cleared (which would mean a second render pass). */
  const [state, setState] = useState<{
    vat: string;
    busy: boolean;
    result: VatLookupResult | null;
    filled: boolean;
  }>({ vat: "", busy: false, result: null, filled: false });

  /* The form's other fields change while a lookup is in flight; these keep
     the debounced callback on the latest values without restarting it. */
  const currentRef = useRef(current);
  const applyRef = useRef(onApply);
  useEffect(() => {
    currentRef.current = current;
    applyRef.current = onApply;
  });

  const apply = (company: VatCompany, overwrite: boolean) => {
    const patch = vatFillPatch(company, currentRef.current || {}, overwrite);
    if (Object.keys(patch).length === 0) return false;
    applyRef.current?.(patch, company);
    return true;
  };

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    /* Debounced: people type or paste a VAT number in bursts, and every
       lookup costs a request against the registry quota. */
    const timer = setTimeout(async () => {
      setState({ vat: clean, busy: true, result: null, filled: false });
      try {
        const r = await vatLookup.lookup(clean, lang, ctl.signal);
        if (ctl.signal.aborted) return;
        /* Free fields get filled straight away; anything that would overwrite
           what the user typed waits for the button below. */
        const filled =
          r.status === "found" && !hasConflict(r.company, currentRef.current || {}) ? apply(r.company, false) : false;
        setState({ vat: clean, busy: false, result: r, filled });
      } catch {
        /* aborted — a newer number is already on its way */
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, active, lang]);

  const live = active && state.vat === clean ? state : null;
  const result = live?.result || null;
  const found = result?.status === "found" ? result.company : null;
  const conflict = found ? hasConflict(found, current || {}) : false;

  return (
    <>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder || "BE 0123.456.789"}
        style={res && !res.valid ? { borderColor: "var(--red)" } : undefined}
      />
      {res && !res.valid && (
        <span className="gr-hint" style={{ color: "var(--red)" }}>
          {vatMessage(res.code, lang)}
        </span>
      )}
      {res && res.valid && (
        <span className="gr-hint" style={{ color: "var(--green)" }}>
          ✓ {res.formatted}
        </span>
      )}

      {live?.busy && <span className="gr-hint">{vatLookupMessage("checking", lang)}</span>}

      {found && (
        <span className="gr-hint" style={{ color: found.active ? "var(--green)" : "var(--orange-deep)" }}>
          {found.active ? "✓ " : "⚠ "}
          {found.name}
          {addressLine(found) ? ` — ${addressLine(found)}` : ""}
          {!found.active && ` (${vatLookupMessage("inactive", lang)})`}
          {live?.filled && ` · ${vatLookupMessage("filled", lang)}`}
        </span>
      )}
      {found && conflict && (
        <button
          type="button"
          className="gr-mini"
          style={{ marginTop: 4 }}
          onClick={() => setState((p) => ({ ...p, filled: apply(found, true) }))}
        >
          {vatLookupMessage("use", lang)}
        </button>
      )}

      {result && result.status !== "found" && (
        <span
          className="gr-hint"
          style={{ color: result.status === "not_found" ? "var(--red)" : "var(--orange-deep)" }}
        >
          {result.status === "invalid" ? vatMessage(result.code, lang) : vatLookupMessage(result.status, lang)}
        </span>
      )}
    </>
  );
}
