"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { LANGS } from "@/lib/constants";
import { contactName, contactsFor } from "@/lib/contacts";
import { buildEmail } from "@/lib/email-templates";
import { validateEmail } from "@/lib/email-validate";
import type { Deal, Edition, Sponsor, TranslateFn } from "@/types";

/* ---------- Email preview modal ---------- */

export default function EmailModal({
  deal,
  sponsor,
  edition,
  onClose,
  onMarkSent,
  t = (k) => k,
}: {
  deal: Deal;
  sponsor: Sponsor;
  edition: Edition;
  onClose: () => void;
  onMarkSent: () => void;
  t?: TranslateFn;
}) {
  /* The contract is invoicing-related: send it to the invoicing contacts,
     falling back to whoever receives general information. */
  const invoiceContacts = contactsFor(sponsor, "invoice");
  const infoContacts = contactsFor(sponsor, "info");
  const recipients = (invoiceContacts.length ? invoiceContacts : infoContacts).filter(
    (c) => validateEmail(c.email)?.valid,
  );
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const main = recipients[idx] || recipients[0] || null;

  const { subject, body } = buildEmail(deal, sponsor, edition, main);
  const to = recipients.map((c) => c.email).join(",");
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  const mixedLangs = new Set(recipients.map((c) => c.language || "nl")).size > 1;

  return (
    <Modal title={t("em.title")} onClose={onClose} wide>
      {recipients.length === 0 ? (
        <p className="gr-muted" style={{ color: "var(--red)" }}>
          No contact with a valid email address for invoicing or information. Add one on the sponsor first, otherwise
          this contract can&apos;t be delivered.
        </p>
      ) : (
        <>
          <p className="gr-muted">
            To: <strong>{recipients.map((c) => `${contactName(c) || c.email}`).join(", ")}</strong>
            {" · "}Language: <strong>{LANGS[main?.language || "nl"]}</strong>
          </p>
          {recipients.length > 1 && (
            <Field
              label="Write in the language of"
              hint={
                mixedLangs
                  ? "These contacts prefer different languages — one text is sent to all of them."
                  : undefined
              }
            >
              <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
                {recipients.map((c, i) => (
                  <option key={c.id || i} value={i}>
                    {contactName(c) || c.email} ({(c.language || "nl").toUpperCase()})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
      <div className="gr-emailpreview">
        <div className="gr-email-subject">{subject}</div>
        <pre>{body}</pre>
      </div>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={copy}>
          {copied ? t("em.copied") : t("em.copy")}
        </button>
        {recipients.length > 0 && (
          <a className="gr-btn-ghost gr-btn-link" href={mailto}>
            {t("vo.openmail")}
          </a>
        )}
        <button className="gr-btn" onClick={onMarkSent}>
          {t("vo.marksent")}
        </button>
      </div>
    </Modal>
  );
}
