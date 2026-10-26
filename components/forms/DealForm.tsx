"use client";

import { useState } from "react";
import BenefitFields, { VoucherFields } from "@/components/forms/BenefitFields";
import SponsorForm from "@/components/forms/SponsorForm";
import SponsorPicker from "@/components/forms/SponsorPicker";
import Field from "@/components/ui/Field";
import { fmtDateTime } from "@/lib/acceptance";
import { awaitsApproval, benefitChanges, changeLines, sameBenefits } from "@/lib/benefits";
import { formulaStyle } from "@/lib/color";
import { OP_MAAT, SETTLEMENTS, dealFieldsFromFormula, emptyDeal } from "@/lib/constants";
import { settleLabel } from "@/lib/i18n";
import { defaultVatLookup } from "@/lib/integrations/vat-lookup";
import { eur, invoiceAmount, needsInvoice, refRequiredFor } from "@/lib/money";
import { benefitLines } from "@/lib/vouchers";
import type {
  Deal,
  DealDraft,
  Edition,
  Language,
  Settlement,
  Sponsor,
  TranslateFn,
  User,
  VatLookupConfig,
} from "@/types";

/* ---------- Deal (agreement) form ---------- */

type DealFormState = Omit<Deal, "id"> & { id?: string; lockSponsor?: boolean };

export default function DealForm({
  initial,
  sponsors,
  pickableSponsors = sponsors,
  editions,
  deals = [],
  teamMembers = [],
  defaultResponsibleId,
  vatCfg = defaultVatLookup,
  onSave,
  onCancel,
  onDelete,
  onAddSponsor,
  onOpenDeal,
  admin,
  t = (k) => k,
  lang = "nl",
}: {
  initial?: DealDraft | null;
  sponsors: Sponsor[];
  /** The ones this person may make an agreement for; `sponsors` is still used for lookups and duplicates. */
  pickableSponsors?: Sponsor[];
  editions: Edition[];
  deals?: Deal[];
  teamMembers?: User[];
  /** Responsible for a sponsor created from inside the form: whoever is filling it in. */
  defaultResponsibleId?: string;
  vatCfg?: VatLookupConfig;
  onSave: (d: DealFormState) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  /* Creating a sponsor is a round-trip to the database now, so this may be async. */
  onAddSponsor: (s: Sponsor) => Sponsor | Promise<Sponsor>;
  onOpenDeal?: (d: Deal) => void;
  /** An admin's own change to the benefits needs nobody's approval (0026). */
  admin?: boolean;
  t?: TranslateFn;
  lang?: Language;
}) {
  const activeEditions = editions.filter((e) => e.active);
  const [d, setD] = useState<DealFormState>(() => {
    const start: DealFormState = { ...emptyDeal, ...initial };
    /* One edition running means there is nothing to pick: start on it. */
    if (!start.editionId && activeEditions.length === 1) start.editionId = activeEditions[0].id;
    return start;
  });
  const [newSponsorDraft, setNewSponsorDraft] = useState<Partial<Sponsor> | null>(null); // null | prefill object
  const set = (k: string, val: unknown) => setD((p) => ({ ...p, [k]: val }) as DealFormState);
  const edition = editions.find((e) => e.id === d.editionId);
  /* Cheapest formula first, so the buttons read as a ladder. */
  const formulas = [...(edition?.formulas || [])].sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));
  const formula = formulas.find((x) => x.name === d.formulaName) || null;
  const changes = benefitChanges(d, formula, lang === "en" ? "en" : "nl");

  /* A formula's benefits are what Grensrock offers for its price, so they stay
     as the formula has them until someone deliberately opens them up — and
     doing that as a team member puts the agreement up for an admin's approval
     (0026). An agreement that already differs opens as it was left; Op maat
     has no formula to keep to, so it is always open. */
  const [opened, setOpened] = useState(() => !!initial?.id && changes.length > 0);
  const locked = !opened && d.formulaName !== OP_MAAT;
  /* Locked, the benefits are only read: a list, not fields. Food & drink and
     the voucher splits are left out of it — they have a section of their own,
     open all along. */
  const benefitList = benefitLines({ ...d, foodDrinkValue: 0, drinkVouchers: [] }, lang);
  /* Whether saving has the database look at the benefits again — always for a
     new agreement. An older one that differs but isn't touched now stays as
     it was, so it isn't told it needs an approval it won't be asked for. */
  const reviewed =
    !initial?.id ||
    d.formulaName !== initial.formulaName ||
    d.editionId !== initial.editionId ||
    !sameBenefits(d, initial);

  const applyFormula = (name: string) => {
    if (name === OP_MAAT) {
      // Fully custom agreement: keep current values, everything editable
      set("formulaName", OP_MAAT);
      return;
    }
    const f = formulas.find((x) => x.name === name);
    if (!f) {
      set("formulaName", "");
      return;
    }
    setD((p) => ({ ...p, ...dealFieldsFromFormula(f) }));
    setOpened(false);
  };
  /* The formula's benefits again, but not its price: that is agreed apart. */
  const resetBenefits = () => {
    if (!formula) return;
    setD((p) => ({ ...p, ...dealFieldsFromFormula(formula), cost: p.cost }));
    setOpened(false);
  };

  /* A sponsor has at most one agreement per edition (unique in the database),
     so say so here instead of letting the save fail on it. */
  const clash = d.sponsorId && d.editionId
    ? deals.find((x) => x.sponsorId === d.sponsorId && x.editionId === d.editionId && x.id !== d.id)
    : undefined;

  const valid = d.sponsorId && d.editionId && d.cost !== "" && !clash;

  /* Inline "new sponsor" sub-form */
  if (newSponsorDraft !== null) {
    return (
      <div>
        <button className="gr-back" onClick={() => setNewSponsorDraft(null)}>
          {t("df.backagr")}
        </button>
        <SponsorForm
          initial={newSponsorDraft}
          defaultResponsibleId={defaultResponsibleId}
          teamMembers={teamMembers}
          vatCfg={vatCfg}
          existingSponsors={sponsors}
          t={t}
          lang={lang}
          onSave={async (s) => {
            const created = await onAddSponsor(s);
            set("sponsorId", created.id);
            setNewSponsorDraft(null);
          }}
          onCancel={() => setNewSponsorDraft(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <Field label={t("df.sponsor")} group>
        <SponsorPicker
          sponsors={pickableSponsors}
          value={d.sponsorId}
          onChange={(id) => set("sponsorId", id)}
          locked={!!initial?.lockSponsor || !!d.id}
          onCreateNew={() => setNewSponsorDraft({})}
          tr={t}
        />
      </Field>
      <Field label={t("df.edition")}>
        <select
          value={d.editionId}
          onChange={(e) => {
            set("editionId", e.target.value);
          }}
        >
          <option value="">{t("df.select")}</option>
          {activeEditions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      {clash && (
        <p className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
          {t("df.clash", {
            sponsor: sponsors.find((x) => x.id === d.sponsorId)?.companyName || "",
            edition: edition?.name || "",
          })}{" "}
          {onOpenDeal && (
            <button className="gr-mini" onClick={() => onOpenDeal(clash)}>
              {t("df.openclash")}
            </button>
          )}
        </p>
      )}
      {d.editionId && (
        <>
          <Field
            label={t("df.formula")}
            hint={
              d.formulaName === OP_MAAT
                ? t("df.fcustom")
                : formulas.length === 0
                  ? t("df.fnone")
                  : t("df.fprefill")
            }
            group
          >
            {/* One button per formula, in its own colour. Picking the one that is
                already on would prefill again and undo whatever was adjusted
                since, so that click does nothing. */}
            <div className="gr-fpick">
              {formulas.map((f) => {
                const on = d.formulaName === f.name;
                return (
                  <button
                    key={f.name}
                    type="button"
                    className={"gr-fbtn" + (on ? " on" : "")}
                    style={formulaStyle(f)}
                    aria-pressed={on}
                    onClick={() => !on && applyFormula(f.name)}
                  >
                    {f.name}
                    <small>{eur(f.cost)}</small>
                  </button>
                );
              })}
              <button
                type="button"
                className={"gr-fbtn gr-fbtn-custom" + (d.formulaName === OP_MAAT ? " on" : "")}
                aria-pressed={d.formulaName === OP_MAAT}
                onClick={() => applyFormula(OP_MAAT)}
              >
                {OP_MAAT}
                <small>{t("df.custom")}</small>
              </button>
            </div>
          </Field>
          <div className="gr-grid2">
            <Field label={t("df.cost")}>
              <input type="number" min="0" step="0.01" value={d.cost} onChange={(e) => set("cost", e.target.value)} />
            </Field>
          </div>
        </>
      )}
      {d.editionId && (
        <>
          <div className="gr-benefitshead">
            <span className="gr-label">{t("df.benefits")}</span>
            {locked ? (
              <button type="button" className="gr-mini" onClick={() => setOpened(true)}>
                {t("df.changebenefits")}
              </button>
            ) : (
              formula &&
              changes.length > 0 && (
                <button type="button" className="gr-mini" onClick={resetBenefits}>
                  {t("df.resetbenefits", { formula: formula.name })}
                </button>
              )
            )}
          </div>
          {awaitsApproval(initial) ? (
            <p className="gr-muted">{t("df.waiting", { when: fmtDateTime(initial?.benefitsChangedAt) })}</p>
          ) : (
            initial?.benefitsApprovedAt &&
            changes.length > 0 && (
              <p className="gr-muted">
                {t("df.approvedby", {
                  name: initial.benefitsApprovedBy || "?",
                  when: fmtDateTime(initial.benefitsApprovedAt),
                })}
              </p>
            )
          )}
          {changes.length > 0 ? (
            <div className="gr-benefitdiff" role="status">
              {formula ? t("df.differs", { formula: formula.name }) : t("df.byhand")}
              <ul>
                {changeLines(changes).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {reviewed && (admin ? t("df.adminapproves") : t("df.needsapproval"))}
            </div>
          ) : formula ? (
            <p className="gr-muted">{t("df.asformula", { formula: formula.name })}</p>
          ) : (
            d.formulaName !== OP_MAAT && <p className="gr-muted">{t("df.pickfirst")}</p>
          )}
          {locked ? (
            benefitList.length > 0 && (
              <ul className="gr-benefitlist gr-benefitread">
                {benefitList.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )
          ) : (
            <BenefitFields v={d} set={set} t={t} lang={lang} />
          )}
          <div className="gr-benefitshead">
            <span className="gr-label">{t("df.vouchers")}</span>
          </div>
          <p className="gr-muted">{t("df.vouchershint")}</p>
          <VoucherFields v={d} set={set} t={t} lang={lang} />
        </>
      )}
      {d.editionId && (
        <div className="gr-settle">
          <Field label={t("df.settled")}>
            <select value={d.settlement || "invoice"} onChange={(e) => set("settlement", e.target.value)}>
              {Object.keys(SETTLEMENTS).map((k) => (
                <option key={k} value={k}>
                  {settleLabel(k as Settlement, lang)}
                </option>
              ))}
            </select>
          </Field>
          {d.settlement !== "invoice" && (
            <>
              <Field label={t("df.provide")} hint={t("df.providehint")}>
                <textarea
                  rows={2}
                  value={d.inKindDescription || ""}
                  onChange={(e) => set("inKindDescription", e.target.value)}
                />
              </Field>
              {d.settlement === "mixed" && (
                <Field label={t("df.inkindval")} hint={t("df.inkindvalhint")}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.inKindValue ?? ""}
                    onChange={(e) => set("inKindValue", e.target.value)}
                  />
                </Field>
              )}
              <p className={"gr-voucherstatus" + (invoiceAmount(d) === 0 ? " ok" : "")}>
                {invoiceAmount(d) === 0 ? (
                  t("df.noinvoice")
                ) : (
                  <>
                    {t("df.toinvoice")} <strong>{eur(invoiceAmount(d))}</strong> / {eur(d.cost)}{" "}
                    {t("df.restinkind")}
                  </>
                )}
              </p>
            </>
          )}
          {needsInvoice(d) &&
            (() => {
              const sp = sponsors.find((x) => x.id === d.sponsorId);
              const required = refRequiredFor(d, sp);
              return (
                <>
                  {sp?.refRequired ? (
                    <p className="gr-voucherstatus" style={{ color: "var(--blue-deep)" }}>
                      <strong>{sp.companyName}</strong> {t("df.refsponsor1")}
                    </p>
                  ) : (
                    <label className={"gr-check" + (d.refRequired ? " on" : "")} style={{ marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!d.refRequired}
                        onChange={(e) => set("refRequired", e.target.checked)}
                      />
                      {t("df.refonly")}
                    </label>
                  )}
                  {required && (
                    <Field
                      label={t("df.reflabel")}
                      hint={String(d.invoiceReference || "").trim() ? t("df.refhintset") : t("df.refhintempty")}
                    >
                      <input
                        value={d.invoiceReference || ""}
                        onChange={(e) => set("invoiceReference", e.target.value)}
                        placeholder={t("df.refexample")}
                        style={
                          !String(d.invoiceReference || "").trim() ? { borderColor: "var(--orange)" } : undefined
                        }
                      />
                    </Field>
                  )}
                </>
              );
            })()}
        </div>
      )}
      <Field label={t("df.notes")}>
        <textarea rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="gr-actions">
        {d.id && onDelete && (
          <button
            className="gr-btn-ghost gr-danger"
            style={{ marginRight: "auto" }}
            onClick={() => onDelete(d.id!)}
          >
            {t("df.delete")}
          </button>
        )}
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!valid} onClick={() => onSave(d)}>
          {t("df.save")}
        </button>
      </div>
    </div>
  );
}

export type { DealFormState };
