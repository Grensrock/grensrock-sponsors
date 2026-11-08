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
  /** Without it, the list offers no new sponsor: only picking one that exists. */
  onCreateNew?: () => void;
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

  /* Pressing a suggestion must not take focus from the search box first. On a
     phone that blur closes the keyboard, the screen resizes under the finger,
     and the tap ends on whatever moved there instead of the sponsor. */
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

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
              type="button"
              className="gr-picker-item"
              onMouseDown={keepFocus}
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
          {onCreateNew && (
            <button type="button" className="gr-picker-item gr-picker-new" onMouseDown={keepFocus} onClick={onCreateNew}>
              {tr("pick.add")}
              {q.trim() ? ` "${q.trim()}"` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
