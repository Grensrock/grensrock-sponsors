"use client";

import { useState } from "react";
import EmailInput from "@/components/ui/EmailInput";
import Field from "@/components/ui/Field";
import { isUuid } from "@/lib/api/util";
import { COMM_LABELS, LANGS, emptyContact, label, uid, type CommKey } from "@/lib/constants";
import { emailToStore, validateEmail } from "@/lib/email-validate";
import type { Contact, Language } from "@/types";

/* ---------- Single contact form (team side and portal, in a modal) ---------- */

export default function ContactForm({
  initial,
  onSave,
  onDelete,
  onCancel,
  lang = "en",
  busy = null,
}: {
  initial?: Contact | null;
  onSave: (c: Contact) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
  lang?: Language;
  /** A save or delete still on its way (the portal): both buttons wait for it. */
  busy?: "save" | "delete" | null;
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
      {/* Clicking a contact person opens this form, and on a phone the reason
          to look someone up is often to keep their number. The card is the
          saved contact, read on the server (app/api/contacts/[id]/vcard), so
          it only shows once there is a saved row to read. A plain link, no
          `download`: that is what lets an iPhone open it as a contact. */}
      {isUuid(initial?.id) && (
        <div className="gr-savecard">
          <a className="gr-mini" href={`/api/contacts/${initial!.id}/vcard`}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="5" r="2.75" />
              <path d="M1.25 14c.4-2.6 2.3-4.25 4.75-4.25S10.35 11.4 10.75 14M13 5.5v4M11 7.5h4" />
            </svg>
            {T("Toevoegen aan mijn contacten", "Ajouter à mes contacts", "Add to my contacts")}
          </a>
        </div>
      )}
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
      <Field group label={T("Wil communicatie ontvangen over", "Souhaite recevoir", "Wants to receive")}>
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
              "Zonder deze activering kan deze persoon niet aanmelden. Bij het activeren krijgt deze persoon een e-mail met een link om een wachtwoord te kiezen. Daarna meldt deze persoon zich aan met dit e-mailadres en dat wachtwoord, of vraagt op de aanmeldpagina een aanmeldlink aan.",
              "Sans cette activation, cette personne ne peut pas se connecter. À l'activation, elle reçoit un e-mail avec un lien pour choisir un mot de passe. Elle se connecte ensuite avec cette adresse e-mail et ce mot de passe, ou demande un lien de connexion sur la page de connexion.",
              "Without this activation this person can't sign in. Activating it emails them a link to choose a password. After that they sign in with this email address and that password, or ask for a sign-in link on the sign-in page.",
            )}
      </p>
      <div className="gr-actions">
        {initial?.id && onDelete && (
          <button
            className="gr-btn-ghost gr-danger"
            style={{ marginRight: "auto" }}
            disabled={!!busy}
            onClick={() => onDelete(initial.id)}
          >
            {busy === "delete" ? T("Bezig…", "En cours…", "Working…") : T("Verwijderen", "Supprimer", "Delete contact")}
          </button>
        )}
        <button className="gr-btn-ghost" onClick={onCancel}>
          {T("Annuleren", "Annuler", "Cancel")}
        </button>
        <button
          className="gr-btn"
          disabled={!valid || !!busy}
          onClick={() => onSave({ ...c, id: c.id || uid(), email: emailToStore(c.email) })}
        >
          {busy === "save" ? T("Bezig…", "En cours…", "Working…") : T("Opslaan", "Enregistrer", "Save contact")}
        </button>
      </div>
    </div>
  );
}
