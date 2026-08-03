import { supabase } from "@/lib/supabase/client";
import { orEmpty, unwrap, type Row } from "@/lib/api/util";
import type { SponsorLogo } from "@/types";

/* ============================================================
   sponsor_logos
   ============================================================
   The metadata beside each file in the sponsor-logos bucket: which
   sponsor it belongs to and what it may be used for. The file itself
   lives in storage (lib/supabase/storage.ts); this table is what makes
   several of them distinguishable.

   Ordinary table calls — a portal session has its own policies here
   (0014), unlike contacts, because a logo row carries nothing a sponsor
   shouldn't set about themselves.
   ============================================================ */

const COLUMNS = "id, sponsor_id, path, file_name, use_folder, use_ledboarding, created_at";

export function rowToLogo(row: Row): SponsorLogo {
  return {
    id: String(row.id),
    sponsorId: String(row.sponsor_id),
    path: orEmpty(row.path),
    fileName: orEmpty(row.file_name),
    useFolder: !!row.use_folder,
    useLedboarding: !!row.use_ledboarding,
  };
}

/** Every logo the caller may see: all of them for the team, their own for a portal session. */
export async function listLogos(): Promise<SponsorLogo[]> {
  const rows = unwrap<Row[]>(await supabase.from("sponsor_logos").select(COLUMNS).order("created_at"));
  return (rows as Row[]).map(rowToLogo);
}

export async function createLogo(
  sponsorId: string,
  path: string,
  fileName: string,
  use: { useFolder?: boolean; useLedboarding?: boolean } = {},
): Promise<SponsorLogo> {
  const row = unwrap<Row | null>(
    await supabase
      .from("sponsor_logos")
      .insert({
        sponsor_id: sponsorId,
        path,
        file_name: fileName,
        use_folder: !!use.useFolder,
        use_ledboarding: !!use.useLedboarding,
      })
      .select(COLUMNS)
      .single(),
  );
  return rowToLogo(row as Row);
}

export async function updateLogoUse(
  id: string,
  use: { useFolder?: boolean; useLedboarding?: boolean },
): Promise<SponsorLogo> {
  const patch: Row = {};
  if (use.useFolder !== undefined) patch.use_folder = !!use.useFolder;
  if (use.useLedboarding !== undefined) patch.use_ledboarding = !!use.useLedboarding;
  const row = unwrap<Row | null>(
    await supabase.from("sponsor_logos").update(patch).eq("id", id).select(COLUMNS).single(),
  );
  return rowToLogo(row as Row);
}

export async function deleteLogo(id: string): Promise<void> {
  const { error } = await supabase.from("sponsor_logos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
