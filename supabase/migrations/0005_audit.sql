-- Grensrock Sponsors — Stage 2 audit trail
-- Run after 0004_rpc.sql.
--
-- Replaces the original app's diffForAudit() (which diffed the entire JSON
-- document on every save) with per-table triggers. "detail" lists changed
-- column names via a generic hstore diff rather than porting the original
-- JS's hand-written field-label lookup — simpler, still answers "what changed."

create extension if not exists hstore;

-- Identifies who's making the current write: a team profile, a claimed
-- sponsor contact, or (for anything with no session, e.g. a service-role
-- script) "system".
create or replace function current_actor(out actor_type text, out actor_id uuid, out actor_name text)
returns record
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p profiles%rowtype;
  c contacts%rowtype;
begin
  select * into p from profiles where id = auth.uid();
  if found then
    actor_type := 'team';
    actor_id := p.id;
    actor_name := trim(both ' ' from coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''));
    return;
  end if;

  select * into c from contacts where auth_user_id = auth.uid();
  if found then
    actor_type := 'sponsor';
    actor_id := c.sponsor_id;
    actor_name := trim(both ' ' from coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''));
    return;
  end if;

  actor_type := 'system';
  actor_id := null;
  actor_name := '';
  return;
end;
$$;

create or replace function log_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  act record;
  ent text;
  ent_id uuid;
  ent_name text;
  act_verb text;
  changed text;
  -- jsonb, not direct record field access: OLD has no row type at all during
  -- INSERT (same for NEW during DELETE), and PL/pgSQL resolves record.field
  -- eagerly rather than lazily per CASE branch — direct access throws even
  -- inside a branch that "shouldn't" run for that tg_op. jsonb ->> is always
  -- null-safe, including on a null jsonb value, so this sidesteps it entirely.
  new_j jsonb := to_jsonb(new);
  old_j jsonb := to_jsonb(old);
begin
  select * into act from current_actor();

  ent := case tg_table_name
    when 'sponsors' then 'sponsor'
    when 'contacts' then 'contact'
    when 'deals' then 'agreement'
    when 'editions' then 'edition'
    when 'vouchers' then 'vouchers'
    when 'profiles' then 'account'
  end;

  ent_id := coalesce((new_j->>'id')::uuid, (old_j->>'id')::uuid);

  ent_name := case tg_table_name
    when 'sponsors' then coalesce(new_j->>'company_name', old_j->>'company_name', '')
    when 'contacts' then trim(both ' ' from
      coalesce(new_j->>'first_name', old_j->>'first_name', '') || ' ' ||
      coalesce(new_j->>'last_name', old_j->>'last_name', ''))
    when 'deals' then coalesce(
      (select company_name from sponsors where id = coalesce((new_j->>'sponsor_id')::uuid, (old_j->>'sponsor_id')::uuid)), '')
    when 'editions' then coalesce(new_j->>'name', old_j->>'name', '')
    when 'vouchers' then coalesce(new_j->>'type', old_j->>'type', '')
    when 'profiles' then trim(both ' ' from
      coalesce(new_j->>'first_name', old_j->>'first_name', '') || ' ' ||
      coalesce(new_j->>'last_name', old_j->>'last_name', ''))
  end;

  act_verb := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' when 'DELETE' then 'deleted' end;

  if tg_op = 'UPDATE' then
    changed := array_to_string(akeys(hstore(new) - hstore(old)), ', ');
  else
    changed := '';
  end if;

  insert into audit_log (actor_type, actor_id, actor_name, entity, entity_id, entity_name, action, detail)
  values (act.actor_type, act.actor_id, act.actor_name, ent, ent_id, coalesce(ent_name, ''), act_verb, coalesce(changed, ''));

  return coalesce(new, old);
end;
$$;

create trigger audit_sponsors after insert or update or delete on sponsors
  for each row execute function log_audit();
create trigger audit_contacts after insert or update or delete on contacts
  for each row execute function log_audit();
create trigger audit_deals after insert or update or delete on deals
  for each row execute function log_audit();
create trigger audit_editions after insert or update or delete on editions
  for each row execute function log_audit();
create trigger audit_vouchers after insert or update or delete on vouchers
  for each row execute function log_audit();
create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function log_audit();
