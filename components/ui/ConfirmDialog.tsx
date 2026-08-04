"use client";

import Modal from "@/components/ui/Modal";
import type { Language, TranslateFn } from "@/types";

/* In-app confirm/alert — window.confirm is blocked in sandboxed frames */
export interface DialogSpec {
  title?: string;
  /** Translated by this component, for callers that have no `t` of their own. */
  titleKey?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
}

export default function ConfirmDialog({
  dialog,
  onClose,
  t = (k) => k,
  lang = "nl",
}: {
  dialog: DialogSpec | null;
  onClose: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  if (!dialog) return null;
  const { title, titleKey, message, confirmLabel, danger, onConfirm } = dialog;
  return (
    <Modal title={title || t(titleKey || "dlg.confirm")} onClose={onClose} lang={lang}>
      <p style={{ whiteSpace: "pre-line", margin: "0 0 8px" }}>{message}</p>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onClose}>
          {onConfirm ? t("common.cancel") : t("dlg.ok")}
        </button>
        {onConfirm && (
          <button
            className={"gr-btn" + (danger ? " gr-btndanger" : "")}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel || t("common.confirm")}
          </button>
        )}
      </div>
    </Modal>
  );
}
