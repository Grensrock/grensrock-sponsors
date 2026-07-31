-- Grensrock Sponsors — Stage 2 sponsor-portal RPCs
-- Run after 0003_rls.sql.
--
-- Every sponsor-portal write goes through one of these SECURITY DEFINER
-- functions instead of a direct table policy, so each one can allowlist exact
-- columns and re-derive the caller's own sponsor_id server-side (never trust
-- a sponsor_id passed as a parameter). Business-rule guards below (e.g.
-- "can't edit once vouchers are generated") mirror the two genuine guards
-- found in the original client code (updateDealExtra/updateDealSplit,
-- acceptAgreement) — everything else was previously only a UI convention,
-- not enforced, which is exactly what these functions now fix.

-- ---------- sponsor's own company info ----------
create or replace function update_sponsor_info(patch jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;

  if patch ? 'voucherContactId' and nullif(patch->>'voucherContactId','') is not null then
    if not exists (select 1 from contacts where id = (patch->>'voucherContactId')::uuid and sponsor_id = sid) then
      raise exception 'voucherContactId must be a contact of your own sponsor.';
    end if;
  end if;

  update sponsors set
    company_name = coalesce(patch->>'companyName', company_name),
    street = coalesce(patch->>'street', street),
    house_number = coalesce(patch->>'houseNumber', house_number),
    postal_code = coalesce(patch->>'postalCode', postal_code),
    city = coalesce(patch->>'city', city),
    vat_number = coalesce(patch->>'vatNumber', vat_number),
    voucher_contact_id = case when patch ? 'voucherContactId'
      then nullif(patch->>'voucherContactId','')::uuid else voucher_contact_id end,
    ref_required = coalesce((patch->>'refRequired')::boolean, ref_required)
  where id = sid;
end;
$$;

-- ---------- add/edit a contact for the caller's own sponsor ----------
create or replace function upsert_sponsor_contact(contact jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
  cid uuid := nullif(contact->>'id','')::uuid;
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;

  if cid is not null then
    if not exists (select 1 from contacts where id = cid and sponsor_id = sid) then
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
    return cid;
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
      coalesce((contact->>'portalAccess')::boolean, false)
    )
    returning id into cid;
    return cid;
  end if;
end;
$$;

-- ---------- self-service formula selection ----------
create or replace function request_formula(p_edition_id uuid, p_formula_name text, p_requested_by text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
  f formulas%rowtype;
  new_id uuid;
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;

  select * into f from formulas where edition_id = p_edition_id and name = p_formula_name;
  if not found then
    raise exception 'Formula not found for this edition.';
  end if;

  if not exists (select 1 from editions where id = p_edition_id and active) then
    raise exception 'This edition is not open for self-service.';
  end if;

  select id into new_id from deals where sponsor_id = sid and edition_id = p_edition_id;
  if found then
    return new_id; -- already has one — matches requestFormula's silent no-op today
  end if;

  insert into deals (
    sponsor_id, edition_id, formula_name,
    cost, vip_friday, vip_saturday, vip_guests, drink_tickets, drink_vouchers,
    food_drink_value, base_food_drink, food_drink_vouchers,
    folder_mention, website_mention, poster_mention, ledboarding,
    barrier_covers, heras_covers, requested_at, requested_by
  ) values (
    sid, p_edition_id, f.name,
    f.cost, f.vip_friday, f.vip_saturday, f.vip_guests, f.drink_tickets, f.drink_vouchers,
    f.food_drink_value, f.base_food_drink, f.food_drink_vouchers,
    f.folder_mention, f.website_mention, f.poster_mention, f.ledboarding,
    f.barrier_covers, f.heras_covers, now(), p_requested_by
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------- top up food & drink value ----------
create or replace function update_deal_food_drink(p_deal_id uuid, p_food_drink_value numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;
  if not exists (select 1 from deals where id = p_deal_id and sponsor_id = sid) then
    raise exception 'Deal not found.';
  end if;
  if exists (select 1 from vouchers where deal_id = p_deal_id and type = 'food' and status <> 'pending') then
    return; -- vouchers already created — matches updateDealExtra's guard
  end if;

  update deals set food_drink_value = p_food_drink_value, food_drink_vouchers = '[]'::jsonb
  where id = p_deal_id;
  delete from vouchers where deal_id = p_deal_id and type = 'food' and status = 'pending';
end;
$$;

-- ---------- split a voucher pool into named portions ----------
create or replace function update_deal_voucher_split(p_deal_id uuid, p_pool text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;
  if p_pool not in ('drink', 'food') then
    raise exception 'Invalid pool.';
  end if;
  if not exists (select 1 from deals where id = p_deal_id and sponsor_id = sid) then
    raise exception 'Deal not found.';
  end if;
  if exists (select 1 from vouchers where deal_id = p_deal_id and type = p_pool and status <> 'pending') then
    return; -- already created — matches updateDealSplit's guard
  end if;

  if p_pool = 'drink' then
    update deals set drink_vouchers = p_rows where id = p_deal_id;
  else
    update deals set food_drink_vouchers = p_rows where id = p_deal_id;
  end if;
  delete from vouchers where deal_id = p_deal_id and type = p_pool and status = 'pending';
end;
$$;

-- ---------- accept a deal/contract ----------
create or replace function accept_deal(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c contacts%rowtype;
  d deals%rowtype;
begin
  select * into c from contacts where auth_user_id = auth.uid();
  if not found then
    raise exception 'Not logged in as a sponsor contact.';
  end if;

  select * into d from deals where id = p_deal_id and sponsor_id = c.sponsor_id;
  if not found then
    raise exception 'Deal not found.';
  end if;
  if d.acceptance is not null then
    return; -- already accepted — matches acceptAgreement's guard
  end if;

  update deals set acceptance = jsonb_build_object(
    'acceptedAt', now(),
    'name', trim(both ' ' from coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
    'email', c.email,
    'contactId', c.id,
    'snapshot', jsonb_build_object(
      'formulaName', d.formula_name, 'cost', d.cost, 'settlement', d.settlement,
      'notes', d.notes, 'inKindDescription', d.in_kind_description, 'inKindValue', d.in_kind_value,
      'invoiceReference', d.invoice_reference,
      'vipFriday', d.vip_friday, 'vipSaturday', d.vip_saturday, 'vipGuests', d.vip_guests,
      'drinkTickets', d.drink_tickets, 'drinkVouchers', d.drink_vouchers,
      'foodDrinkValue', d.food_drink_value, 'baseFoodDrink', d.base_food_drink,
      'foodDrinkVouchers', d.food_drink_vouchers,
      'folderMention', d.folder_mention, 'websiteMention', d.website_mention, 'posterMention', d.poster_mention,
      'ledboarding', d.ledboarding, 'barrierCovers', d.barrier_covers, 'herasCovers', d.heras_covers
    )
  )
  where id = p_deal_id;
end;
$$;

-- ---------- pass on / take back a voucher ----------
create or replace function assign_voucher_recipient(p_voucher_id uuid, p_recipient_name text, p_recipient_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;
  if not exists (select 1 from vouchers where id = p_voucher_id and sponsor_id = sid and status <> 'cancelled') then
    raise exception 'Voucher not found or no longer editable.';
  end if;

  update vouchers set recipient_name = p_recipient_name, recipient_email = p_recipient_email
  where id = p_voucher_id;
end;
$$;

-- ---------- explicit grants (defense in depth; Postgres defaults to PUBLIC
-- execute, but this makes the intent unambiguous and blocks anonymous calls) ----------
revoke execute on function update_sponsor_info(jsonb) from public;
revoke execute on function upsert_sponsor_contact(jsonb) from public;
revoke execute on function request_formula(uuid, text, text) from public;
revoke execute on function update_deal_food_drink(uuid, numeric) from public;
revoke execute on function update_deal_voucher_split(uuid, text, jsonb) from public;
revoke execute on function accept_deal(uuid) from public;
revoke execute on function assign_voucher_recipient(uuid, text, text) from public;

grant execute on function update_sponsor_info(jsonb) to authenticated;
grant execute on function upsert_sponsor_contact(jsonb) to authenticated;
grant execute on function request_formula(uuid, text, text) to authenticated;
grant execute on function update_deal_food_drink(uuid, numeric) to authenticated;
grant execute on function update_deal_voucher_split(uuid, text, jsonb) to authenticated;
grant execute on function accept_deal(uuid) to authenticated;
grant execute on function assign_voucher_recipient(uuid, text, text) to authenticated;
