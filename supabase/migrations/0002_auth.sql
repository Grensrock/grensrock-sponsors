-- Grensrock Sponsors — Stage 2 auth helpers
-- Run after 0001_schema.sql.

-- True for any authenticated team member (has a profiles row).
create or replace function is_team()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

-- True for a team member with the admin role.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- The sponsor a logged-in portal contact belongs to, or null if the caller
-- isn't a claimed sponsor contact (e.g. a team member, or an unclaimed session).
create or replace function my_sponsor_id()
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select sponsor_id from contacts where auth_user_id = auth.uid() limit 1;
$$;

-- Called once right after a sponsor's magic-link session starts (from
-- app/auth/callback). Binds the session to the contacts row matching the
-- verified login email, if that contact has portal_access and isn't already
-- claimed by someone else. No-op otherwise — safe to call on every login.
create or replace function claim_portal_contact()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if my_email = '' then
    return;
  end if;

  update contacts
  set auth_user_id = auth.uid()
  where auth_user_id is null
    and portal_access
    and lower(email) = my_email;
end;
$$;

-- Lets the very first person to sign up become the first admin, without ever
-- needing a service-role key in client code. Succeeds only while profiles is
-- empty; every call after that is a no-op (raises if the caller isn't new).
create or replace function bootstrap_first_admin(p_first_name text, p_last_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from profiles) then
    raise exception 'A team account already exists — ask an admin for an invite.';
  end if;

  insert into profiles (id, first_name, last_name, email, role)
  values (auth.uid(), p_first_name, p_last_name, coalesce(auth.jwt() ->> 'email', ''), 'admin');
end;
$$;
