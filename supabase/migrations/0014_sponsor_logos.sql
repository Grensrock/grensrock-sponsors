-- ============================================================
-- 0014 — a sponsor can have several logos, each with a purpose
-- ============================================================
-- Until now a sponsor had exactly one logo, at the fixed object path
-- sponsor-logos/{sponsorId}/logo.{ext}. One file cannot serve both the
-- folder and the ledboarding well — they want different shapes and
-- often different versions — so a sponsor may now upload as many as
-- they like and say what each is for.
--
-- The bucket policies in 0006_storage.sql already key on the first path
-- segment being the sponsor id, so several objects in that folder need
-- no storage change at all. What was missing is somewhere to record
-- which file is for what; that is this table.
--
-- Portal sessions get their own policies here rather than going through
-- an RPC the way contacts do. The narrow-RPC rule in 0004 exists because
-- contacts carry team-side state a sponsor must not set; a logo row is
-- entirely the sponsor's own, and the storage bucket already lets them
-- write their own folder directly. An RPC would add a hop and no
-- guarantee — the WITH CHECK below says the same thing.
-- ============================================================

create table sponsor_logos (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  -- Object name inside the sponsor-logos bucket: "{sponsorId}/{uuid}.{ext}".
  -- Unique so a row can never point at a file another row also claims.
  path text not null unique,
  -- What the sponsor called it, for the team to recognise. The stored object
  -- is named after a uuid so two "logo.png" uploads cannot collide.
  file_name text not null default '',
  use_folder boolean not null default false,
  use_ledboarding boolean not null default false,
  created_at timestamptz not null default now()
);
create index sponsor_logos_sponsor_idx on sponsor_logos(sponsor_id);

alter table sponsor_logos enable row level security;

create policy sponsor_logos_select_team on sponsor_logos for select using (is_team());
create policy sponsor_logos_insert_team on sponsor_logos for insert with check (is_team());
create policy sponsor_logos_update_team on sponsor_logos for update using (is_team()) with check (is_team());
create policy sponsor_logos_delete_team on sponsor_logos for delete using (is_team());

create policy sponsor_logos_select_own on sponsor_logos for select using (sponsor_id = my_sponsor_id());
create policy sponsor_logos_insert_own on sponsor_logos for insert with check (sponsor_id = my_sponsor_id());
create policy sponsor_logos_update_own on sponsor_logos for update
  using (sponsor_id = my_sponsor_id()) with check (sponsor_id = my_sponsor_id());
create policy sponsor_logos_delete_own on sponsor_logos for delete using (sponsor_id = my_sponsor_id());

-- ---------- adopt whatever is already in the bucket ----------
-- Existing logos were uploaded before this table existed and would
-- otherwise become invisible files nobody can see or delete. Both uses
-- are set, because the single logo they replace was used for everything
-- — nothing should quietly stop appearing in the folder overview.
--
-- Joined on sponsors rather than casting the folder name, so an object
-- in a folder that isn't a sponsor id is skipped instead of erroring.
insert into sponsor_logos (sponsor_id, path, file_name, use_folder, use_ledboarding)
select s.id, o.name, split_part(o.name, '/', 2), true, true
from storage.objects o
join sponsors s on s.id::text = (storage.foldername(o.name))[1]
where o.bucket_id = 'sponsor-logos'
on conflict (path) do nothing;
