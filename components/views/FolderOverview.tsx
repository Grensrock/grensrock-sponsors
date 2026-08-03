"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Tag from "@/components/ui/Tag";
import { FOLDER_FRACTION, FOLDER_OPTS } from "@/lib/constants";
import { contactName, primaryContact } from "@/lib/contacts";
import { LOGO_MIN_PX, type LogoRecord } from "@/lib/logo";
import { normFolder } from "@/lib/normalize";
import { loadImage, logoRef } from "@/lib/supabase/storage";
import { responsibleName } from "@/lib/users";
import type { Deal, Edition, FolderMention, Sponsor, Tone, TranslateFn, User } from "@/types";

/* ---------- Folder production overview (admin) ---------- */

export default function FolderOverview({
  edition,
  deals,
  sponsors,
  users,
  notify,
  t = (k) => k,
}: {
  edition?: Edition | null;
  deals: Deal[];
  sponsors: Sponsor[];
  users: User[];
  notify: (message: string, title?: string) => void;
  t?: TranslateFn;
}) {
  const [logos, setLogos] = useState<Record<string, LogoRecord | null>>({}); // sponsorId -> record | null
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const rows = useMemo(
    () =>
      deals
        .filter((d) => d.editionId === edition?.id && normFolder(d.folderMention) !== "none")
        .map((d) => {
          const sp = sponsors.find((x) => x.id === d.sponsorId);
          const size = normFolder(d.folderMention);
          return {
            deal: d,
            sponsor: sp,
            size,
            fraction: FOLDER_FRACTION[size] || 0,
            company: sp?.companyName || "?",
          };
        })
        .sort((a, b) => b.fraction - a.fraction || a.company.localeCompare(b.company)),
    [deals, sponsors, edition],
  );

  /* Load each sponsor's logo record so we can show what's missing */
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const out: Record<string, LogoRecord | null> = {};
      for (const r of rows) {
        if (!r.sponsor) continue;
        try {
          out[r.sponsor.id] = await loadImage(logoRef(r.sponsor.id));
        } catch {
          out[r.sponsor.id] = null;
        }
      }
      if (live) {
        setLogos(out);
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [edition?.id, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalFraction = rows.reduce((s, r) => s + r.fraction, 0);
  const pages = Math.ceil(totalFraction);
  const counts = (Object.keys(FOLDER_OPTS) as FolderMention[])
    .filter((k) => k !== "none")
    .map((k) => [k, rows.filter((r) => r.size === k).length] as [FolderMention, number])
    .filter(([, n]) => n > 0);
  const missing = rows.filter((r) => r.sponsor && !logos[r.sponsor.id]);

  const logoQuality = (rec: LogoRecord | null): { tone: Tone; text: string } => {
    if (!rec) return { tone: "amber", text: "missing" };
    if (rec.vector) return { tone: "green", text: `vector .${rec.ext}` };
    if (rec.width)
      return {
        tone: rec.width >= LOGO_MIN_PX && (rec.height ?? 0) >= LOGO_MIN_PX ? "green" : "amber",
        text: `${rec.width}×${rec.height}`,
      };
    return { tone: "grey", text: "uploaded" };
  };

  const exportXlsx = () => {
    const data: Record<string, string | number>[] = rows.map((r) => {
      const rec = r.sponsor ? logos[r.sponsor.id] : null;
      return {
        Sponsor: r.company,
        VAT: r.sponsor?.vatNumber || "",
        "Folder format": FOLDER_OPTS[r.size],
        "Page share": r.fraction,
        Logo: rec ? (rec.vector ? `vector .${rec.ext}` : `${rec.width || "?"}x${rec.height || "?"}`) : "MISSING",
        "Logo file": rec?.name || "",
        Contact: contactName(primaryContact(r.sponsor)) || "",
        Email: primaryContact(r.sponsor)?.email || "",
        Responsible: responsibleName(r.sponsor, users),
        Contribution: Number(r.deal.cost) || 0,
        Notes: r.deal.notes || "",
      };
    });
    data.push({});
    data.push({
      Sponsor: "TOTAL",
      "Folder format": `${rows.length} mentions`,
      "Page share": totalFraction,
      Logo: `${pages} page(s) needed`,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 24 },
      { wch: 20 },
      { wch: 26 },
      { wch: 18 },
      { wch: 12 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folder");
    XLSX.writeFile(wb, `grensrock-folder-${(edition?.name || "edition").replace(/\s+/g, "-").toLowerCase()}.xlsx`);
  };

  /* Folder format first, so a directory listing sorts by how much space the
     mention takes — which is the order the folder is laid out in. */
  const safeName = (company: string) =>
    company
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

  /* Browsers can't write a zip without an extra library, so the logos are
     downloaded one by one, named after the sponsor and their folder format. */
  const downloadLogos = async () => {
    const withLogo = rows.filter((r) => r.sponsor && logos[r.sponsor.id]);
    if (withLogo.length === 0) {
      notify("No logos to download yet.", "Nothing to export");
      return;
    }
    setBusy("logos");
    for (const r of withLogo) {
      const rec = logos[r.sponsor!.id]!;
      const safe = safeName(r.company);
      const ext = rec.ext || (rec.type === "image/png" ? "png" : "img");
      const a = document.createElement("a");
      a.href = rec.dataUrl;
      a.download = `${r.size}_${safe}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((res) => setTimeout(res, 350)); // let the browser keep up
    }
    setBusy("");
    notify(
      `${withLogo.length} logo file(s) downloaded. Your browser may ask permission for multiple downloads.`,
      "Logos exported",
    );
  };


  /* One-way copy into the Shared Drive the design team works from. Supabase
     stays the system of record; this never reads back. Sponsors go one at a
     time so progress is visible and one unreadable file doesn't sink the rest. */
  const exportToDrive = async () => {
    const withLogo = rows.filter((r) => r.sponsor && logos[r.sponsor.id]);
    if (withLogo.length === 0) {
      notify("No logos to export yet.", "Nothing to export");
      return;
    }
    setBusy("drive");
    setProgress({ done: 0, total: withLogo.length });
    let created = 0;
    let updated = 0;
    const failed: string[] = [];

    for (const [i, r] of withLogo.entries()) {
      try {
        const res = await fetch("/api/logos/drive-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sponsorId: r.sponsor!.id, name: `${r.size}_${safeName(r.company)}` }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `Failed (${res.status})`);
        if (body.outcome === "created") created++;
        else updated++;
      } catch (e) {
        failed.push(`${r.company} — ${(e as Error).message}`);
      }
      setProgress({ done: i + 1, total: withLogo.length });
    }

    setBusy("");
    setProgress(null);
    const summary = [created && `${created} new`, updated && `${updated} replaced`].filter(Boolean).join(", ");
    notify(
      failed.length === 0
        ? `${summary || "Nothing"} in the Drive folder.`
        : `${summary || "Nothing"} in the Drive folder.\n\nCouldn't export ${failed.length}:\n${failed.join("\n")}`,
      failed.length === 0 ? "Exported to Drive" : "Exported with problems",
    );
  };

  if (!edition) return <p className="gr-empty">{t("fo.createfirst")}</p>;

  return (
    <>
      <div className="gr-statrow">
        <div className="gr-stat">
          <span>{rows.length}</span>
          {t("fo.foldermentions")}
        </div>
        <div className="gr-stat">
          <span>{totalFraction.toFixed(3).replace(/\.?0+$/, "")}</span>
          {t("fo.pagescontent")}
        </div>
        <div className="gr-stat">
          <span>{pages}</span>
          {t("fo.pagesneeded")}
        </div>
        <div className="gr-stat">
          <span>{missing.length}</span>
          {t("fo.logosmissing")}
        </div>
      </div>

      {counts.length > 0 && (
        <p className="gr-muted">
          {counts.map(([k, n]) => `${n} × ${FOLDER_OPTS[k]}`).join(" · ")}
          {totalFraction % 1 !== 0 && <> — {(pages - totalFraction).toFixed(3).replace(/\.?0+$/, "")} page still free</>}
        </p>
      )}

      <div className="gr-toolbar">
        <div className="gr-detail-btns">
          <button className="gr-btn" onClick={exportXlsx} disabled={rows.length === 0}>
            {t("common.export")}
          </button>
          <button className="gr-btn-ghost" onClick={downloadLogos} disabled={loading || rows.length === 0}>
            {busy === "logos" ? t("fo.downloading") : t("fo.downloadlogos")}
          </button>
          <button className="gr-btn-ghost" onClick={exportToDrive} disabled={!!busy || loading || rows.length === 0}>
            {busy === "drive" && progress
              ? `${t("fo.drivebusy")} ${progress.done}/${progress.total}`
              : t("fo.drive")}
          </button>
        </div>
        {loading && <span className="gr-muted">{t("fo.checking")}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="gr-empty">
          {t("fo.noagr")} {edition.name}.
        </p>
      ) : (
        <div className="gr-tablewrap">
          <table className="gr-table">
            <thead>
              <tr>
                <th>{t("c.company")}</th>
                <th>{t("fo.format")}</th>
                <th className="gr-r">{t("fo.pageshare")}</th>
                <th>Logo</th>
                <th>{t("fo.file")}</th>
                <th>{t("c.responsible")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rec = r.sponsor ? logos[r.sponsor.id] : null;
                const q = logoQuality(rec ?? null);
                return (
                  <tr key={r.deal.id} className={!rec && !loading ? "gr-blocked" : undefined}>
                    <td>
                      <strong>{r.company}</strong>
                    </td>
                    <td>{FOLDER_OPTS[r.size]}</td>
                    <td className="gr-r">{r.fraction}</td>
                    <td>{loading ? <span className="gr-muted">…</span> : <Tag tone={q.tone}>{q.text}</Tag>}</td>
                    <td className="gr-muted">{rec?.name || "—"}</td>
                    <td>{responsibleName(r.sponsor, users) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {missing.length > 0 && !loading && (
        <p className="gr-blockbanner" style={{ marginTop: 14 }}>
          {t("fo.waiting")} {missing.map((r) => r.company).join(", ")}
        </p>
      )}
    </>
  );
}
