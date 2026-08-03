-- ============================================================
-- 0013 — upsert_sponsor_contact() says whether it granted access
-- ============================================================
-- A sponsor ticking "access to the portal" on a colleague was meant to
-- send that colleague a set-password link. Whether to send was decided
-- in the browser, by comparing the contact being saved against the
-- client's own copy of the previous state — and the portal's copy went
-- stale the moment anything was saved, so the comparison quietly
-- concluded nothing had changed and no mail went out.
--
-- The database is the only place that knows the old value for certain.
-- It now returns it, so the client asks rather than infers.
--
-- Return type changes from uuid to jsonb:
--   { "id": "<uuid>", "granted": true|false }
-- granted is true only on the false->true edge (and on an insert that
-- starts with access), so re-saving an already-active contact still
-- doesn't re-send. Callers must be updated with this migration —
-- lib/api/contacts.ts portalUpsertContact().
-- ============================================================

drop function if exists upsert_sponsor_contact(jsonb);

create or replace function upsert_sponsor_contact(contact jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
  cid uuid := nullif(contact->>'id','')::uuid;
  wanted boolean := coalesce((contact->>'portalAccess')::boolean, false);
  had boolean := false;
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;

  if cid is not null then
    select portal_access into had from contacts where id = cid and sponsor_id = sid;
    if not found then
      raise exception 'Contact does not belong to your sponsor.';
    end if;
    update contacts set
      first_name = coalesce(contact->>'firstName', first_name),
      last_name = coalesce(contact->>'lastName', last_name),
      email = coalesce(contact->>'email', email),
      phone = coalesce(contact->>'phone', phone),
      language = coalesce(contact->>'language', language),
      pref_info = coalesce((contact->'prefs'->>'info')::boolean, pref_info),
      pref_invoice = coalesce((contact->'prefs'->>'invoice')::boolean, pref_invoice),
      portal_access = coalesce((contact->>'portalAccess')::boolean, portal_access)
    where id = cid;
    return jsonb_build_object('id', cid, 'granted', wanted and not coalesce(had, false));
  else
    insert into contacts (sponsor_id, first_name, last_name, email, phone, language, pref_info, pref_invoice, portal_access)
    values (
      sid,
      coalesce(contact->>'firstName', ''),
      coalesce(contact->>'lastName', ''),
      coalesce(contact->>'email', ''),
      coalesce(contact->>'phone', ''),
      coalesce(contact->>'language', 'nl'),
      coalesce((contact->'prefs'->>'info')::boolean, true),
      coalesce((contact->'prefs'->>'invoice')::boolean, false),
      wanted
    )
    returning id into cid;
    -- A brand new contact has no previous state, so ticking the box on
    -- creation is itself the grant.
    return jsonb_build_object('id', cid, 'granted', wanted);
  end if;
end;
$$;
