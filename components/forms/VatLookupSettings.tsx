"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import { defaultVatLookup } from "@/lib/integrations/vat-lookup";
import type { TranslateFn, VatLookupConfig, VatLookupMode } from "@/types";

/* ---------- VAT lookup settings ---------- */

export default function VatLookupSettings({
  value,
  onSave,
  onCancel,
  t = (k) => k,
}: {
  value?: VatLookupConfig | null;
  onSave: (cfg: VatLookupConfig) => void;
  onCancel: () => void;
  t?: TranslateFn;
}) {
  const [c, setC] = useState<VatLookupConfig>({ ...defaultVatLookup, ...value });
  return (
    <div>
      <Field label={t("vl.mode")}>
        <select value={c.mode} onChange={(e) => setC({ ...c, mode: e.target.value as VatLookupMode })}>
          <option value="cbe">{t("vl.on")}</option>
          <option value="manual">{t("vl.off")}</option>
        </select>
      </Field>
      {c.mode === "cbe" && (
        <p className="gr-blockbanner">
          A VAT number that passes the format and check-digit test is looked up in the Crossroads Bank for Enterprises.
          If the company is there, its official name and registered address are filled in — fields you already filled in
          yourself are never overwritten without asking. The registry only covers Belgium; foreign VAT numbers are still
          format-checked, but their details have to be typed in.
        </p>
      )}
      <p className="gr-muted">
        The VAT number itself is always validated locally, regardless of this setting. Lookups run through the server, so
        the registry API key never reaches a browser.
      </p>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" onClick={() => onSave(c)}>
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
