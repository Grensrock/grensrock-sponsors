"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import { emptyEdition } from "@/lib/constants";
import type { Edition, TranslateFn } from "@/types";

/* ---------- Edition form ---------- */

export default function EditionForm({
  initial,
  onSave,
  onCancel,
  t = (k) => k,
}: {
  initial?: Edition | null;
  onSave: (ed: Edition) => void;
  onCancel: () => void;
  t?: TranslateFn;
}) {
  const [ed, setEd] = useState<Edition>({ id: "", ...emptyEdition, ...initial });
  const set = (k: keyof Edition) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEd({ ...ed, [k]: e.target.value } as Edition);
  const valid = ed.name.trim().length > 0;
  return (
    <div>
      <Field label="Edition name *">
        <input value={ed.name} onChange={set("name")} placeholder="Grensrock 2026" />
      </Field>
      <div className="gr-grid2">
        <Field label="Start date">
          <input type="date" value={ed.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="End date">
          <input type="date" value={ed.endDate} onChange={set("endDate")} />
        </Field>
      </div>
      <Field label="Location">
        <input value={ed.location} onChange={set("location")} placeholder="Menen" />
      </Field>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="gr-btn" disabled={!valid} onClick={() => onSave(ed)}>
          {t("ed.saveedition")}
        </button>
      </div>
    </div>
  );
}
