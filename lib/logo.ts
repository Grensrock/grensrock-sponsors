import { RETURN_EXAMPLES, type ReturnExampleType } from "@/lib/constants";
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

/* Reads a logo file, checks the requirements and returns what we store */
export async function readLogoFile(file: File): Promise<LogoRecord> {
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error(
      `This file is ${prettyBytes(file.size)}. The maximum is ${prettyBytes(LOGO_MAX_BYTES)} — please compress it or send it to us by email.`,
    );
  }
  const ext = fileExt(file.name);
  const vector = isVectorFile(file);
  if (!vector && !RASTER_TYPES.includes(file.type)) {
    throw new Error("Use a vector file (.ai, .eps, .pdf, .svg) or a PNG.");
  }

  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Couldn't read this file."));
    r.readAsDataURL(file);
  });

  const meta = { name: file.name, ext, type: file.type, size: file.size, vector };

  /* Vector files are stored untouched — that's the point of them */
  if (vector) return { ...meta, dataUrl, previewable: ext === "svg" || ext === "pdf" };

  /* Raster: check the minimum resolution before accepting */
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("This doesn't look like a valid image."));
    i.src = dataUrl;
  });
  if (img.width < LOGO_MIN_PX || img.height < LOGO_MIN_PX) {
    throw new Error(
      `This image is ${img.width}×${img.height} px. We need at least ${LOGO_MIN_PX}×${LOGO_MIN_PX} px for print — please supply a larger version, ideally a vector file.`,
    );
  }
  if (file.type === "image/jpeg") {
    // JPEG has no transparency: keep it, but the UI warns about it
    return { ...meta, dataUrl, width: img.width, height: img.height, previewable: true };
  }
  return { ...meta, dataUrl, width: img.width, height: img.height, previewable: true };
}

export const LOGO_REQUIREMENTS = `Preferably a vector file (.ai, .eps, .pdf, .svg). A PNG is fine from ${LOGO_MIN_PX}×${LOGO_MIN_PX} px. Max ${prettyBytes(LOGO_MAX_BYTES)}.`;

export const exampleLabel = (type: ReturnExampleType | string, lang: Language = "nl") =>
  RETURN_EXAMPLES[type as ReturnExampleType]?.[lang] || RETURN_EXAMPLES[type as ReturnExampleType]?.en || type;
