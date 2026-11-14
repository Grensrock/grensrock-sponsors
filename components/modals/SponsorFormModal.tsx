"use client";

import { useState } from "react";
import wordmark from "@/assets/wordmark.png";
import SponsorPicker from "@/components/forms/SponsorPicker";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { LANGS } from "@/lib/constants";
import { primaryContact } from "@/lib/contacts";
import { userName } from "@/lib/users";
import { isNetworkError } from "@/lib/errors";
import type { Deal, Edition, Language, Sponsor, TranslateFn, User } from "@/types";

/* ---------- The sponsor form, as a PDF to download ----------
   Opened from the sponsor list, where the sponsor is picked here; from a
   sponsor's own page, where it is that sponsor; and for the sponsors ticked
   in the list, where each gets a PDF of their own — every one goes to a
   different sponsor — and they come together in one zip. The edition
   decides which formulas are on it; the language starts as each sponsor's
   own. Opened from the list, it can also be the blank form: no sponsor at
   all, for a team member to take along to someone new, and it goes back to
   whoever downloaded it. The PDFs are made right here in the browser (lib/pdf/sponsor-form.ts),
   and pdf-lib and the zip library are only fetched once someone asks. */

const sponsorLang = (s?: Sponsor | null): Language => primaryContact(s)?.language || "nl";

/* How many of a group's names the window lists before "and 12 more". */
const NAMES_SHOWN = 8;

function save(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SponsorFormModal({
  sponsors,
  sponsorId,
  sponsorIds,
  editions,
  deals,
  users,
  me,
  t,
  lang,
  onClose,
}: {
  sponsors: Sponsor[];
  /** Given from a sponsor's page: that sponsor, and no picking another. */
  sponsorId?: string;
  /** Ticked in the sponsor list, in its order. One is the same as sponsorId. */
  sponsorIds?: string[];
  /** Newest first. */
  editions: Edition[];
  deals: Deal[];
  users: User[];
  /** Who is downloading: a blank form goes back to them. */
  me?: User | null;
  t: TranslateFn;
  lang: Language;
  onClose: () => void;
}) {
  const fixedId = sponsorIds?.length === 1 ? sponsorIds[0] : sponsorId;
  const group =
    sponsorIds && sponsorIds.length > 1
      ? sponsorIds.map((id) => sponsors.find((s) => s.id === id)).filter((s): s is Sponsor => !!s)
      : null;
  const [sid, setSid] = useState(fixedId || "");
  /* Only offered when no sponsor was given: from the list's own button. */
  const canBlank = !fixedId && !group;
  const [blank, setBlank] = useState(false);
  const [editionId, setEditionId] = useState(() => (editions.find((e) => e.active) || editions[0])?.id || "");
  /* "" is each sponsor in their own language, which only a group is offered. */
  const [formLang, setFormLang] = useState<Language | "">(() =>
    group ? "" : sponsorLang(sponsors.find((s) => s.id === fixedId)),
  );
  /** What the button says while it works; null when it doesn't. */
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const sponsor = sponsors.find((s) => s.id === sid);
  const edition = editions.find((e) => e.id === editionId);
  const list: (Sponsor | null)[] = group || (blank ? [null] : sponsor ? [sponsor] : []);
  const dealOf = (s: Sponsor | null) =>
    s && edition ? deals.find((d) => d.sponsorId === s.id && d.editionId === edition.id) : undefined;
  const withDeal = list.filter(dealOf).length;

  const download = async () => {
    if (!edition || list.length === 0) return;
    setBusy(t("pf.busy"));
    setErr("");
    let at: Sponsor | null = null;
    try {
      const [{ sponsorFormPdf, sponsorFormFileName, fileSlug }, zip, mark] = await Promise.all([
        import("@/lib/pdf/sponsor-form"),
        group ? import("fflate") : null,
        /* The form still works without the wordmark, so a failed fetch only loses the logo. */
        fetch(wordmark.src)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null),
      ]);
      const files: Record<string, Uint8Array> = {};
      for (const [i, s] of list.entries()) {
        at = s;
        if (group) {
          setBusy(t("pf.busymany", { done: i, total: list.length }));
          await new Promise((r) => setTimeout(r)); // let the count show
        }
        const l = formLang || sponsorLang(s);
        const name = sponsorFormFileName(s, edition, l);
        /* Two sponsors of one name would otherwise overwrite each other in the zip. */
        let unique = name;
        for (let k = 2; unique in files; k++) unique = name.replace(/\.pdf$/, `-${k}.pdf`);
        files[unique] = await sponsorFormPdf({
          sponsor: s,
          edition,
          deal: dealOf(s),
          responsible: s ? users.find((u) => u.id === s.responsibleId) || null : me || null,
          lang: l,
          wordmark: mark,
        });
      }
      at = null;
      /* pdf-lib and fflate type their bytes as any Uint8Array; Blob wants one
         over a plain ArrayBuffer, which these are. PDFs are compressed
         already, so the zip only stores them. */
      if (zip) {
        save(zip.zipSync(files, { level: 0 }) as BlobPart, `${t("pf.zipfile")}-${fileSlug(edition.name)}.zip`, "application/zip");
      } else {
        const [[name, bytes]] = Object.entries(files);
        save(bytes as BlobPart, name, "application/pdf");
      }
      onClose();
    } catch (e) {
      console.error(e);
      const error = isNetworkError(e) ? t("dlg.offline") : String((e as Error)?.message || e);
      setErr(group && at ? t("pf.failedfor", { sponsor: at.companyName, error }) : t("pf.failed", { error }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={group ? t("pf.titlemany", { n: group.length }) : t("pf.title")} onClose={onClose} lang={lang}>
      <p className="gr-muted" style={{ margin: "0 0 12px" }}>
        {t(group ? "pf.intromany" : blank ? "pf.introblank" : "pf.intro")}
      </p>
      {canBlank && (
        <div className="gr-checkrow" style={{ marginBottom: 12 }}>
          <label className={"gr-check gr-check-sm" + (blank ? " on" : "")}>
            <input type="checkbox" checked={blank} onChange={(e) => setBlank(e.target.checked)} />
            <span>{t("pf.blank")}</span>
          </label>
        </div>
      )}
      {group ? (
        <Field label={`${t("nav.sponsors")} (${group.length})`} group>
          <p style={{ margin: 0 }}>
            {group
              .slice(0, NAMES_SHOWN)
              .map((s) => s.companyName)
              .join(", ")}
            {group.length > NAMES_SHOWN && ` ${t("pf.andmore", { n: group.length - NAMES_SHOWN })}`}
          </p>
        </Field>
      ) : blank ? null : (
        <Field label={t("pf.sponsor")} group>
          <SponsorPicker
            sponsors={sponsors}
            value={sid}
            locked={!!fixedId}
            onChange={(id) => {
              setSid(id);
              if (id) setFormLang(sponsorLang(sponsors.find((s) => s.id === id)));
            }}
            tr={t}
          />
        </Field>
      )}
      <div className="gr-grid2">
        <Field label={t("pf.edition")}>
          <select value={editionId} onChange={(e) => setEditionId(e.target.value)}>
            {editions.length === 0 && <option value="">{t("pf.noeditions")}</option>}
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.active ? "" : ` (${t("ov.inactive")})`}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("pf.language")}>
          <select value={formLang} onChange={(e) => setFormLang(e.target.value as Language | "")}>
            {group && <option value="">{t("pf.ownlang")}</option>}
            {(Object.keys(LANGS) as Language[]).map((l) => (
              <option key={l} value={l}>
                {LANGS[l]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {edition && (edition.formulas || []).length === 0 && (
        <p className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
          {t("pf.noformulas", { edition: edition.name })}
        </p>
      )}
      {withDeal > 0 && (
        <p className="gr-muted">
          {group
            ? t("pf.hasdeals", { n: withDeal, edition: edition?.name || "" })
            : t("pf.hasdeal", { edition: edition?.name || "" })}
        </p>
      )}
      {blank && <p className="gr-muted">{me ? t("pf.blankback", { name: userName(me) }) : t("pf.blankbackanyone")}</p>}
      {err && <p className="gr-blockbanner">{err}</p>}
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!edition || list.length === 0 || !!busy} onClick={download}>
          {busy || (group ? t("pf.downloadmany", { n: group.length }) : t("pf.download"))}
        </button>
      </div>
    </Modal>
  );
}
