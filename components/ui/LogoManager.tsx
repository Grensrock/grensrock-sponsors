"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import * as logosApi from "@/lib/api/logos";
import { LOGO_ACCEPT, logoMessage, logoRequirements, prettyBytes, readLogoFile, type LogoRecord } from "@/lib/logo";
import { loadLogoFile, newLogoPath, removeLogoFile, uploadLogoFile } from "@/lib/supabase/storage";
import type { Language, SponsorLogo } from "@/types";

/* ============================================================
   A sponsor's logos, and what each is for
   ============================================================
   Shared by the team's sponsor detail and the sponsor's own portal —
   both see the same list and can change the same things, so there is one
   component rather than two that drift.

   A file and a row are two writes with no transaction between them. The
   order is chosen so the survivable failure is the one that happens:
   upload first then insert, so a failure leaves an unreferenced object
   (invisible, replaced on the next upload of the same name) rather than
   a row pointing at a file that was never stored, which would render as
   a permanently broken logo.
   ============================================================ */

export default function LogoManager({
  sponsorId,
  logos,
  onChange,
  lang = "nl",
  readOnly,
}: {
  sponsorId: string;
  logos: SponsorLogo[];
  /** Called after any change so the owner can refresh its copy. */
  onChange: (logos: SponsorLogo[]) => void;
  lang?: Language;
  readOnly?: boolean;
}) {
  const L = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang] || en;
  const [files, setFiles] = useState<Record<string, LogoRecord | null>>({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  /* Each file is fetched with the caller's own session and turned into a data
     URL — the bucket is private, so there is no URL to point an <img> at. */
  useEffect(() => {
    let live = true;
    (async () => {
      for (const l of logos) {
        if (files[l.path] !== undefined) continue;
        const rec = await loadLogoFile(l.path).catch(() => null);
        if (!live) return;
        setFiles((prev) => ({ ...prev, [l.path]: rec }));
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logos.map((l) => l.path).join(",")]);

  const upload = async (file: File) => {
    setErr("");
    setBusy("upload");
    try {
      /* Validates size, type and resolution before anything is stored. */
      await readLogoFile(file);
      const path = newLogoPath(sponsorId, file.name);
      await uploadLogoFile(path, file);
      const created = await logosApi.createLogo(sponsorId, path, file.name);
      onChange([...logos, created]);
    } catch (e) {
      setErr(logoMessage(e, lang));
    }
    setBusy("");
  };

  const toggle = async (logo: SponsorLogo, key: "useFolder" | "useLedboarding", value: boolean) => {
    setErr("");
    /* Optimistic: a checkbox that waits for a round trip feels broken. */
    onChange(logos.map((l) => (l.id === logo.id ? { ...l, [key]: value } : l)));
    try {
      await logosApi.updateLogoUse(logo.id, { [key]: value });
    } catch (e) {
      setErr(logoMessage(e, lang));
      onChange(logos.map((l) => (l.id === logo.id ? { ...l, [key]: !value } : l)));
    }
  };

  const remove = async (logo: SponsorLogo) => {
    setErr("");
    setBusy(logo.id);
    try {
      /* Row first: an orphaned object is harmless, a row without a file is not. */
      await logosApi.deleteLogo(logo.id);
      await removeLogoFile(logo.path).catch(() => {
        /* already gone, or never stored */
      });
      onChange(logos.filter((l) => l.id !== logo.id));
    } catch (e) {
      setErr(logoMessage(e, lang));
    }
    setBusy("");
  };

  return (
    <div>
      <p className="gr-muted">
        {L(
          "Laad zoveel logo's op als u wil en duid aan waarvoor elk mag gebruikt worden. Een logo voor de folder is vaak niet hetzelfde als een logo voor de ledboarding.",
          "Téléchargez autant de logos que vous le souhaitez et indiquez à quoi chacun peut servir. Un logo pour le dépliant n'est souvent pas le même que pour le ledboarding.",
          "Upload as many logos as you like and mark what each one may be used for. A logo for the folder is often not the same as one for the LED boarding.",
        )}
      </p>
      <p className="gr-muted" style={{ fontSize: 12 }}>
        {logoRequirements(lang)}
      </p>

      {!readOnly && (
        <label className="gr-btn gr-btn-link" style={{ display: "inline-block", marginBottom: 12 }}>
          {busy === "upload" ? L("Bezig…", "En cours…", "Uploading…") : L("Logo toevoegen", "Ajouter un logo", "Add a logo")}
          <input
            type="file"
            accept={LOGO_ACCEPT}
            style={{ display: "none" }}
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // so the same file can be picked again after a failure
              if (f) upload(f);
            }}
          />
        </label>
      )}

      {err && <p className="gr-warn">{err}</p>}

      {logos.length === 0 ? (
        <p className="gr-empty">{L("Nog geen logo's.", "Pas encore de logos.", "No logos yet.")}</p>
      ) : (
        <div className="gr-logogrid">
          {logos.map((l) => {
            const rec = files[l.path];
            return (
              <div key={l.id} className="gr-logocard">
                <div className="gr-logopreview">
                  {rec === undefined ? (
                    <span className="gr-muted">…</span>
                  ) : rec && rec.previewable ? (
                    <img src={rec.dataUrl} alt={l.fileName} />
                  ) : (
                    <Tag>{rec ? `.${rec.ext}` : L("ontbreekt", "manquant", "missing")}</Tag>
                  )}
                </div>
                <div className="gr-logometa">
                  <strong title={l.fileName}>{l.fileName || l.path.split("/").pop()}</strong>
                  <span className="gr-muted">
                    {rec
                      ? [rec.vector ? `vector .${rec.ext}` : rec.width ? `${rec.width}×${rec.height}` : rec.ext,
                         rec.size ? prettyBytes(rec.size) : ""]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </span>
                  <label className={"gr-check" + (l.useFolder ? " on" : "")}>
                    <input
                      type="checkbox"
                      checked={l.useFolder}
                      disabled={readOnly}
                      onChange={(e) => toggle(l, "useFolder", e.target.checked)}
                    />
                    {L("Folder", "Dépliant", "Folder")}
                  </label>
                  <label className={"gr-check" + (l.useLedboarding ? " on" : "")}>
                    <input
                      type="checkbox"
                      checked={l.useLedboarding}
                      disabled={readOnly}
                      onChange={(e) => toggle(l, "useLedboarding", e.target.checked)}
                    />
                    {L("Ledboarding", "Ledboarding", "LED boarding")}
                  </label>
                  {!readOnly && (
                    <button className="gr-mini gr-danger" disabled={!!busy} onClick={() => remove(l)}>
                      {busy === l.id ? "…" : L("Verwijderen", "Supprimer", "Remove")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
