import { RETURN_EXAMPLES, type ReturnExampleType } from "@/lib/constants";
import type { Language } from "@/types";

/* ---------- logo storage (separate shared keys, so the main blob stays small) ---------- */
export const logoKey = (sponsorId: string) => "grensrock:logo:" + sponsorId;

/* ---------- Logo requirements ----------
   Vector is preferred (.ai .eps .pdf .svg); PNG is accepted from 400x400 up.
   The 3.5 MB ceiling comes from the 5 MB-per-key storage limit: files are kept
   base64-encoded, which adds about a third to their size. */
export const LOGO_MIN_PX = 400;
export const LOGO_MAX_BYTES = 3.5 * 1024 * 1024;
export const VECTOR_EXT = ["ai", "eps", "pdf", "svg"];
export const RASTER_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_ACCEPT =
  ".ai,.eps,.pdf,.svg,.png,.jpg,.jpeg,.webp," +
  "image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,application/postscript,application/illustrator";

export const fileExt = (name?: string) => (name || "").split(".").pop()!.toLowerCase();
export const isVectorFile = (file: File) => VECTOR_EXT.includes(fileExt(file.name)) || file.type === "image/svg+xml";
export const prettyBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} kB`;

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

/* Stored value can be a plain data URL (older logos) or a JSON record */
export const parseLogo = (raw?: string | null): LogoRecord | null => {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw) as LogoRecord;
    } catch {
      return null;
    }
  }
  return { dataUrl: raw, name: "", ext: "", vector: false, previewable: true };
};

/* Sponsor logo = ImageStore on the sponsor's own key */
export const LOGO_REQUIREMENTS = `Preferably a vector file (.ai, .eps, .pdf, .svg). A PNG is fine from ${LOGO_MIN_PX}×${LOGO_MIN_PX} px. Max ${prettyBytes(LOGO_MAX_BYTES)}.`;

export const exampleKey = (type: string) => "grensrock:example:" + type;
export const exampleLabel = (type: ReturnExampleType | string, lang: Language = "nl") =>
  RETURN_EXAMPLES[type as ReturnExampleType]?.[lang] || RETURN_EXAMPLES[type as ReturnExampleType]?.en || type;
