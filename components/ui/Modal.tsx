"use client";

import type { ReactNode } from "react";
import type { Language } from "@/types";

/* Only the close button carries text, and only for screen readers. */
const CLOSE: Record<Language, string> = { nl: "Sluiten", fr: "Fermer", en: "Close" };

export default function Modal({
  title,
  onClose,
  children,
  wide,
  lang = "nl",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  lang?: Language;
}) {
  return (
    <div className="gr-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"gr-modal" + (wide ? " gr-modal-wide" : "")}>
        <div className="gr-modal-head">
          <h3>{title}</h3>
          <button className="gr-x" onClick={onClose} aria-label={CLOSE[lang]}>
            ✕
          </button>
        </div>
        <div className="gr-modal-body">{children}</div>
      </div>
    </div>
  );
}
