"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import { benefitChanges, changeLines } from "@/lib/benefits";
import { OP_MAAT, dealFieldsFromFormula, emptyDeal } from "@/lib/constants";
import {
  AGREEMENT_FIELDS,
  BENEFIT_FIELDS,
  autoMapAgreements,
  isCustomFormula,
  matchEdition,
  parseAmount,
  parseBenefit,
  type AgreementField,
  type ColumnMap,
} from "@/lib/import-helpers";
import { AGREEMENT_TEMPLATE, downloadTemplate } from "@/lib/import-template";
import { eur } from "@/lib/money";
import { normNameKey, normStr, normVatKey } from "@/lib/normalize";
import { benefitLines, voucherTotal } from "@/lib/vouchers";
import type { Deal, Edition, Formula, Language, Sponsor, SponsorDecline, TranslateFn } from "@/types";

/* ---------- Agreement import (xlsx / csv) ----------
   One agreement per row. Nothing is created around it: the sponsor and the
   edition must already exist, and the formula must be one of that edition's.
   A formula is copied the way the agreement form copies it; an amount in the
   file replaces its price, and each benefit filled in replaces the formula's.
   An admin is the one importing, so benefits that differ from the formula
   come in approved (0026), as when an admin saves the form. No mail goes out — not the confirmation to the
   sponsor, and not the "new agreement" notice to the admins, since an admin
   is the one importing. */

interface AgreementImportRow {
  deal: Partial<Deal>;
  /** What the benefits are held against; null for Op maat. */
  formula: Formula | null;
  sponsorName: string;
  editionName: string;
  /** The sponsor had declined this edition; inserting the agreement withdraws that (0022). */
  declined: boolean;
}

interface SkippedRow {
  line: number;
  name: string;
  /** A TEAM_TEXT key, so the list follows the interface language. */
  reason: string;
  /** The label key of the column the reason is about, filled in as {field}. */
  field?: string;
}

const BASE_FIELDS = AGREEMENT_FIELDS.filter(([f]) => !BENEFIT_FIELDS.some(([b]) => b === f));

export default function AgreementImportModal({
  sponsors,
  editions,
  deals,
  declines = [],
  defaultEditionId = "",
  onImport,
  onClose,
  t = (k) => k,
  lang = "nl",
}: {
  sponsors: Sponsor[];
  editions: Edition[];
  deals: Deal[];
  declines?: SponsorDecline[];
  /** Where the rows go when the file has no edition column. */
  defaultEditionId?: string;
  /** Resolves false when nothing was saved; the modal then stays on the preview. */
  onImport: (list: Array<Partial<Deal>>) => Promise<boolean>;
  onClose: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<ColumnMap<AgreementField>>({});
  const [editionId, setEditionId] = useState(defaultEditionId);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: SkippedRow[] } | null>(null);

  const sortedEditions = [...editions].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  const mapped = (f: AgreementField) => (map[f] ?? -1) >= 0;

  /* Under the column notes in the template: every edition's formula names,
     cheapest first as in the form, since a name that doesn't match exactly
     is the likeliest reason for a skipped row. */
  const formulaGuide = () => [
    [t("tpl.formulasby")],
    [t("c.edition"), t("c.status"), t("tpl.formulas")],
    ...sortedEditions.map((e) => [
      e.name,
      t(e.active ? "ov.active" : "ov.inactive"),
      [...(e.formulas || [])]
        .sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0))
        .map((f) => f.name)
        .concat(OP_MAAT)
        .join(", "),
    ]),
  ];

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr("");
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const all = (
        XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) as unknown[][]
      ).filter((r) => r.some((c) => normStr(c) !== ""));
      if (all.length < 2) {
        setErr(t("ai.needheader"));
        return;
      }
      const hdr = all[0].map(normStr);
      setHeaders(hdr);
      setRows(all.slice(1));
      setMap(autoMapAgreements(hdr));
    } catch {
      setErr(t("im.unreadable"));
    }
  };

  const analysis = useMemo(() => {
    const has = (f: AgreementField) => (map[f] ?? -1) >= 0;
    if (!headers || !has("sponsor")) return null;
    if (!has("edition") && !editionId) return null;
    if (!has("formula") && !has("amount")) return null;
    const cell = (row: unknown[], f: AgreementField) => (has(f) ? row[map[f]!] : "");
    const get = (row: unknown[], f: AgreementField) => normStr(cell(row, f));

    const byVat = new Map(
      sponsors.filter((s) => normVatKey(s.vatNumber)).map((s) => [normVatKey(s.vatNumber), s]),
    );
    const byName = new Map(sponsors.map((s) => [normNameKey(s.companyName), s]));
    const fixedEdition = editions.find((e) => e.id === editionId);
    const pairKey = (x: { sponsorId: string; editionId: string }) => `${x.sponsorId}:${x.editionId}`;
    const taken = new Set(deals.map(pairKey));
    const declined = new Set(declines.map(pairKey));
    const seen = new Set<string>();
    const create: AgreementImportRow[] = [],
      skipped: SkippedRow[] = [];

    rows.forEach((row, i) => {
      const line = i + 2;
      const company = get(row, "sponsor");
      const vatKey = normVatKey(get(row, "vatNumber"));
      if (!company && !vatKey) {
        skipped.push({ line, name: "", reason: "im.r.nosponsorname" });
        return;
      }
      /* The VAT number first: it survives a sponsor being renamed, a name doesn't. */
      const sponsor = (vatKey && byVat.get(vatKey)) || byName.get(normNameKey(company));
      if (!sponsor) {
        skipped.push({ line, name: company || get(row, "vatNumber"), reason: "im.r.nosponsor" });
        return;
      }
      const name = sponsor.companyName;

      /* The row's own edition, else the one picked for the file — so a
         template's Editie column can stay empty when it is all one edition. */
      const named = get(row, "edition");
      const edition = named ? matchEdition(named, editions) : fixedEdition;
      if (!edition) {
        skipped.push({
          line,
          name: named ? `${name} — ${named}` : name,
          reason: named ? "ai.r.edition" : "ai.r.noedition",
        });
        return;
      }

      /* One agreement per sponsor and edition (unique in the database). */
      const key = pairKey({ sponsorId: sponsor.id, editionId: edition.id });
      if (taken.has(key)) {
        skipped.push({ line, name: `${name} — ${edition.name}`, reason: "ai.r.hasagr" });
        return;
      }
      if (seen.has(key)) {
        skipped.push({ line, name: `${name} — ${edition.name}`, reason: "im.r.dupfile" });
        return;
      }

      const amount = parseAmount(cell(row, "amount"));
      if (amount !== null && !(amount >= 0)) {
        skipped.push({ line, name: `${name} — ${get(row, "amount")}`, reason: "ai.r.badamount" });
        return;
      }

      let fields: Partial<Deal>;
      let formula: Formula | null = null;
      const asked = get(row, "formula");
      if (asked && !isCustomFormula(asked)) {
        formula = (edition.formulas || []).find((f) => normNameKey(f.name) === normNameKey(asked)) || null;
        if (!formula) {
          skipped.push({ line, name: `${name} — ${asked}`, reason: "ai.r.formula" });
          return;
        }
        fields = { ...dealFieldsFromFormula(formula), ...(amount !== null ? { cost: amount } : {}) };
      } else {
        if (amount === null) {
          skipped.push({ line, name, reason: "ai.r.noamount" });
          return;
        }
        fields = { formulaName: OP_MAAT, cost: amount };
      }

      /* Each benefit the file fills in replaces the formula's; an empty cell
         leaves it (Op maat: none). One that can't be read stops the row, as
         importing it without would give the sponsor less than agreed. */
      const benefits: Partial<Deal> = {};
      for (const [field, labelKey] of BENEFIT_FIELDS) {
        const value = parseBenefit(field, cell(row, field));
        if (value === undefined) {
          skipped.push({ line, name: `${name} — ${get(row, field)}`, reason: "ai.r.benefit", field: labelKey });
          return;
        }
        if (value) Object.assign(benefits, value);
      }

      const deal = {
        ...emptyDeal,
        ...fields,
        ...benefits,
        sponsorId: sponsor.id,
        editionId: edition.id,
        notes: get(row, "notes"),
      };
      /* The formula's split of its drink vouchers fits its own amount only:
         another amount becomes one voucher, to be split in the agreement. */
      if (Math.abs(voucherTotal(deal.drinkVouchers) - (Number(deal.drinkValue) || 0)) >= 0.005) deal.drinkVouchers = [];

      seen.add(key);
      create.push({
        deal,
        formula,
        sponsorName: name,
        editionName: edition.name,
        declined: declined.has(key),
      });
    });
    return { create, skipped };
  }, [headers, rows, map, editionId, sponsors, editions, deals, declines]);

  /* What the sponsor gets, so a wrong column shows before the import; one set
     apart from its formula says so, with what differs on hover. */
  const benefitsCell = (r: AgreementImportRow) => {
    const lines = benefitLines(r.deal, lang);
    const changes = r.formula ? changeLines(benefitChanges(r.deal, r.formula, lang === "en" ? "en" : "nl")) : [];
    return (
      <span className="gr-muted" style={{ fontSize: 12 }}>
        {changes.length > 0 && (
          <span title={changes.join("\n")}>
            <Tag tone="amber">{t("ai.differs")}</Tag>{" "}
          </span>
        )}
        {lines.join(" · ") || "—"}
      </span>
    );
  };

  const doImport = async () => {
    if (!analysis || busy) return;
    setBusy(true);
    const ok = await onImport(analysis.create.map((r) => r.deal));
    setBusy(false);
    if (ok) setResult({ created: analysis.create.length, skipped: analysis.skipped });
  };

  const mappingGrid = (fields: Array<[AgreementField, string]>) => (
    <div className="gr-grid3">
      {fields.map(([field, labelKey]) => (
        <Field key={field} label={t(labelKey)}>
          <select value={map[field] ?? -1} onChange={(e) => setMap({ ...map, [field]: Number(e.target.value) })}>
            <option value={-1}>{t("im.skip")}</option>
            {headers!.map((h, i) => (
              <option key={i} value={i}>
                {h || t("im.column", { n: i + 1 })}
              </option>
            ))}
          </select>
        </Field>
      ))}
    </div>
  );

  const skippedTable = (list: SkippedRow[]) => (
    <div className="gr-tablewrap">
      <table className="gr-table gr-compact">
        <thead>
          <tr>
            <th>{t("c.row")}</th>
            <th>{t("c.value")}</th>
            <th>{t("c.reason")}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s, i) => (
            <tr key={i}>
              <td>{s.line}</td>
              <td>{s.name || t("im.empty")}</td>
              <td>{t(s.reason, s.field ? { field: t(s.field) } : undefined)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (result) {
    return (
      <Modal title={t("im.donesp")} onClose={onClose} wide lang={lang}>
        <p>
          {t("ai.created", { n: result.created })}
          {result.skipped.length > 0 && <> {t("im.skippedrows", { n: result.skipped.length })}</>}
        </p>
        {result.created > 0 && <p className="gr-muted">{t("ai.nomail")}</p>}
        {result.skipped.length > 0 && skippedTable(result.skipped)}
        <div className="gr-actions">
          <button className="gr-btn" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t("ai.title")} onClose={onClose} wide lang={lang} confirmOutsideClick>
      {!headers ? (
        <>
          <p className="gr-muted">{t("ai.intro")}</p>
          <p className="gr-muted">
            {t("tpl.hint")}{" "}
            <button
              type="button"
              className="gr-mini"
              onClick={() => downloadTemplate("grensrock-template-agreements.xlsx", AGREEMENT_TEMPLATE, t, formulaGuide())}
            >
              {t("tpl.download")}
            </button>
          </p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="gr-file" />
          {err && (
            <p className="gr-muted" style={{ color: "var(--red)" }}>
              {err}
            </p>
          )}
        </>
      ) : (
        <>
          <h4 className="gr-subhead" style={{ borderTop: "none", paddingTop: 0 }}>
            {t("im.colmapping")}
          </h4>
          <p className="gr-muted">{t("im.detected")}</p>
          {mappingGrid(BASE_FIELDS)}
          {/* For the rows that don't name their edition: every row, without an Editie column. */}
          <Field
            label={t(mapped("edition") ? "ai.editionrest" : "ai.edition")}
            hint={t(mapped("edition") ? "ai.editionresthint" : "ai.editionhint")}
          >
            <select value={editionId} onChange={(e) => setEditionId(e.target.value)}>
              <option value="">{t("df.select")}</option>
              {sortedEditions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.active ? e.name : `${e.name} (${t("ov.inactive")})`}
                </option>
              ))}
            </select>
          </Field>
          <h4 className="gr-subhead">{t("ai.benefits")}</h4>
          <p className="gr-muted">{t("ai.benefitshint")}</p>
          {mappingGrid(BENEFIT_FIELDS)}
          {[
            !mapped("sponsor") && "im.selsponsor",
            !mapped("edition") && !editionId && "ai.seledition",
            !mapped("formula") && !mapped("amount") && "ai.selformula",
          ]
            .filter(Boolean)
            .map((k) => (
              <p key={k as string} className="gr-muted" style={{ color: "var(--red)" }}>
                {t(k as string)}
              </p>
            ))}
          {analysis && (
            <>
              <h4 className="gr-subhead">{t("im.preview")}</h4>
              <p className="gr-muted">
                <Tag tone="green">{t("im.toadd", { n: analysis.create.length })}</Tag>{" "}
                <Tag tone={analysis.skipped.length ? "amber" : "grey"}>
                  {t("im.skippedcount", { n: analysis.skipped.length })}
                </Tag>
              </p>
              {analysis.create.length > 0 && (
                <div className="gr-tablewrap">
                  <table className="gr-table gr-compact">
                    <thead>
                      <tr>
                        <th>Sponsor</th>
                        <th>{t("c.edition")}</th>
                        <th>{t("c.formula")}</th>
                        <th className="gr-r">{t("c.cost")}</th>
                        <th>{t("ai.benefits")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.create.slice(0, 6).map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.declined ? (
                              <span style={{ color: "var(--orange-deep)" }} title={t("ai.declined")}>
                                ⚠ {r.sponsorName}
                              </span>
                            ) : (
                              r.sponsorName
                            )}
                          </td>
                          <td>{r.editionName}</td>
                          <td>{r.deal.formulaName === OP_MAAT ? t("th.custom") : r.deal.formulaName}</td>
                          <td className="gr-r">{eur(r.deal.cost)}</td>
                          <td>{benefitsCell(r)}</td>
                        </tr>
                      ))}
                      {analysis.create.length > 6 && (
                        <tr>
                          <td colSpan={5} className="gr-muted">
                            {t("im.more", { n: analysis.create.length - 6 })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {analysis.skipped.some((s) => s.reason === "im.r.nosponsor") && (
                <p className="gr-blockbanner" style={{ marginTop: 12 }}>
                  {t("im.nomatchbanner")}
                </p>
              )}
              {analysis.skipped.some((s) => s.reason === "ai.r.formula") && (
                <p className="gr-blockbanner" style={{ marginTop: 12 }}>
                  {t("ai.formulabanner")}
                </p>
              )}
              {analysis.skipped.some((s) => s.reason === "ai.r.benefit") && (
                <p className="gr-blockbanner" style={{ marginTop: 12 }}>
                  {t("ai.benefitbanner")}
                </p>
              )}
              {/* Before importing, not only after: a row skipped now is one to fix in the file first. */}
              {analysis.skipped.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary className="gr-muted" style={{ cursor: "pointer" }}>
                    {t("ai.showskipped", { n: analysis.skipped.length })}
                  </summary>
                  {skippedTable(analysis.skipped)}
                </details>
              )}
            </>
          )}
          <div className="gr-actions">
            <button
              className="gr-btn-ghost"
              onClick={() => {
                setHeaders(null);
                setRows([]);
                setErr("");
              }}
            >
              {t("im.chooseother")}
            </button>
            <button
              className="gr-btn"
              disabled={!analysis || analysis.create.length === 0 || busy}
              onClick={doImport}
            >
              {busy ? t("im.processing") : t("ai.do", { n: analysis ? analysis.create.length : 0 })}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
