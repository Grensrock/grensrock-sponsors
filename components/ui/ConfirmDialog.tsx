"use client";

import Modal from "@/components/ui/Modal";

/* In-app confirm/alert — window.confirm is blocked in sandboxed frames */
export interface DialogSpec {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
}

export default function ConfirmDialog({
  dialog,
  onClose,
}: {
  dialog: DialogSpec | null;
  onClose: () => void;
}) {
  if (!dialog) return null;
  const { title, message, confirmLabel, danger, onConfirm } = dialog;
  return (
    <Modal title={title || "Please confirm"} onClose={onClose}>
      <p style={{ whiteSpace: "pre-line", margin: "0 0 8px" }}>{message}</p>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onClose}>
          {onConfirm ? "Cancel" : "OK"}
        </button>
        {onConfirm && (
          <button
            className={"gr-btn" + (danger ? " gr-btndanger" : "")}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel || "Confirm"}
          </button>
        )}
      </div>
    </Modal>
  );
}
