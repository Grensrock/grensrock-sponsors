-- ============================================================
-- 0022 — a sponsor can say no to an edition
-- ============================================================
-- Until now a sponsor and an edition were either joined by an agreement or
-- not, and "not" meant two different things the team could not tell apart:
-- nobody has asked yet, or they were asked and declined. This table records
-- the second, so the sponsors still to approach for an edition are the ones
-- with neither an agreement nor a decline.
--
-- Not a deal with a "declined" flag: every total, count, invoice list and
-- voucher run reads deals, and each would need to learn to skip it.
--
-- Team-only. A sponsor never sees it in the portal — it is the team's note
-- about them, not something they act on.
-- ============================================================

create table sponsor_declines (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  edition_id uuid not null references editions(id) on delete cascade,
  reason text not null default '',
  declined_at timestamptz not null default now(),
  -- Who recorded it, as a name — the same loose reference deals.responsible is.
  recorded_by text not null default '',
  unique (sponsor_id, edition_id)
);
create index sponsor_declines_edition_idx on sponsor_declines(edition_id);

alter table sponsor_declines enable row level security;

create policy sponsor_declines_select_team on sponsor_declines for select using (is_team());
create policy sponsor_declines_insert_team on sponsor_declines for insert with check (is_team());
create policy sponsor_declines_update_team on sponsor_declines for update using (is_team()) with check (is_team());
create policy sponsor_declines_delete_team on sponsor_declines for delete using (is_team());

-- ---------- an agreement overrides a decline ----------
-- A sponsor who said no and then signs anyway — or picks a formula in the
-- portal — has changed their mind; leaving the decline would have them
-- counted both ways. Security definer because the agreement may come from a
-- portal session, which has no rights on this table.
create or replace function clear_sponsor_decline()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from sponsor_declines where sponsor_id = new.sponsor_id and edition_id = new.edition_id;
  return new;
end;
$$;

create trigger deals_clear_decline after insert on deals
  for each row execute function clear_sponsor_decline();

-- ---------- audit ----------
-- Logged against the sponsor, so it shows in their history without widening
-- audit_log's entity list; the edition goes in the detail.
create or replace function log_sponsor_decline()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  act record;
  r sponsor_declines%rowtype;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select * into act from current_actor();
  insert into audit_log (actor_type, actor_id, actor_name, entity, entity_id, entity_name, action, detail)
  values (
    act.actor_type, act.actor_id, act.actor_name, 'sponsor', r.sponsor_id,
    coalesce((select company_name from sponsors where id = r.sponsor_id), ''),
    case tg_op when 'INSERT' then 'declined edition' when 'UPDATE' then 'updated decline' else 'decline withdrawn' end,
    coalesce((select name from editions where id = r.edition_id), '')
  );
  return null;
end;
$$;

create trigger audit_sponsor_declines after insert or update or delete on sponsor_declines
  for each row execute function log_sponsor_decline();
