-- ============================================================
-- 0011 — a Grensrock Google account no longer grants access by itself
-- ============================================================
-- Until now ensure_team_profile() handed full team access to anyone who
-- signed in with a verified @grensrock.be account. Holding a mailbox on
-- the domain and being allowed to read every sponsor, agreement and
-- invoice are not the same thing. Signing in now only registers a
-- request; an admin turns that into access.
--
-- profiles.approved is deliberately separate from profiles.role: role is
-- what someone may do once they are in, approved is whether they are in
-- at all. Folding a 'pending' value into role would have made every
-- existing `role = 'admin'` comparison ambiguous.
--
-- SAFE TO RUN BEFORE THE MATCHING APP DEPLOY, and that is the intended
-- order: every existing profile is backfilled as approved, and the old
-- client never selects the new column.
-- ============================================================

alter table profiles add column approved boolean not null default false;

-- Everyone already provisioned keeps the access they have today.
update profiles set approved = true;

-- ---------- the gate ----------
-- is_team() is the single choke point every policy in 0003_rls.sql and
-- 0006_storage.sql already goes through, so requiring approval here gates
-- the entire schema in one place rather than policy by policy.

create or replace function is_team()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and approved);
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and approved and role = 'admin');
$$;

-- ---------- a pending person must still see their own row ----------
-- profiles_select_team (0003) is gated on is_team(), which is now false
-- while someone waits. Without a policy for their own row the app cannot
-- tell "waiting for an admin" apart from "not a team member at all", and
-- both would render as an unexplained empty screen.

create policy profiles_select_own on profiles for select using (id = auth.uid());

-- ---------- nobody grants themselves anything ----------
-- profiles_update_own_or_admin (0003) lets a member update their own row,
-- and that has always included role — any user could make themselves an
-- admin with one PostgREST call. After this migration the same hole would
-- let someone approve themselves, which would defeat the whole point.
-- Postgres column privileges are per-role, not per-row, so they cannot
-- express "admins only"; a trigger can.

create or replace function guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- The service-role client (auth.uid() is null) is already fully trusted:
  -- RLS does not apply to it at all, so this trigger must not block it.
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role or new.approved is distinct from old.approved then
    raise exception 'Only an admin can change a team member''s role or access.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileges_update
  before update on profiles
  for each row execute function guard_profile_privileges();

-- ---------- signing in registers a request, it does not grant access ----------
-- Unchanged from 0008 apart from the last column: the domain check is
-- still the real gate on who may even ask, and it still runs server-side.
-- The very first account through the door is still an approved admin —
-- otherwise there would be nobody able to approve anyone, ever.

create or replace function ensure_team_profile()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  fname text;
  lname text;
  full_name text;
  is_first boolean;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return; -- already registered or approved, or pre-invited — leave it alone
  end if;

  -- Google only ever returns verified emails via OAuth, so no separate
  -- email_verified check is needed here — the domain check is the real gate.
  if my_email = '' or right(my_email, length('@grensrock.be')) <> '@grensrock.be' then
    return;
  end if;

  fname := nullif(meta->>'given_name', '');
  lname := nullif(meta->>'family_name', '');
  if fname is null then
    full_name := coalesce(meta->>'full_name', meta->>'name', '');
    fname := nullif(split_part(full_name, ' ', 1), '');
    lname := nullif(trim(substring(full_name from length(split_part(full_name, ' ', 1)) + 1)), '');
  end if;

  is_first := not exists (select 1 from profiles);

  insert into profiles (id, first_name, last_name, email, role, approved)
  values (
    auth.uid(),
    coalesce(fname, split_part(my_email, '@', 1)),
    coalesce(lname, ''),
    my_email,
    case when is_first then 'admin' else 'user' end,
    is_first
  );
end;
$$;
