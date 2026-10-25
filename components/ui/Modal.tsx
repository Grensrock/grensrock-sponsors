"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Language } from "@/types";

/* Only the close button carries text, and only for screen readers. */
const CLOSE: Record<Language, string> = { nl: "Sluiten", fr: "Fermer", en: "Close" };

/* What a click beside a form asks before it throws the form away. */
const LEAVE: Record<Language, { title: string; message: string; stay: string; leave: string }> = {
  nl: {
    title: "Weet u het zeker?",
    message: "Wat u niet opsloeg, gaat verloren.",
    stay: "Verder bewerken",
    leave: "Sluiten zonder opslaan",
  },
  fr: {
    title: "Êtes-vous sûr ?",
    message: "Ce qui n'est pas enregistré sera perdu.",
    stay: "Continuer",
    leave: "Fermer sans enregistrer",
  },
  en: {
    title: "Are you sure?",
    message: "Anything you haven't saved will be lost.",
    stay: "Keep editing",
    leave: "Close without saving",
  },
};

export default function Modal({
  title,
  onClose,
  children,
  wide,
  lang = "nl",
  confirmOutsideClick,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  lang?: Language;
  /** For a form: a click beside the modal asks first instead of closing it, so
      a stray click doesn't throw away what was typed. ✕ and the form's own
      Cancel are deliberate, and still close straight away. */
  confirmOutsideClick?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  /* A click only counts as one beside the modal when it also started there:
     selecting text in a field and letting go past the modal's edge ends as a
     click on the backdrop too. */
  const downOnBackdrop = useRef(false);
  const leave = LEAVE[lang];
  return (
    <>
      <div
        className="gr-overlay"
        onMouseDown={(e) => {
          downOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (e.target !== e.currentTarget || !downOnBackdrop.current) return;
          if (confirmOutsideClick) setAsking(true);
          else onClose();
        }}
      >
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
      {/* A sibling rather than inside .gr-modal: its pop-in animation transforms
          it, which would pin this fixed overlay to the modal, not the screen. */}
      {asking && (
        <Modal title={leave.title} onClose={() => setAsking(false)} lang={lang}>
          <p style={{ margin: "0 0 8px" }}>{leave.message}</p>
          <div className="gr-actions">
            <button className="gr-btn-ghost" onClick={() => setAsking(false)} autoFocus>
              {leave.stay}
            </button>
            <button className="gr-btn gr-btndanger" onClick={onClose}>
              {leave.leave}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
