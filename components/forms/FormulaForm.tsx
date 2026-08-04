"use client";

import { useState } from "react";
import BenefitFields from "@/components/forms/BenefitFields";
import Field from "@/components/ui/Field";
import { emptyFormula } from "@/lib/constants";
import type { Formula, Language, TranslateFn } from "@/types";

/* ---------- Formula form ---------- */

export default function FormulaForm({
  initial,
  onSave,
  onCancel,
  t = (k) => k,
  lang = "nl",
}: {
  initial?: Formula | null;
  onSave: (f: Formula) => void;
  onCancel: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [f, setF] = useState<Formula>({ ...emptyFormula, ...initial });
  const set = (k: string, val: unknown) => setF((p) => ({ ...p, [k]: val }) as Formula);
  return (
    <div>
      <div className="gr-grid2">
        <Field label={t("ff.name")}>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Gold / Silver / Bronze…" />
        </Field>
        <Field label={t("ff.cost")}>
          <input type="number" min="0" step="0.01" value={f.cost} onChange={(e) => set("cost", e.target.value)} />
        </Field>
      </div>
      <BenefitFields v={f} set={set} t={t} lang={lang} />
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!f.name.trim()} onClick={() => onSave(f)}>
          {t("ed.saveformula")}
        </button>
      </div>
    </div>
  );
}
