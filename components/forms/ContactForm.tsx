"use client";

import { useState } from "react";
import EmailInput from "@/components/ui/EmailInput";
import Field from "@/components/ui/Field";
import { COMM_LABELS, LANGS, emptyContact, label, uid, type CommKey } from "@/lib/constants";
import { emailToStore, validateEmail } from "@/lib/email-validate";
import type { Contact, Language } from "@/types";

/* ---------- Single contact form (team side, in a modal) ---------- */

export default function ContactForm({
  initial,
  onSave,
  onDelete,
  onCancel,
  lang = "en",
}: {
  initial?: Contact | null;
  onSave: (c: Contact) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  lang?: Language;
}) {
  const T = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang] || en;
  const [c, setC] = useState<Contact>({
    id: "",
    ...emptyContact,
    prefs: { ...emptyContact.prefs },
    ...initial,
  });
  const set =
    (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setC({ ...c, [k]: e.target.value } as Contact);
  const mailRes = validateEmail(c.email);
  const valid = (c.firstName.trim() || c.lastName.trim()) && (!mailRes || mailRes.valid);
  return (
    <div>
      <div className="gr-grid2">
        <Field label={T("Voornaam", "Prénom", "First name")}>
          <input value={c.firstName} onChange={set("firstName")} placeholder="Jan" />
        </Field>
        <Field label={T("Naam", "Nom", "Last name")}>
          <input value={c.lastName} onChange={set("lastName")} placeholder="Peeters" />
        </Field>
      </div>
      <div className="gr-grid2">
        <Field
          label={T("E-mail", "E-mail", "Email")}
          hint={T(
            "Hiermee logt deze persoon in",
            "Sert d'identifiant pour le portail",
            "They log in to the sponsor portal with this address",
          )}
        >
          <EmailInput value={c.email} onChange={set("email")} lang={lang} />
        </Field>
        <Field label={T("Telefoon", "Téléphone", "Phone")}>
          <input value={c.phone} onChange={set("phone")} />
        </Field>
      </div>
      <Field label={T("Taal", "Langue", "Language")}>
        <select value={c.language} onChange={set("language")}>
          {Object.entries(LANGS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label={T("Wil communicatie ontvangen over", "Souhaite recevoir", "Wants to receive")}>
        <div className="gr-checkrow">
          {(Object.keys(COMM_LABELS) as CommKey[]).map((k) => {
            const on = !!c.prefs?.[k];
            return (
              <label key={k} className={"gr-check gr-check-sm" + (on ? " on" : "")}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setC({ ...c, prefs: { ...(c.prefs || {}), [k]: e.target.checked } })}
                />
                {label(COMM_LABELS, k, lang)}
              </label>
            );
          })}
        </div>
      </Field>
      <label className={"gr-check" + (c.portalAccess ? " on" : "")} style={{ marginBottom: 6 }}>
        <input
          type="checkbox"
          checked={!!c.portalAccess}
          disabled={!c.email}
          onChange={(e) => setC({ ...c, portalAccess: e.target.checked })}
        />
        {T("Toegang tot het sponsorportaal", "Accès au portail sponsors", "Access to the sponsor portal")}
      </label>
      <p className="gr-muted" style={{ marginTop: 0 }}>
        {!c.email
          ? T("Vul eerst een e-mailadres in.", "Renseignez d'abord une adresse e-mail.", "Enter an email address first.")
          : T(
              "Zonder deze activering kan deze persoon niet aanmelden. Eenmaal actief kan hij zich aanmelden met een link die naar dit e-mailadres wordt gestuurd — geen wachtwoord nodig.",
              "Sans cette activation, cette personne ne peut pas se connecter. Une fois activée, elle peut se connecter via un lien envoyé à cette adresse e-mail — aucun mot de passe requis.",
              "Without this activation this person can't log in. Once active, they can sign in with a link sent to this email address — no password needed.",
            )}
      </p>
      <div className="gr-actions">
        {initial?.id && onDelete && (
          <button
            className="gr-btn-ghost gr-danger"
            style={{ marginRight: "auto" }}
            onClick={() => onDelete(initial.id)}
          >
            {T("Verwijderen", "Supprimer", "Delete contact")}
          </button>
        )}
        <button className="gr-btn-ghost" onClick={onCancel}>
          {T("Annuleren", "Annuler", "Cancel")}
        </button>
        <button
          className="gr-btn"
          disabled={!valid}
          onClick={() => onSave({ ...c, id: c.id || uid(), email: emailToStore(c.email) })}
        >
          {T("Opslaan", "Enregistrer", "Save contact")}
        </button>
      </div>
    </div>
  );
}
