"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import { emptyContact, uid } from "@/lib/constants";
import { emailToStore, validateEmail } from "@/lib/email-validate";
import { IMPORT_FIELDS, autoMap, type ColumnMap, type ImportField } from "@/lib/import-helpers";
import { SPONSOR_TEMPLATE, downloadTemplate } from "@/lib/import-template";
import { normEntity, normLang, normNameKey, normStr, normVatKey } from "@/lib/normalize";
import { validateVat, vatToStore } from "@/lib/vat";
import type { Contact, EntityType, Language, Sponsor, TranslateFn } from "@/types";

/* ---------- Sponsor import (xlsx / csv) ---------- */

export interface SponsorImportRow {
  companyName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  vatNumber: string;
  vatInvalid: boolean;
  entityType: EntityType;
  contacts: Contact[];
  contactPreview: string;
  emailPreview: string;
  langPreview: Language;
  mailInvalid: boolean;
}

interface SkippedRow {
  line: number;
  name: string;
  /** A TEAM_TEXT key, so the list follows the interface language. */
  reason: string;
}

export default function ImportModal({
  sponsors,
  onImport,
  onClose,
  t = (k) => k,
  lang = "nl",
}: {
  sponsors: Sponsor[];
  onImport: (list: SponsorImportRow[]) => void;
  onClose: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<ColumnMap<ImportField>>({});
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ createdCount: number; skipped: SkippedRow[] } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]).filter((r) =>
        r.some((c) => normStr(c) !== ""),
      );
      if (all.length < 2) {
        setErr(t("im.needheadersp"));
        return;
      }
      const hdr = all[0].map(normStr);
      setHeaders(hdr);
      setRows(all.slice(1));
      setMap(autoMap(hdr));
    } catch {
      setErr(t("im.unreadable"));
    }
  };

  /* Build candidates + duplicate analysis, live */
  const analysis = useMemo(() => {
    if (!headers || map.companyName == null || map.companyName < 0) return null;
    const get = (row: unknown[], f: ImportField) => ((map[f] ?? -1) >= 0 ? normStr(row[map[f]!]) : "");
    const existingVat = new Set(sponsors.map((s) => normVatKey(s.vatNumber)).filter(Boolean));
    const existingName = new Set(sponsors.map((s) => normNameKey(s.companyName)));
    const seenVat = new Set<string>(),
      seenName = new Set<string>();
    const create: SponsorImportRow[] = [],
      skipped: SkippedRow[] = [];
    rows.forEach((row, i) => {
      const companyName = get(row, "companyName");
      if (!companyName) {
        skipped.push({ line: i + 2, name: "", reason: "im.r.nocompany" });
        return;
      }
      const vatKey = normVatKey(get(row, "vatNumber"));
      const nameKey = normNameKey(companyName);
      if ((vatKey && existingVat.has(vatKey)) || existingName.has(nameKey)) {
        skipped.push({ line: i + 2, name: companyName, reason: "im.r.indb" });
        return;
      }
      if ((vatKey && seenVat.has(vatKey)) || seenName.has(nameKey)) {
        skipped.push({ line: i + 2, name: companyName, reason: "im.r.dupfile" });
        return;
      }
      if (vatKey) seenVat.add(vatKey);
      seenName.add(nameKey);
      const rawVat = get(row, "vatNumber");
      const vatRes = validateVat(rawVat);
      const rawMail = get(row, "contactEmail");
      const mailRes = validateEmail(rawMail);
      create.push({
        companyName,
        street: get(row, "street"),
        houseNumber: get(row, "houseNumber"),
        postalCode: get(row, "postalCode"),
        city: get(row, "city"),
        vatNumber: vatToStore(rawVat),
        vatInvalid: !!(vatRes && !vatRes.valid),
        entityType: (map.entityType ?? -1) >= 0 ? (normEntity(get(row, "entityType")) as EntityType) : "legal",
        contacts:
          get(row, "contactFirstName") || get(row, "contactLastName") || rawMail || get(row, "contactPhone")
            ? [
                {
                  ...emptyContact,
                  id: uid(),
                  firstName: get(row, "contactFirstName"),
                  lastName: get(row, "contactLastName"),
                  email: emailToStore(rawMail),
                  phone: get(row, "contactPhone"),
                  language: (map.contactLanguage ?? -1) >= 0 ? normLang(get(row, "contactLanguage")) : "nl",
                  prefs: { info: true, invoice: true, vouchers: true },
                },
              ]
            : [],
        contactPreview: [get(row, "contactFirstName"), get(row, "contactLastName")].filter(Boolean).join(" "),
        emailPreview: emailToStore(rawMail),
        langPreview: (map.contactLanguage ?? -1) >= 0 ? normLang(get(row, "contactLanguage")) : "nl",
        mailInvalid: !!(mailRes && !mailRes.valid),
      });
    });
    return { create, skipped };
  }, [headers, rows, map, sponsors]);

  const doImport = () => {
    if (!analysis) return;
    onImport(analysis.create);
    setResult({ createdCount: analysis.create.length, skipped: analysis.skipped });
  };

  /* ----- result screen ----- */
  if (result) {
    return (
      <Modal title={t("im.donesp")} onClose={onClose} lang={lang}>
        <p>
          {t("im.createdsp", { n: result.createdCount })}
          {result.skipped.length > 0 && <> {t("im.skippedrows", { n: result.skipped.length })}</>}
        </p>
        {result.skipped.length > 0 && (
          <div className="gr-tablewrap">
            <table className="gr-table gr-compact">
              <thead>
                <tr>
                  <th>{t("c.row")}</th>
                  <th>{t("c.name")}</th>
                  <th>{t("c.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((s, i) => (
                  <tr key={i}>
                    <td>{s.line}</td>
                    <td>{s.name || t("im.empty")}</td>
                    <td>{t(s.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="gr-actions">
          <button className="gr-btn" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t("im.importsp")} onClose={onClose} wide lang={lang} confirmOutsideClick>
      {!headers ? (
        <>
          <p className="gr-muted">{t("im.introsp")}</p>
          <p className="gr-muted">
            {t("tpl.hint")}{" "}
            <button
              type="button"
              className="gr-mini"
              onClick={() => downloadTemplate("grensrock-template-sponsors.xlsx", SPONSOR_TEMPLATE, t)}
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
          <div className="gr-grid3">
            {IMPORT_FIELDS.map(([field, labelKey]) => (
              <Field key={field} label={t(labelKey)}>
                <select
                  value={map[field] ?? -1}
                  onChange={(e) => setMap({ ...map, [field]: Number(e.target.value) })}
                >
                  <option value={-1}>{t("im.skip")}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || t("im.column", { n: i + 1 })}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          {(map.companyName ?? -1) < 0 && (
            <p className="gr-muted" style={{ color: "var(--red)" }}>
              {t("im.selcompany")}
            </p>
          )}
          {analysis && (
            <>
              <h4 className="gr-subhead">{t("im.preview")}</h4>
              <p className="gr-muted">
                <Tag tone="green">{t("im.newcount", { n: analysis.create.length })}</Tag>{" "}
                <Tag tone={analysis.skipped.length ? "amber" : "grey"}>
                  {t("im.skippedwhy", { n: analysis.skipped.length })}
                </Tag>
              </p>
              {analysis.create.length > 0 && (
                <div className="gr-tablewrap">
                  <table className="gr-table gr-compact">
                    <thead>
                      <tr>
                        <th>{t("c.company")}</th>
                        <th>{t("c.vat")}</th>
                        <th>{t("c.contact")}</th>
                        <th>{t("c.email")}</th>
                        <th>{t("im.lang")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.create.slice(0, 6).map((c, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{c.companyName}</strong>
                          </td>
                          <td>
                            {c.vatNumber
                              ? c.vatInvalid
                                ? (
                                    <span
                                      style={{ color: "var(--red)" }}
                                      title={t("im.badvat")}
                                    >
                                      ⚠ {c.vatNumber}
                                    </span>
                                  )
                                : c.vatNumber
                              : "—"}
                          </td>
                          <td>{c.contactPreview || "—"}</td>
                          <td>
                            {c.emailPreview
                              ? c.mailInvalid
                                ? (
                                    <span
                                      style={{ color: "var(--red)" }}
                                      title={t("im.bademail")}
                                    >
                                      ⚠ {c.emailPreview}
                                    </span>
                                  )
                                : c.emailPreview
                              : "—"}
                          </td>
                          <td>{(c.langPreview || "nl").toUpperCase()}</td>
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
            <button className="gr-btn" disabled={!analysis || analysis.create.length === 0} onClick={doImport}>
              {t("im.dosp", { n: analysis ? analysis.create.length : 0 })}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
