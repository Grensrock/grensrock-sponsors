"use client";

import { useState } from "react";
import BenefitFields from "@/components/forms/BenefitFields";
import Field from "@/components/ui/Field";
import { FORMULA_COLORS, NO_FORMULA_COLOR, nextFormulaColor, normColor } from "@/lib/color";
import { emptyFormula } from "@/lib/constants";
import type { Formula, Language, TranslateFn } from "@/types";

/* ---------- Formula form ---------- */

export default function FormulaForm({
  initial,
  usedColors = [],
  onSave,
  onCancel,
  t = (k) => k,
  lang = "nl",
}: {
  initial?: Formula | null;
  /** The colours the edition's other formulas already have; a new one starts on a free swatch. */
  usedColors?: string[];
  onSave: (f: Formula) => void;
  onCancel: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [f, setF] = useState<Formula>(() =>
    initial ? { ...emptyFormula, ...initial } : { ...emptyFormula, color: nextFormulaColor(usedColors) },
  );
  const set = (k: string, val: unknown) => setF((p) => ({ ...p, [k]: val }) as Formula);
  const color = normColor(f.color);
  const customColor = color !== "" && !FORMULA_COLORS.includes(color);
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
      <Field label={t("ff.color")} hint={t("ff.colorhint")} group>
        <div className="gr-swatches">
          {FORMULA_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={"gr-swatch" + (color === c ? " on" : "")}
              style={{ background: c }}
              title={c}
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => set("color", c)}
            />
          ))}
          {/* Any other colour: the native picker, under a rainbow swatch until
              it holds the formula's colour itself. */}
          <label
            className={"gr-swatch gr-swatch-custom" + (customColor ? " on" : "")}
            style={customColor ? { background: color } : undefined}
            title={t("ff.colorother")}
          >
            <input
              type="color"
              value={color || NO_FORMULA_COLOR}
              onChange={(e) => set("color", e.target.value)}
              aria-label={t("ff.colorother")}
            />
          </label>
        </div>
      </Field>
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
