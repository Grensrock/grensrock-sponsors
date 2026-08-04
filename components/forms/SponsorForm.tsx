"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import VatInput from "@/components/ui/VatInput";
import { emptySponsor } from "@/lib/constants";
import { contactName, sponsorContacts } from "@/lib/contacts";
import { defaultVatLookup, vatLookup } from "@/lib/integrations/vat-lookup";
import { normNameKey, normVatKey } from "@/lib/normalize";
import { userName } from "@/lib/users";
import { validateVat, vatToStore } from "@/lib/vat";
import type { Sponsor, TranslateFn, User, VatLookupConfig } from "@/types";

/* ---------- Sponsor form ---------- */

export default function SponsorForm({
  initial,
  onSave,
  onCancel,
  teamMembers = [],
  vatCfg = defaultVatLookup,
  existingSponsors = [],
  t = (k) => k,
}: {
  initial?: Partial<Sponsor> | null;
  onSave: (s: Sponsor) => void;
  onCancel: () => void;
  teamMembers?: User[];
  vatCfg?: VatLookupConfig;
  existingSponsors?: Sponsor[];
  t?: TranslateFn;
}) {
  const [s, setS] = useState<Sponsor>({ id: "", ...emptySponsor, ...initial });
  const set =
    (k: keyof Sponsor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setS({ ...s, [k]: e.target.value } as Sponsor);
  const vatRes = validateVat(s.vatNumber);

  /* Live duplicate check against other sponsors (skip self when editing) */
  const others = existingSponsors.filter((x) => x.id !== s.id);
  const dupVat = normVatKey(s.vatNumber)
    ? others.find((x) => normVatKey(x.vatNumber) === normVatKey(s.vatNumber))
    : null;
  const dupName =
    !dupVat && normNameKey(s.companyName)
      ? others.find((x) => normNameKey(x.companyName) === normNameKey(s.companyName))
      : null;
  const dup = dupVat || dupName;

  const valid = s.companyName.trim().length > 0 && (!vatRes || vatRes.valid);
  return (
    <div>
      <div className="gr-grid2">
        <Field label={t("sf.companyname")}>
          <input value={s.companyName} onChange={set("companyName")} placeholder="Brouwerij Vanhonsebrouck" />
        </Field>
        <Field label={t("c.vatnr")} hint={vatLookup.enabled(vatCfg) ? t("sf.fetchhint") : null}>
          <VatInput
            value={s.vatNumber}
            onChange={set("vatNumber")}
            lang="en"
            cfg={vatCfg}
            current={s}
            /* The registry also tells us whether it's a company or a sole trader. */
            onApply={(patch, company) => setS((prev) => ({ ...prev, ...patch, entityType: company.entityType }))}
          />
        </Field>
      </div>
      <div className="gr-gridaddr">
        <Field label={t("sf.street")}>
          <input value={s.street} onChange={set("street")} placeholder="Grensstraat" />
        </Field>
        <Field label={t("sf.number")}>
          <input value={s.houseNumber} onChange={set("houseNumber")} placeholder="12A" />
        </Field>
      </div>
      <div className="gr-gridaddr">
        <Field label={t("sf.postal")}>
          <input value={s.postalCode} onChange={set("postalCode")} placeholder="8930" />
        </Field>
        <Field label={t("sf.city")}>
          <input value={s.city} onChange={set("city")} placeholder="Menen" />
        </Field>
      </div>
      <div className="gr-grid2">
        <Field label={t("sf.type")}>
          <select value={s.entityType} onChange={set("entityType")}>
            <option value="legal">{t("c.legal")}</option>
            <option value="person">{t("c.person")}</option>
          </select>
        </Field>
        <Field
          label={t("sf.responsibleteam")}
          hint={teamMembers.length === 0 ? t("sf.noteam") : undefined}
        >
          <select value={s.responsibleId || ""} onChange={(e) => setS({ ...s, responsibleId: e.target.value })}>
            <option value="">— not assigned —</option>
            {teamMembers.map((u) => (
              <option key={u.id} value={u.id}>
                {userName(u)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("vc.receiver")} hint={t("vc.hint")}>
        <select value={s.voucherContactId || ""} onChange={(e) => setS({ ...s, voucherContactId: e.target.value })}>
          <option value="">{t("vc.auto")}</option>
          {sponsorContacts(s)
            .filter((c) => c.email)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c) || c.email} · {c.email}
              </option>
            ))}
        </select>
      </Field>
      <label className={"gr-check" + (s.refRequired ? " on" : "")} style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={!!s.refRequired}
          onChange={(e) => setS({ ...s, refRequired: e.target.checked })}
        />
        This sponsor requires a reference on contract &amp; invoice (PO number, order reference, cost centre…)
      </label>
      {dup && !s.id && (
        <p className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
          {dupVat
            ? `${t("dup.samevatlong")} ${dup.companyName} (${dup.vatNumber}).`
            : `${t("dup.samenamelong")} ${dup.companyName}.`}{" "}
          {t("dup.checkfirst")}
        </p>
      )}
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!valid} onClick={() => onSave({ ...s, vatNumber: vatToStore(s.vatNumber) })}>
          {t("sf.save")}
        </button>
      </div>
    </div>
  );
}
