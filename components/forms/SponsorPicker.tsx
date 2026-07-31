"use client";

import { useMemo, useState } from "react";
import { contactName, primaryContact, sponsorContacts } from "@/lib/contacts";
import type { Sponsor, TranslateFn } from "@/types";

/* ---------- Sponsor picker (search + inline create) ---------- */

export default function SponsorPicker({
  sponsors,
  value,
  onChange,
  onCreateNew,
  locked,
  tr = (k) => k,
}: {
  sponsors: Sponsor[];
  value?: string;
  onChange: (id: string) => void;
  onCreateNew: () => void;
  locked?: boolean;
  tr?: TranslateFn;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = sponsors.find((s) => s.id === value);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = [...sponsors].sort((a, b) => a.companyName.localeCompare(b.companyName));
    if (!t) return list.slice(0, 8);
    return list
      .filter((s) =>
        [s.companyName, s.vatNumber, ...sponsorContacts(s).flatMap((c) => [contactName(c), c.email])].some((f) =>
          (f || "").toLowerCase().includes(t),
        ),
      )
      .slice(0, 8);
  }, [sponsors, q]);

  if (selected) {
    return (
      <div className="gr-picked">
        <div>
          <strong>{selected.companyName}</strong>
          {selected.contactName && <span className="gr-muted"> · {selected.contactName}</span>}
        </div>
        {!locked && (
          <button
            className="gr-mini"
            onClick={() => {
              onChange("");
              setQ("");
              setOpen(true);
            }}
          >
            {tr("pick.change")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="gr-picker">
      <input
        placeholder={tr("pick.search")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="gr-picker-list">
          {matches.map((s) => (
            <button
              key={s.id}
              className="gr-picker-item"
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
            >
              <strong>{s.companyName}</strong>
              <span className="gr-muted">
                {[s.vatNumber, contactName(primaryContact(s))].filter(Boolean).join(" · ") || " "}
              </span>
            </button>
          ))}
          {matches.length === 0 && <div className="gr-picker-none">{tr("pick.none")} &quot;{q}&quot;</div>}
          <button className="gr-picker-item gr-picker-new" onClick={onCreateNew}>
            {tr("pick.add")}
            {q.trim() ? ` "${q.trim()}"` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
