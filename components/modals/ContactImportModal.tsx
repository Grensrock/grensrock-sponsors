"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import { COMM_LABELS, emptyContact, label, uid, type CommKey } from "@/lib/constants";
import { contactName, sponsorContacts } from "@/lib/contacts";
import { emailToStore, sameEmail } from "@/lib/email-validate";
import {
  CONTACT_FIELDS,
  autoMapContacts,
  isYes,
  type ColumnMap,
  type ContactField,
} from "@/lib/import-helpers";
import { CONTACT_TEMPLATE, downloadTemplate } from "@/lib/import-template";
import { normLang, normNameKey, normStr } from "@/lib/normalize";
import type { Contact, Language, Sponsor, TranslateFn } from "@/types";

/* ---------- Contact import (xlsx / csv) ---------- */

export interface ContactImportRow {
  sponsorId: string;
  sponsorName: string;
  contact: Contact;
  email: string;
}

interface SkippedRow {
  line: number;
  name: string;
  /** A TEAM_TEXT key, so the list follows the interface language. */
  reason: string;
}

export default function ContactImportModal({
  sponsors,
  onImport,
  onClose,
  t = (k) => k,
  lang = "nl",
}: {
  sponsors: Sponsor[];
  onImport: (list: ContactImportRow[]) => void;
  onClose: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<ColumnMap<ContactField>>({});
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: SkippedRow[] } | null>(null);

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
        setErr(t("im.needheaderct"));
        return;
      }
      const hdr = all[0].map(normStr);
      setHeaders(hdr);
      setRows(all.slice(1));
      setMap(autoMapContacts(hdr));
    } catch {
      setErr(t("im.unreadable"));
    }
  };

  const analysis = useMemo(() => {
    if (!headers || map.company == null || map.company < 0) return null;
    const get = (row: unknown[], f: ContactField) => ((map[f] ?? -1) >= 0 ? normStr(row[map[f]!]) : "");
    const byName = new Map(sponsors.map((s) => [normNameKey(s.companyName), s]));
    const create: ContactImportRow[] = [],
      skipped: SkippedRow[] = [];

    rows.forEach((row, i) => {
      const line = i + 2;
      const company = get(row, "company");
      if (!company) {
        skipped.push({ line, name: "", reason: "im.r.nosponsorname" });
        return;
      }
      const sponsor = byName.get(normNameKey(company));
      if (!sponsor) {
        skipped.push({ line, name: company, reason: "im.r.nosponsor" });
        return;
      }

      const email = emailToStore(get(row, "email"));
      const first = get(row, "firstName"),
        last = get(row, "lastName");
      if (!first && !last && !email) {
        skipped.push({ line, name: company, reason: "im.r.noname" });
        return;
      }

      const already = sponsorContacts(sponsor).some((c) => c.email && email && sameEmail(c.email, email));
      const dupeInFile = create.some(
        (c) => c.sponsorId === sponsor.id && c.email && email && sameEmail(c.email, email),
      );
      if (already) {
        skipped.push({
          line,
          name: `${first} ${last}`.trim() || email,
          reason: "im.r.hascontact",
        });
        return;
      }
      if (dupeInFile) {
        skipped.push({ line, name: email, reason: "im.r.dupfile" });
        return;
      }

      /* Per row, not per column: a template always has both columns, and a
         row that leaves them empty means "the default", not "nothing". */
      const anyPref = !!(get(row, "info") || get(row, "invoice"));
      create.push({
        sponsorId: sponsor.id,
        sponsorName: sponsor.companyName,
        contact: {
          ...emptyContact,
          id: uid(),
          firstName: first,
          lastName: last,
          email,
          phone: get(row, "phone"),
          language: (map.language ?? -1) >= 0 ? normLang(get(row, "language")) : "nl",
          prefs: anyPref
            ? { info: isYes(get(row, "info")), invoice: isYes(get(row, "invoice")) }
            : { info: true, invoice: false },
        },
        email,
      });
    });
    return { create, skipped };
  }, [headers, rows, map, sponsors]);

  if (result) {
    return (
      <Modal title={t("im.donesp")} onClose={onClose} wide lang={lang}>
        <p>
          {t("im.createdct", { n: result.created })}
          {result.skipped.length > 0 && <> {t("im.skippedrows", { n: result.skipped.length })}</>}
        </p>
        {result.skipped.length > 0 && (
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
    <Modal title={t("im.importct")} onClose={onClose} wide lang={lang}>
      {!headers ? (
        <>
          <p className="gr-muted">{t("im.introct")}</p>
          <p className="gr-muted">
            {t("tpl.hint")}{" "}
            <button
              type="button"
              className="gr-mini"
              onClick={() => downloadTemplate("grensrock-template-contacts.xlsx", CONTACT_TEMPLATE, t)}
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
          <p className="gr-muted">{t("im.detectedct")}</p>
          <div className="gr-grid3">
            {CONTACT_FIELDS.map(([field, labelKey]) => (
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
          {(map.company ?? -1) < 0 && (
            <p className="gr-muted" style={{ color: "var(--red)" }}>
              {t("im.selsponsor")}
            </p>
          )}
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
                        <th>{t("c.name")}</th>
                        <th>{t("c.email")}</th>
                        <th>{t("im.lang")}</th>
                        <th>{t("c.receives")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.create.slice(0, 6).map((c, i) => (
                        <tr key={i}>
                          <td>{c.sponsorName}</td>
                          <td>{contactName(c.contact) || "—"}</td>
                          <td>{c.contact.email || "—"}</td>
                          <td>{c.contact.language.toUpperCase()}</td>
                          <td>
                            <div className="gr-commtags">
                              {(Object.keys(COMM_LABELS) as CommKey[])
                                .filter((k) => c.contact.prefs[k])
                                .map((k) => (
                                  <Tag key={k}>{label(COMM_LABELS, k, lang)}</Tag>
                                ))}
                            </div>
                          </td>
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
              disabled={!analysis || analysis.create.length === 0}
              onClick={() => {
                if (!analysis) return;
                onImport(analysis.create);
                setResult({ created: analysis.create.length, skipped: analysis.skipped });
              }}
            >
              {t("im.doct", { n: analysis ? analysis.create.length : 0 })}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
