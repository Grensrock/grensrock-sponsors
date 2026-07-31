"use client";

import type { ReactNode } from "react";

export default function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="gr-field">
      <span className="gr-label">{label}</span>
      {children}
      {hint && <span className="gr-hint">{hint}</span>}
    </label>
  );
}
