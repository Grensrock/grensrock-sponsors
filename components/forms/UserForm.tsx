"use client";

import { useState } from "react";
import EmailInput from "@/components/ui/EmailInput";
import Field from "@/components/ui/Field";
import { ROLES, TEAM_DOMAIN, TEAM_LANGS, emptyUser, label } from "@/lib/constants";
import { emailToStore, sameEmail, validateEmail } from "@/lib/email-validate";
import { teamEmailFor } from "@/lib/users";
import type { Language, Role, TeamLanguage, TranslateFn, User } from "@/types";

/* ---------- Team account form ---------- */

type UserFormState = Omit<User, "id"> & { id?: string };

export default function UserForm({
  initial,
  onSave,
  onCancel,
  isOnlyAdmin,
  existing = [],
  t = (k) => k,
  lang = "nl",
}: {
  initial?: Partial<User> | null;
  onSave: (u: UserFormState) => void;
  onCancel: () => void;
  isOnlyAdmin?: boolean;
  existing?: User[];
  t?: TranslateFn;
  lang?: Language;
}) {
  const [u, setU] = useState<UserFormState>({ ...emptyUser, ...initial });
  /* Email follows firstname@grensrock.be unless it was edited by hand */
  const [customEmail, setCustomEmail] = useState(
    !!initial?.email && initial.email !== teamEmailFor(initial?.firstName),
  );
  const email = customEmail ? u.email : teamEmailFor(u.firstName);
  const mailRes = validateEmail(email);
  const dupe = !!email && existing.some((x) => x.id !== u.id && sameEmail(x.email, email));
  const valid = u.firstName.trim().length > 0 && !!email.trim() && (!mailRes || mailRes.valid) && !dupe;

  return (
    <div>
      <div className="gr-grid2">
        <Field label={t("uf.firstname")}>
          <input value={u.firstName} onChange={(e) => setU({ ...u, firstName: e.target.value })} placeholder="Jan" />
        </Field>
        <Field label={t("uf.lastname")}>
          <input value={u.lastName} onChange={(e) => setU({ ...u, lastName: e.target.value })} placeholder="Peeters" />
        </Field>
      </div>
      <Field
        group
        label={t("uf.emaillogin")}
        hint={customEmail ? t("uf.customaddress") : t("uf.autoaddress", { domain: TEAM_DOMAIN })}
      >
        <EmailInput
          value={email}
          onChange={(e) => {
            setCustomEmail(true);
            setU({ ...u, email: e.target.value });
          }}
        />
        {dupe && (
          <span className="gr-hint" style={{ color: "var(--red)" }}>
            {t("uf.dupemail")}
          </span>
        )}
        {customEmail && (
          <button
            className="gr-linkbtn"
            style={{ marginTop: 4 }}
            onClick={() => {
              setCustomEmail(false);
              setU({ ...u, email: "" });
            }}
          >
            Use the standard {TEAM_DOMAIN} address
          </button>
        )}
      </Field>
      <div className="gr-grid2">
        <Field label={t("c.role")} hint={isOnlyAdmin ? t("uf.lastadminhint") : undefined}>
          <select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value as Role })} disabled={isOnlyAdmin}>
            {Object.keys(ROLES).map((k) => (
              <option key={k} value={k}>
                {label(ROLES, k, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("c.language")} hint={t("uf.uilanguage")}>
          <select
            value={u.language || "nl"}
            onChange={(e) => setU({ ...u, language: e.target.value as TeamLanguage })}
          >
            {Object.entries(TEAM_LANGS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="gr-muted">
        Admins manage editions, formulas, invoicing and team accounts. Users can view and update all sponsors and
        their agreements.
      </p>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!valid} onClick={() => onSave({ ...u, email: emailToStore(email) })}>
          {t("tm.save")}
        </button>
      </div>
    </div>
  );
}

export type { UserFormState };
