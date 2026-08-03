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

/* ---------- several logos per sponsor (0014) ----------
   The single fixed path above is kept for the example images, which are
   genuinely one-per-type. Sponsor logos are now addressed by their own
   object name, recorded in the sponsor_logos table. The first path
   segment is still the sponsor id, so the bucket policies in
   0006_storage.sql apply unchanged. */

export const LOGO_BUCKET = "sponsor-logos";

/** "{sponsorId}/{uuid}.{ext}" — the uuid stops two "logo.png" uploads colliding. */
export function newLogoPath(sponsorId: string, fileName: string) {
  const ext = fileExt(fileName) || "bin";
  return `${sponsorId}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadLogoFile(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
}

/** Reads one logo back into the shape the preview components expect. */
export async function loadLogoFile(path: string): Promise<LogoRecord | null> {
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(path);
  if (error || !data) return null;

  const name = path.split("/").pop() || "";
  const ext = fileExt(name);
  const vector = VECTOR_EXT.includes(ext) || data.type === "image/svg+xml";
  const dataUrl = await readAsDataUrl(data);
  const previewable = vector ? ext === "svg" || ext === "pdf" : true;
  const size = vector || !previewable ? {} : await imageSize(dataUrl);
  return { name, ext, type: data.type, size: data.size, vector, dataUrl, previewable, ...size };
}

export async function removeLogoFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(LOGO_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/** Everything in a sponsor's folder. Their sponsor_logos rows cascade with the
    sponsor row, but storage knows nothing about that — without this, deleting a
    sponsor would leave their files behind with no row left to find them by. */
export async function removeAllLogoFiles(sponsorId: string): Promise<void> {
  const { data } = await supabase.storage.from(LOGO_BUCKET).list(sponsorId, { limit: 1000 });
  const paths = (data || []).map((o) => `${sponsorId}/${o.name}`);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(LOGO_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
