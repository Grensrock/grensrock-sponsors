"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import { LOGO_ACCEPT, LOGO_MIN_PX, parseLogo, prettyBytes, readLogoFile, type LogoRecord } from "@/lib/logo";
import { storage } from "@/lib/storage";
import type { Tone, TranslateFn } from "@/types";

/* Reusable logo block: shows current logo, allows upload/replace/remove */
export default function ImageStore({
  storageKey,
  compact,
  readOnly,
  label,
  requirements,
  t = (k) => k,
}: {
  storageKey: string;
  compact?: boolean;
  readOnly?: boolean;
  label?: string;
  requirements?: string;
  t?: TranslateFn;
}) {
  const [logo, setLogo] = useState<LogoRecord | null>(null); // parsed record
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await storage.get(storageKey, true);
        if (live && r && r.value) setLogo(parseLogo(r.value));
      } catch {
        /* nothing stored yet */
      }
    })();
    return () => {
      live = false;
    };
  }, [storageKey]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const record = await readLogoFile(file);
      await storage.set(storageKey, JSON.stringify(record), true);
      setLogo(record);
    } catch (ex) {
      setErr((ex as Error).message || "Couldn't read this file.");
    }
    setBusy(false);
    e.target.value = "";
  };

  const remove = async () => {
    try {
      await storage.delete(storageKey, true);
    } catch {
      /* already gone */
    }
    setLogo(null);
  };

  /* What we can actually render: SVG/PNG/JPEG inline, other vectors as a file card */
  const preview =
    logo &&
    (logo.previewable && logo.ext !== "pdf" ? (
      <img src={logo.dataUrl} alt={label || "Logo"} />
    ) : logo.vector ? (
      <span className="gr-filecard">
        <strong>.{logo.ext || "file"}</strong>
        <span className="gr-muted">{logo.name}</span>
      </span>
    ) : (
      <img src={logo.dataUrl} alt={label || "Logo"} />
    ));

  if (readOnly) {
    if (!logo) return null;
    return (
      <figure className="gr-examplefig">
        {logo.previewable && logo.ext !== "pdf" ? (
          <img src={logo.dataUrl} alt={label || ""} />
        ) : (
          <div className="gr-logoframe">{preview}</div>
        )}
        {label && <figcaption>{label}</figcaption>}
      </figure>
    );
  }

  /* Quality feedback on what is stored now */
  const quality: { tone: Tone; text: string } | null = !logo
    ? null
    : logo.vector
      ? { tone: "green", text: `Vector file (.${logo.ext}) — ideal for print` }
      : logo.width
        ? logo.width >= LOGO_MIN_PX && (logo.height ?? 0) >= LOGO_MIN_PX
          ? {
              tone: logo.type === "image/jpeg" ? "amber" : "green",
              text: `${logo.width}×${logo.height} px${
                logo.type === "image/jpeg" ? " — JPEG has no transparent background; PNG or vector is better" : ""
              }`,
            }
          : { tone: "amber", text: `${logo.width}×${logo.height} px — below ${LOGO_MIN_PX}×${LOGO_MIN_PX}` }
        : null;

  return (
    <div className={"gr-logoblock" + (compact ? " compact" : "")}>
      <div className="gr-logoframe">{logo ? preview : <span className="gr-muted">{t("im.noimage")}</span>}</div>
      <div className="gr-logobtns">
        <label className="gr-mini gr-filebtn">
          {busy ? "Processing…" : logo ? "Replace" : "Upload"}
          <input type="file" accept={LOGO_ACCEPT} onChange={onFile} hidden />
        </label>
        {logo && (
          <button className="gr-mini gr-danger" onClick={remove}>
            Remove
          </button>
        )}
        {quality && <Tag tone={quality.tone}>{quality.text}</Tag>}
        {(logo?.size ?? 0) > 0 && (
          <span className="gr-muted" style={{ fontSize: 11 }}>
            {prettyBytes(logo!.size!)}
          </span>
        )}
        {err && (
          <span className="gr-muted" style={{ color: "var(--red)", fontSize: 12 }}>
            {err}
          </span>
        )}
        {!err && requirements && (
          <span className="gr-muted" style={{ fontSize: 12 }}>
            {requirements}
          </span>
        )}
        {!err && !requirements && !compact && label && (
          <span className="gr-muted" style={{ fontSize: 12 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
