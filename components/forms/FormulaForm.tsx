"use client";

import { useState } from "react";
import BenefitFields from "@/components/forms/BenefitFields";
import Field from "@/components/ui/Field";
import { emptyFormula } from "@/lib/constants";
import type { Formula, TranslateFn } from "@/types";

/* ---------- Formula form ---------- */

export default function FormulaForm({
  initial,
  onSave,
  onCancel,
  t = (k) => k,
}: {
  initial?: Formula | null;
  onSave: (f: Formula) => void;
  onCancel: () => void;
  t?: TranslateFn;
}) {
  const [f, setF] = useState<Formula>({ ...emptyFormula, ...initial });
  const set = (k: string, val: unknown) => setF((p) => ({ ...p, [k]: val }) as Formula);
  return (
    <div>
      <div className="gr-grid2">
        <Field label="Formula name *">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Gold / Silver / Bronze…" />
        </Field>
        <Field label="Cost (€) *">
          <input type="number" min="0" step="0.01" value={f.cost} onChange={(e) => set("cost", e.target.value)} />
        </Field>
      </div>
      <BenefitFields v={f} set={set} />
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="gr-btn" disabled={!f.name.trim()} onClick={() => onSave(f)}>
          {t("ed.saveformula")}
        </button>
      </div>
    </div>
  );
}
