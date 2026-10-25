"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { fmtDateTime } from "@/lib/acceptance";
import { BACKUP_TABLES, readBackup } from "@/lib/api/backup";
import { isNetworkError } from "@/lib/errors";
import type { TranslateFn } from "@/types";

/* ---------- Full backup (admin) ----------
   One workbook with a sheet per table (lib/api/backup.ts), every column
   under its database name and every id kept, so the relations survive and
   the file can be put back table by table. That is also why nothing is
   translated or reshaped the way the per-screen exports are: those are for
   reading, this one is for not losing anything. The first sheet says when,
   by whom and from which database, with the row count of each sheet, so a
   backup can be checked for completeness without opening every tab. */

/* Excel takes no more than this in a cell, and SheetJS throws rather than
   write a longer one, which would cost the whole backup for one long value.
   Such a value is cut short instead, and the first sheet says how many were. */
const CELL_MAX = 32767;

const pad = (n: number) => String(n).padStart(2, "0");

export default function Backup({
  by,
  notify,
  t = (k) => k,
}: {
  /** The admin making it, for the first sheet. */
  by: string;
  notify: (message: string, title?: string) => void;
  t?: TranslateFn;
}) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ file: string; rows: number } | null>(null);

  const sheetName = (table: string) => t(`bk.t.${table}`);

  const download = async () => {
    setBusy(true);
    try {
      const backup = await readBackup();
      const now = new Date();

      let cut = 0;
      /* jsonb and array columns go in as JSON, null as an empty cell. */
      const cell = (v: unknown) => {
        if (v === null || v === undefined) return null;
        const out = typeof v === "object" ? JSON.stringify(v) : v;
        if (typeof out === "string" && out.length > CELL_MAX) {
          cut++;
          return out.slice(0, CELL_MAX);
        }
        return out;
      };

      const wb = XLSX.utils.book_new();
      const sheets = BACKUP_TABLES.map((table) => {
        const rows = backup[table].map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cell(v)])));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({
          wch: Math.min(40, rows.reduce((w, r) => Math.max(w, String(r[k] ?? "").length), k.length) + 2),
        }));
        return { table, ws, count: rows.length };
      });

      const total = sheets.reduce((s, x) => s + x.count, 0);
      const info = XLSX.utils.aoa_to_sheet([
        [t("bk.title")],
        [t("bk.made"), fmtDateTime(now.toISOString())],
        [t("bk.by"), by],
        [t("bk.database"), new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://unknown").host],
        [],
        [t("bk.sheet"), t("bk.table"), t("bk.rows")],
        ...sheets.map((s) => [sheetName(s.table), s.table, s.count]),
        [t("bk.total"), "", total],
        [],
        [t("bk.howto")],
        ...(cut ? [[t("bk.cut", { n: cut })]] : []),
      ]);
      info["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, info, t("bk.info"));
      for (const s of sheets) XLSX.utils.book_append_sheet(wb, s.ws, sheetName(s.table));

      /* Down to the minute, so two backups on one day don't overwrite each other. */
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const file = `grensrock-backup-${stamp}.xlsx`;
      XLSX.writeFile(wb, file);
      setLast({ file, rows: total });
      if (cut) notify(t("bk.cut", { n: cut }), t("bk.title"));
    } catch (e) {
      console.error(e);
      notify(isNetworkError(e) ? t("dlg.offline") : String((e as Error)?.message || e), t("bk.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="gr-toolbar">
        <h2 className="gr-h2" style={{ margin: 0 }}>
          {t("bk.title")}
        </h2>
      </div>
      <div className="gr-card">
        <p style={{ marginTop: 0 }}>{t("bk.intro")}</p>
        <p className="gr-muted">
          <strong>{t("bk.contains")}</strong> {BACKUP_TABLES.map(sheetName).join(", ")}.
        </p>
        <p className="gr-muted">{t("bk.notin")}</p>
        <p className="gr-muted">{t("bk.private")}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <button className="gr-btn" onClick={download} disabled={busy}>
            {busy ? t("bk.busy") : t("bk.download")}
          </button>
          {last && !busy && (
            <span className="gr-muted" role="status">
              {t("bk.done", { file: last.file, n: last.rows })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
