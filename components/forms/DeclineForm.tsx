"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import type { Edition, Sponsor, TranslateFn } from "@/types";

/* ---------- Record that a sponsor won't sponsor an edition ---------- */

export default function DeclineForm({
  sponsor,
  editions,
  onSave,
  onCancel,
  t = (k) => k,
}: {
  sponsor?: Sponsor;
  /** Editions this sponsor has neither an agreement nor a decline for, newest first. */
  editions: Edition[];
  onSave: (editionId: string, reason: string) => void;
  onCancel: () => void;
  t?: TranslateFn;
}) {
  /* The edition being worked on is usually the active one. */
  const [editionId, setEditionId] = useState((editions.find((e) => e.active) || editions[0])?.id || "");
  const [reason, setReason] = useState("");
  if (editions.length === 0)
    return (
      <div>
        <p className="gr-empty">{t("dc.none")}</p>
        <div className="gr-actions">
          <button className="gr-btn-ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  return (
    <div>
      {sponsor && <p className="gr-muted">{sponsor.companyName}</p>}
      <Field label={t("dc.edition")}>
        <select value={editionId} onChange={(e) => setEditionId(e.target.value)}>
          {editions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("dc.reason")} hint={t("dc.reasonhint")}>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!editionId} onClick={() => onSave(editionId, reason)}>
          {t("dc.save")}
        </button>
      </div>
    </div>
  );
}
