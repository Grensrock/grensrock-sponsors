import { supabase } from "@/lib/supabase/client";
import { VECTOR_EXT, fileExt, type LogoRecord } from "@/lib/logo";

/* ============================================================
   Supabase Storage: sponsor logos & return-example images
   ============================================================
   Replaces the Stage-1 localStorage shim for the two image paths.
   Both buckets are private (0006_storage.sql): objects are fetched with
   the caller's own session and turned into a data URL for display, so
   the components keep working with the same LogoRecord shape as before.

   Path conventions (they are what the RLS policies match on):
     sponsor-logos/{sponsorId}/logo.{ext}
     example-images/{returnType}/example.{ext}
   ============================================================ */

export interface ImageRef {
  bucket: string;
  /** First path segment — the RLS policies key off this for sponsor logos. */
  folder: string;
  /** File name without extension; the extension follows the uploaded file. */
  base: string;
}

export const logoRef = (sponsorId: string): ImageRef => ({
  bucket: "sponsor-logos",
  folder: sponsorId,
  base: "logo",
});

export const exampleRef = (type: string): ImageRef => ({
  bucket: "example-images",
  folder: type,
  base: "example",
});

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read this file."));
    r.readAsDataURL(blob);
  });

const imageSize = (dataUrl: string) =>
  new Promise<{ width?: number; height?: number }>((resolve) => {
    const i = new Image();
    i.onload = () => resolve({ width: i.width, height: i.height });
    i.onerror = () => resolve({});
    i.src = dataUrl;
  });

/** Every stored object for this ref (there should be at most one). */
async function listObjects(ref: ImageRef): Promise<string[]> {
  const { data, error } = await supabase.storage.from(ref.bucket).list(ref.folder, { limit: 100 });
  if (error || !data) return [];
  return data.filter((o) => o.name.startsWith(ref.base + ".")).map((o) => `${ref.folder}/${o.name}`);
}

/** Reads the stored image back into the LogoRecord shape the UI expects. */
export async function loadImage(ref: ImageRef): Promise<LogoRecord | null> {
  const paths = await listObjects(ref);
  if (paths.length === 0) return null;

  const path = paths[0];
  const { data, error } = await supabase.storage.from(ref.bucket).download(path);
  if (error || !data) return null;

  const name = path.split("/").pop() || "";
  const ext = fileExt(name);
  const vector = VECTOR_EXT.includes(ext) || data.type === "image/svg+xml";
  const dataUrl = await readAsDataUrl(data);
  const previewable = vector ? ext === "svg" || ext === "pdf" : true;
  const size = vector || !previewable ? {} : await imageSize(dataUrl);

  return { name, ext, type: data.type, size: data.size, vector, dataUrl, previewable, ...size };
}

/** Replaces whatever was stored for this ref (extension may differ). */
export async function uploadImage(ref: ImageRef, file: File): Promise<void> {
  const ext = fileExt(file.name) || "bin";
  const path = `${ref.folder}/${ref.base}.${ext}`;

  const stale = (await listObjects(ref)).filter((p) => p !== path);
  if (stale.length) await supabase.storage.from(ref.bucket).remove(stale);

  const { error } = await supabase.storage
    .from(ref.bucket)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
}

export async function removeImage(ref: ImageRef): Promise<void> {
  const paths = await listObjects(ref);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(ref.bucket).remove(paths);
  if (error) throw new Error(error.message);
}
