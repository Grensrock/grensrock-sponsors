"use client";

import type { ReactNode } from "react";

/* A <label> by default, so tapping the caption focuses the input. A field
   whose content is buttons of its own (a picker, a list of choices) should
   pass group: inside a label every tap is also handed to the label's input,
   and on iOS Safari that refocuses it — the keyboard comes back, the layout
   jumps, and the button that was tapped never gets the click. */
export default function Field({
  label,
  children,
  hint,
  group,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  group?: boolean;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="gr-field" role={group ? "group" : undefined}>
      <span className="gr-label">{label}</span>
      {children}
      {hint && <span className="gr-hint">{hint}</span>}
    </Tag>
  );
}
