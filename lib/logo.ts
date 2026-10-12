import { RETURN_EXAMPLES, type ReturnExampleType } from "@/lib/constants";
import { isNetworkError } from "@/lib/errors";
import type { Language } from "@/types";

/* ---------- Logo requirements ----------
   Vector is preferred (.ai .eps .pdf .svg); PNG is accepted from 400x400 up.

   The ceiling used to be 3.5 MB, which was a localStorage artefact: values were
   kept base64-encoded against a 5 MB-per-key budget, and base64 costs about a
   third. Logos live in Supabase Storage now (lib/supabase/storage.ts), where
   neither constraint exists — so the old limit was turning away exactly the
   print-quality vector files we most want.

   10 MB is a browser limit rather than a storage one: ImageStore downloads the
   object and turns it into a data URL to preview it, so something has to bound
   it. Supabase's own per-file default is 50 MB, well clear of this. */
export const LOGO_MIN_PX = 400;
export const LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const VECTOR_EXT = ["ai", "eps", "pdf", "svg"];
export const RASTER_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_ACCEPT =
  ".ai,.eps,.pdf,.svg,.png,.jpg,.jpeg,.webp," +
  "image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,application/postscript,application/illustrator";

export const fileExt = (name?: string) => (name || "").split(".").pop()!.toLowerCase();
const isVectorFile = (file: File) => VECTOR_EXT.includes(fileExt(file.name)) || file.type === "image/svg+xml";
/* Trailing ".0" is dropped: a stated maximum of "10.0 MB" reads like a
   measurement rather than a round limit. Sizes like 3.5 MB keep the decimal. */
export const prettyBytes = (n: number) => {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
};

export interface LogoRecord {
  name: string;
  ext: string;
  type?: string;
  size?: number;
  vector: boolean;
  dataUrl: string;
  previewable: boolean;
  width?: number;
  height?: number;
}

/* ---------- messages ----------
   Same shape as MAIL_MSG and VAT_MSG: the check reports a code, the caller
   turns it into a sentence in the reader's language. A sponsor uploading a
   logo is the main audience here, and they read NL, FR or EN. */
export const LOGO_MSG: Record<string, (lang: Language, p: Record<string, string | number>) => string> = {
  toobig: (lang, p) =>
    ({
      nl: `Dit bestand is ${p.size}. Het maximum is ${p.max} — verklein het of stuur het ons per e-mail.`,
      fr: `Ce fichier fait ${p.size}. Le maximum est de ${p.max} — compressez-le ou envoyez-le-nous par e-mail.`,
      en: `This file is ${p.size}. The maximum is ${p.max} — please compress it or send it to us by email.`,
    })[lang],
  wrongtype: (lang) =>
    ({
      nl: "Gebruik een vectorbestand (.ai, .eps, .pdf, .svg) of een PNG.",
      fr: "Utilisez un fichier vectoriel (.ai, .eps, .pdf, .svg) ou un PNG.",
      en: "Use a vector file (.ai, .eps, .pdf, .svg) or a PNG.",
    })[lang],
  unreadable: (lang) =>
    ({
      nl: "Dit bestand kon niet gelezen worden.",
      fr: "Ce fichier n'a pas pu être lu.",
      en: "Couldn't read this file.",
    })[lang],
  notimage: (lang) =>
    ({
      nl: "Dit lijkt geen geldige afbeelding.",
      fr: "Ceci ne semble pas être une image valide.",
      en: "This doesn't look like a valid image.",
    })[lang],
  offline: (lang) =>
    ({
      nl: "Geen verbinding met de server — controleer uw internetverbinding en probeer het opnieuw.",
      fr: "Pas de connexion au serveur — vérifiez votre connexion internet et réessayez.",
      en: "No connection to the server — check your internet connection and try again.",
    })[lang],
  toosmall: (lang, p) =>
    ({
      nl: `Deze afbeelding is ${p.got} px. Voor druk hebben we minstens ${p.min} px nodig — bezorg ons een grotere versie, bij voorkeur een vectorbestand.`,
      fr: `Cette image fait ${p.got} px. Pour l'impression il nous faut au moins ${p.min} px — fournissez une version plus grande, de préférence un fichier vectoriel.`,
      en: `This image is ${p.got} px. We need at least ${p.min} px for print — please supply a larger version, ideally a vector file.`,
    })[lang],
};

/* Carries the code so the message can be built in the reader's language at the
   point it is shown, rather than baked in English where it is thrown. */
export class LogoError extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = "LogoError";
  }
}

export const logoMessage = (e: unknown, lang: Language = "nl"): string =>
  e instanceof LogoError
    ? LOGO_MSG[e.code]?.(lang, e.params) || e.code
    : isNetworkError(e)
      ? LOGO_MSG.offline(lang, {})
      : (e as Error)?.message || String(e);

/* Reads a logo file, checks the requirements and returns what we store */
export async function readLogoFile(file: File): Promise<LogoRecord> {
  if (file.size > LOGO_MAX_BYTES) {
    throw new LogoError("toobig", { size: prettyBytes(file.size), max: prettyBytes(LOGO_MAX_BYTES) });
  }
  const ext = fileExt(file.name);
  const vector = isVectorFile(file);
  if (!vector && !RASTER_TYPES.includes(file.type)) {
    throw new LogoError("wrongtype");
  }

  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new LogoError("unreadable"));
    r.readAsDataURL(file);
  });

  const meta = { name: file.name, ext, type: file.type, size: file.size, vector };

  /* Vector files are stored untouched — that's the point of them */
  if (vector) return { ...meta, dataUrl, previewable: ext === "svg" || ext === "pdf" };

  /* Raster: check the minimum resolution before accepting */
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new LogoError("notimage"));
    i.src = dataUrl;
  });
  if (img.width < LOGO_MIN_PX || img.height < LOGO_MIN_PX) {
    throw new LogoError("toosmall", {
      got: `${img.width}×${img.height}`,
      min: `${LOGO_MIN_PX}×${LOGO_MIN_PX}`,
    });
  }
  if (file.type === "image/jpeg") {
    // JPEG has no transparency: keep it, but the UI warns about it
    return { ...meta, dataUrl, width: img.width, height: img.height, previewable: true };
  }
  return { ...meta, dataUrl, width: img.width, height: img.height, previewable: true };
}

export const logoRequirements = (lang: Language = "nl") =>
  ({
    nl: `Bij voorkeur een vectorbestand (.ai, .eps, .pdf, .svg). Een PNG mag vanaf ${LOGO_MIN_PX}×${LOGO_MIN_PX} px. Max ${prettyBytes(LOGO_MAX_BYTES)}.`,
    fr: `De préférence un fichier vectoriel (.ai, .eps, .pdf, .svg). Un PNG convient à partir de ${LOGO_MIN_PX}×${LOGO_MIN_PX} px. Max ${prettyBytes(LOGO_MAX_BYTES)}.`,
    en: `Preferably a vector file (.ai, .eps, .pdf, .svg). A PNG is fine from ${LOGO_MIN_PX}×${LOGO_MIN_PX} px. Max ${prettyBytes(LOGO_MAX_BYTES)}.`,
  })[lang];

export const exampleLabel = (type: ReturnExampleType | string, lang: Language = "nl") =>
  RETURN_EXAMPLES[type as ReturnExampleType]?.[lang] || RETURN_EXAMPLES[type as ReturnExampleType]?.en || type;
