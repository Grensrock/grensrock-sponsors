"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import { COMMS, emptyContact, uid, type CommKey } from "@/lib/constants";
import { contactName, sponsorContacts } from "@/lib/contacts";
import { emailToStore, sameEmail } from "@/lib/email-validate";
import {
  CONTACT_FIELDS,
  autoMapContacts,
  isYes,
  type ColumnMap,
  type ContactField,
} from "@/lib/import-helpers";
import { normLang, normNameKey, normStr } from "@/lib/normalize";
import type { Contact, Sponsor, TranslateFn } from "@/types";

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
  reason: string;
}

export default function ContactImportModal({
  sponsors,
  onImport,
  onClose,
  t = (k) => k,
}: {
  sponsors: Sponsor[];
  onImport: (list: ContactImportRow[]) => void;
  onClose: () => void;
  t?: TranslateFn;
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
        setErr("The file needs a header row plus at least one contact row.");
        return;
      }
      const hdr = all[0].map(normStr);
      setHeaders(hdr);
      setRows(all.slice(1));
      setMap(autoMapContacts(hdr));
    } catch {
      setErr("Couldn't read this file. Save it as .xlsx or .csv and try again.");
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
        skipped.push({ line, name: "(empty)", reason: "no sponsor name" });
        return;
      }
      const sponsor = byName.get(normNameKey(company));
      if (!sponsor) {
        skipped.push({ line, name: company, reason: "sponsor not found" });
        return;
      }

      const email = emailToStore(get(row, "email"));
      const first = get(row, "firstName"),
        last = get(row, "lastName");
      if (!first && !last && !email) {
        skipped.push({ line, name: company, reason: "no name or email" });
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
          reason: "already a contact of this sponsor",
        });
        return;
      }
      if (dupeInFile) {
        skipped.push({ line, name: email, reason: "duplicate inside file" });
        return;
      }

      const anyPref = [map.info, map.invoice].some((x) => (x ?? -1) >= 0);
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
      <Modal title="Import complete" onClose={onClose} wide>
        <p>
          <strong>{result.created}</strong> contact person(s) added.
          {result.skipped.length > 0 && (
            <>
              {" "}
              <strong>{result.skipped.length}</strong> row(s) skipped.
            </>
          )}
        </p>
        {result.skipped.length > 0 && (
          <div className="gr-tablewrap">
            <table className="gr-table gr-compact">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>{t("c.value")}</th>
                  <th>{t("c.reason")}</th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((s, i) => (
                  <tr key={i}>
                    <td>{s.line}</td>
                    <td>{s.name}</td>
                    <td>{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="gr-actions">
          <button className="gr-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Import contact persons" onClose={onClose} wide>
      {!headers ? (
        <>
          <p className="gr-muted">
            Upload an Excel (.xlsx) or CSV file with one contact per row. The sponsor is matched on the company name
            exactly as it is stored here, so a row whose company doesn&apos;t exist yet is skipped rather than
            creating a new sponsor.
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
          <p className="gr-muted">
            Detected automatically — adjust where needed. Leave the preference columns on &quot;skip&quot; to give
            every imported contact &quot;information&quot; only.
          </p>
          <div className="gr-grid3">
            {CONTACT_FIELDS.map(([field, label]) => (
              <Field key={field} label={label}>
                <select
                  value={map[field] ?? -1}
                  onChange={(e) => setMap({ ...map, [field]: Number(e.target.value) })}
                >
                  <option value={-1}>— skip —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
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
              <h4 className="gr-subhead">Preview</h4>
              <p className="gr-muted">
                <Tag tone="green">{analysis.create.length} to add</Tag>{" "}
                <Tag tone={analysis.skipped.length ? "amber" : "grey"}>{analysis.skipped.length} skipped</Tag>
              </p>
              {analysis.create.length > 0 && (
                <div className="gr-tablewrap">
                  <table className="gr-table gr-compact">
                    <thead>
                      <tr>
                        <th>Sponsor</th>
                        <th>{t("c.name")}</th>
                        <th>{t("c.email")}</th>
                        <th>Lang</th>
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
                              {(Object.keys(COMMS) as CommKey[])
                                .filter((k) => c.contact.prefs[k])
                                .map((k) => (
                                  <Tag key={k}>{COMMS[k]}</Tag>
                                ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {analysis.create.length > 6 && (
                        <tr>
                          <td colSpan={5} className="gr-muted">
                            …and {analysis.create.length - 6} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {analysis.skipped.some((s) => s.reason === "sponsor not found") && (
                <p className="gr-blockbanner" style={{ marginTop: 12 }}>
                  Some company names don&apos;t match a sponsor. Check the spelling, or import those sponsors first
                  via Sponsors → Import list.
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
              Import {analysis ? analysis.create.length : 0} contact(s)
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
