"use client";

import { useState } from "react";
import wordmark from "@/assets/wordmark.png";
import SponsorPicker from "@/components/forms/SponsorPicker";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { LANGS } from "@/lib/constants";
import { primaryContact } from "@/lib/contacts";
import { isNetworkError } from "@/lib/errors";
import type { Deal, Edition, Language, Sponsor, TranslateFn, User } from "@/types";

/* ---------- The sponsor form, as a PDF to download ----------
   Opened from the sponsor list, where the sponsor is picked here, and from a
   sponsor's own page, where it is that sponsor. The edition decides which
   formulas are on it; the language starts as the sponsor's own. The PDF is
   made right here in the browser (lib/pdf/sponsor-form.ts), and pdf-lib is
   only fetched once someone asks for one. */

const sponsorLang = (s?: Sponsor | null): Language => primaryContact(s)?.language || "nl";

export default function SponsorFormModal({
  sponsors,
  sponsorId,
  editions,
  deals,
  users,
  t,
  lang,
  onClose,
}: {
  sponsors: Sponsor[];
  /** Given from a sponsor's page: that sponsor, and no picking another. */
  sponsorId?: string;
  /** Newest first. */
  editions: Edition[];
  deals: Deal[];
  users: User[];
  t: TranslateFn;
  lang: Language;
  onClose: () => void;
}) {
  const [sid, setSid] = useState(sponsorId || "");
  const [editionId, setEditionId] = useState(() => (editions.find((e) => e.active) || editions[0])?.id || "");
  const [formLang, setFormLang] = useState<Language>(() => sponsorLang(sponsors.find((s) => s.id === sponsorId)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sponsor = sponsors.find((s) => s.id === sid);
  const edition = editions.find((e) => e.id === editionId);
  const deal = sponsor && edition ? deals.find((d) => d.sponsorId === sponsor.id && d.editionId === edition.id) : undefined;

  const download = async () => {
    if (!sponsor || !edition) return;
    setBusy(true);
    setErr("");
    try {
      const [{ sponsorFormPdf, sponsorFormFileName }, mark] = await Promise.all([
        import("@/lib/pdf/sponsor-form"),
        /* The form still works without the wordmark, so a failed fetch only loses the logo. */
        fetch(wordmark.src)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null),
      ]);
      const bytes = await sponsorFormPdf({
        sponsor,
        edition,
        deal,
        responsible: users.find((u) => u.id === sponsor.responsibleId) || null,
        lang: formLang,
        wordmark: mark,
      });
      /* pdf-lib types its bytes as any Uint8Array; Blob wants one over a plain ArrayBuffer, which these are. */
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = sponsorFormFileName(sponsor, edition, formLang);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (e) {
      console.error(e);
      setErr(t("pf.failed", { error: isNetworkError(e) ? t("dlg.offline") : String((e as Error)?.message || e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("pf.title")} onClose={onClose} lang={lang}>
      <p className="gr-muted" style={{ margin: "0 0 12px" }}>
        {t("pf.intro")}
      </p>
      <Field label={t("pf.sponsor")} group>
        <SponsorPicker
          sponsors={sponsors}
          value={sid}
          locked={!!sponsorId}
          onChange={(id) => {
            setSid(id);
            if (id) setFormLang(sponsorLang(sponsors.find((s) => s.id === id)));
          }}
          tr={t}
        />
      </Field>
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
          <select value={formLang} onChange={(e) => setFormLang(e.target.value as Language)}>
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
      {deal && <p className="gr-muted">{t("pf.hasdeal", { edition: edition?.name || "" })}</p>}
      {err && <p className="gr-blockbanner">{err}</p>}
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" disabled={!sponsor || !edition || busy} onClick={download}>
          {busy ? t("pf.busy") : t("pf.download")}
        </button>
      </div>
    </Modal>
  );
}
