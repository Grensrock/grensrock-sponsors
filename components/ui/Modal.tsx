"use client";

import type { ReactNode } from "react";

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="gr-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"gr-modal" + (wide ? " gr-modal-wide" : "")}>
        <div className="gr-modal-head">
          <h3>{title}</h3>
          <button className="gr-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="gr-modal-body">{children}</div>
      </div>
    </div>
  );
}
