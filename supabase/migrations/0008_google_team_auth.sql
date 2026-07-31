-- Grensrock Sponsors — Google sign-in for team members
-- Run after 0007_fixes.sql.
--
-- Replaces bootstrap_first_admin() (only reachable from the now-removed password
-- signup form) with a single RPC that runs on every login attempt, team or
-- sponsor, and cheaply no-ops for whichever case doesn't apply. Real domain
-- enforcement happens here, server-side — the `hd` query param on the Google
-- OAuth request is a client-side UX hint only, not a security boundary.

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
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    return; -- already provisioned, or pre-invited and now linked — leave role alone
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

  insert into profiles (id, first_name, last_name, email, role)
  values (
    auth.uid(),
    coalesce(fname, split_part(my_email, '@', 1)),
    coalesce(lname, ''),
    my_email,
    case when not exists (select 1 from profiles) then 'admin' else 'user' end
  );
end;
$$;

revoke execute on function ensure_team_profile() from public;
grant execute on function ensure_team_profile() to authenticated;

drop function if exists bootstrap_first_admin(text, text);
