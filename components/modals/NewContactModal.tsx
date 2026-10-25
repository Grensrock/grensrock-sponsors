"use client";

import { useState } from "react";
import EmailInput from "@/components/ui/EmailInput";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { COMM_LABELS, LANGS, emptyContact, label, uid, type CommKey } from "@/lib/constants";
import { contactName, sponsorContacts } from "@/lib/contacts";
import { emailToStore, sameEmail, validateEmail } from "@/lib/email-validate";
import type { Contact, Language, Sponsor, TranslateFn } from "@/types";

/* ---------- Add a contact from the overview (needs a sponsor picker) ---------- */

export default function NewContactModal({
  sponsors,
  pickableSponsors = sponsors,
  onSave,
  onClose,
  t = (k) => k,
  lang = "nl",
}: {
  sponsors: Sponsor[];
  /** The ones this person may add a contact to; `sponsors` is still searched for duplicates. */
  pickableSponsors?: Sponsor[];
  onSave: (sponsorId: string, contact: Contact) => void;
  onClose: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [sponsorId, setSponsorId] = useState("");
  const [q, setQ] = useState("");
  const [contact, setContact] = useState<Contact>({
    id: "",
    ...emptyContact,
    prefs: { ...emptyContact.prefs },
  });
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setContact({ ...contact, [k]: e.target.value } as Contact);

  const sponsor = sponsors.find((s) => s.id === sponsorId);
  const matches = q.trim()
    ? pickableSponsors.filter((s) => s.companyName.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];
  const mailRes = validateEmail(contact.email);
  const emailOk = !!contact.email && !!mailRes && mailRes.valid;
  /* Duplicate within the chosen sponsor */
  const dupe =
    sponsor && emailOk ? sponsorContacts(sponsor).find((c) => c.email && sameEmail(c.email, contact.email)) : null;
  /* Same email already known under other sponsors — worth flagging, not blocking */
  const elsewhere = emailOk
    ? sponsors.filter(
        (s) => s.id !== sponsorId && sponsorContacts(s).some((c) => c.email && sameEmail(c.email, contact.email)),
      )
    : [];
  const valid =
    sponsorId && (contact.firstName.trim() || contact.lastName.trim()) && (!mailRes || mailRes.valid) && !dupe;

  return (
    <Modal title={t("sd.addcontact").replace("+ ", "")} onClose={onClose} wide lang={lang} confirmOutsideClick>
      {!sponsor ? (
        <>
          <Field label={t("c.company")}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} autoFocus />
          </Field>
          {matches.length > 0 && (
            <div className="gr-pickerlist">
              {matches.map((sp) => (
                <button
                  key={sp.id}
                  className="gr-pickeritem"
                  onClick={() => {
                    setSponsorId(sp.id);
                    setQ("");
                  }}
                >
                  <strong>{sp.companyName}</strong>
                  {sp.city && <span className="gr-muted"> · {sp.city}</span>}
                  <span className="gr-muted">
                    {" "}
                    · {sponsorContacts(sp).length} {t("nav.contacts").toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          )}
          {q.trim() && matches.length === 0 && <p className="gr-muted">{t("nc.nosponsor")}</p>}
        </>
      ) : (
        <>
          <div className="gr-pickedspon">
            <span>
              <strong>{sponsor.companyName}</strong>
              {sponsor.city ? ` · ${sponsor.city}` : ""}
            </span>
            <button className="gr-mini" onClick={() => setSponsorId("")}>
              {t("common.edit")}
            </button>
          </div>

          <div className="gr-grid2">
            <Field label={t("uf.firstname").replace(" *", "")}>
              <input value={contact.firstName} onChange={set("firstName")} placeholder="Jan" />
            </Field>
            <Field label={t("uf.lastname")}>
              <input value={contact.lastName} onChange={set("lastName")} placeholder="Peeters" />
            </Field>
          </div>
          <div className="gr-grid2">
            <Field label={t("c.email")}>
              <EmailInput value={contact.email} onChange={set("email")} />
            </Field>
            <Field label={t("c.phone")}>
              <input value={contact.phone} onChange={set("phone")} />
            </Field>
          </div>
          <div className="gr-grid2">
            <Field label={t("c.language")}>
              <select value={contact.language} onChange={set("language")}>
                {Object.entries(LANGS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field group label={t("c.receives")}>
              <div className="gr-checkrow" style={{ paddingTop: 6 }}>
                {(Object.keys(COMM_LABELS) as CommKey[]).map((k) => {
                  const on = !!contact.prefs && !!contact.prefs[k];
                  return (
                    <label key={k} className={"gr-check gr-check-sm" + (on ? " on" : "")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setContact({ ...contact, prefs: { ...(contact.prefs || {}), [k]: e.target.checked } })
                        }
                      />
                      {label(COMM_LABELS, k, lang)}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>

          <label
            className={"gr-check" + (contact.portalAccess ? " on" : "") + (emailOk ? "" : " gr-check-disabled")}
            style={{ marginBottom: 12 }}
          >
            <input
              type="checkbox"
              checked={!!contact.portalAccess}
              disabled={!emailOk}
              onChange={(e) => setContact({ ...contact, portalAccess: e.target.checked })}
            />
            {t("nc.portalaccess")}
          </label>
          <p className="gr-muted" style={{ marginTop: -6, fontSize: 12 }}>
            {emailOk ? t("nc.portalhint") : t("nc.portalneedsmail")}
          </p>

          {dupe && (
            <p className="gr-blockbanner" style={{ background: "#FCEBEA", color: "var(--red)" }}>
              {sponsor.companyName} {t("nc.dupehas")} {contact.email} ({contactName(dupe) || "?"}).{" "}
              {t("nc.dupeblock")}
            </p>
          )}
          {!dupe && elsewhere.length > 0 && (
            <p className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
              {t("nc.elsewhere")} {elsewhere.map((s) => s.companyName).join(", ")}. {t("nc.elsewhereok")}
            </p>
          )}

          <div className="gr-actions">
            <button className="gr-btn-ghost" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              className="gr-btn"
              disabled={!valid}
              onClick={() =>
                onSave(sponsorId, {
                  ...contact,
                  id: uid(),
                  email: emailToStore(contact.email),
                  // portal access is meaningless without an email to log in with
                  portalAccess: emailOk ? !!contact.portalAccess : false,
                })
              }
            >
              {t("common.save")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
