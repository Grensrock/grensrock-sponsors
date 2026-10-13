"use client";

import { useState } from "react";
import BenefitFields from "@/components/forms/BenefitFields";
import SponsorForm from "@/components/forms/SponsorForm";
import SponsorPicker from "@/components/forms/SponsorPicker";
import Field from "@/components/ui/Field";
import { OP_MAAT, SETTLEMENTS, emptyDeal } from "@/lib/constants";
import { settleLabel } from "@/lib/i18n";
import { defaultVatLookup } from "@/lib/integrations/vat-lookup";
import { eur, invoiceAmount, needsInvoice, refRequiredFor } from "@/lib/money";
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
  editions,
  deals = [],
  teamMembers = [],
  vatCfg = defaultVatLookup,
  onSave,
  onCancel,
  onDelete,
  onAddSponsor,
  onOpenDeal,
  t = (k) => k,
  lang = "nl",
}: {
  initial?: DealDraft | null;
  sponsors: Sponsor[];
  editions: Edition[];
  deals?: Deal[];
  teamMembers?: User[];
  vatCfg?: VatLookupConfig;
  onSave: (d: DealFormState) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  /* Creating a sponsor is a round-trip to the database now, so this may be async. */
  onAddSponsor: (s: Sponsor) => Sponsor | Promise<Sponsor>;
  onOpenDeal?: (d: Deal) => void;
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
  /* Cheapest formula first, so the picker reads as a ladder. */
  const formulas = [...(edition?.formulas || [])].sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));

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
    setD((p) => ({
      ...p,
      formulaName: f.name,
      cost: f.cost,
      vipFriday: f.vipFriday,
      vipSaturday: f.vipSaturday,
      vipGuests: f.vipGuests,
      drinkValue: f.drinkValue,
      drinkVouchers: f.drinkVouchers || [],
      foodDrinkValue: f.foodDrinkValue,
      baseFoodDrink: f.foodDrinkValue,
      folderMention: f.folderMention,
      websiteMention: f.websiteMention,
      posterMention: f.posterMention || "none",
      ledboarding: f.ledboarding,
      fenceCovers: f.fenceCovers || 0,
    }));
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
          sponsors={sponsors}
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
        <div className="gr-grid2">
          <Field
            label={t("df.formula")}
            hint={
              d.formulaName === OP_MAAT
                ? t("df.fcustom")
                : formulas.length === 0
                  ? t("df.fnone")
                  : t("df.fprefill")
            }
          >
            <select value={d.formulaName} onChange={(e) => applyFormula(e.target.value)}>
              <option value="">{t("df.select")}</option>
              {formulas.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({eur(f.cost)})
                </option>
              ))}
              <option value={OP_MAAT}>
                {OP_MAAT} ({t("df.custom")})
              </option>
            </select>
          </Field>
          <Field label={t("df.cost")}>
            <input type="number" min="0" step="0.01" value={d.cost} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </div>
      )}
      {d.editionId && <BenefitFields v={d} set={set} showVouchers t={t} lang={lang} />}
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
