-- ============================================================
-- 0016 — drink vouchers are agreed as an amount, not as a ticket count
-- ============================================================
-- A formula used to promise "20 drink tickets", each worth a fixed €27.50, and
-- the app multiplied to get the amount the sponsor may divide into vouchers.
-- That fixed unit no longer holds: a formula now names the amount itself, the
-- same way food & drink already did, and the split into vouchers is free.
--
-- drink_tickets is replaced by drink_value on both formulas and deals, keeping
-- the amount every existing record already stood for (tickets × 27.50). The
-- acceptance snapshots frozen on accepted deals carry the same field, so they
-- are rewritten too — otherwise every accepted agreement would read as
-- "changed since acceptance".

-- ---------- formulas + deals ----------
alter table formulas add column if not exists drink_value numeric(10,2) not null default 0;
alter table deals    add column if not exists drink_value numeric(10,2) not null default 0;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'formulas' and column_name = 'drink_tickets') then
    execute 'update formulas set drink_value = round(drink_tickets * 27.5, 2) where drink_value = 0';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'deals' and column_name = 'drink_tickets') then
    execute 'update deals set drink_value = round(drink_tickets * 27.5, 2) where drink_value = 0';
  end if;
end $$;

-- ---------- frozen acceptance snapshots ----------
update deals
set acceptance = jsonb_set(
      acceptance,
      '{snapshot,drinkValue}',
      to_jsonb(round(coalesce((acceptance #>> '{snapshot,drinkTickets}')::numeric, 0) * 27.5, 2))
    ) #- '{snapshot,drinkTickets}'
where acceptance #> '{snapshot,drinkTickets}' is not null;

alter table formulas drop column if exists drink_tickets;
alter table deals    drop column if exists drink_tickets;

-- ---------- the two functions that named the old column ----------
-- Unchanged from 0004 apart from drink_tickets → drink_value.

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
    cost, vip_friday, vip_saturday, vip_guests, drink_value, drink_vouchers,
    food_drink_value, base_food_drink, food_drink_vouchers,
    folder_mention, website_mention, poster_mention, ledboarding,
    barrier_covers, heras_covers, requested_at, requested_by
  ) values (
    sid, p_edition_id, f.name,
    f.cost, f.vip_friday, f.vip_saturday, f.vip_guests, f.drink_value, f.drink_vouchers,
    f.food_drink_value, f.base_food_drink, f.food_drink_vouchers,
    f.folder_mention, f.website_mention, f.poster_mention, f.ledboarding,
    f.barrier_covers, f.heras_covers, now(), p_requested_by
  )
  returning id into new_id;

  return new_id;
end;
$$;

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
      'drinkValue', d.drink_value, 'drinkVouchers', d.drink_vouchers,
      'foodDrinkValue', d.food_drink_value, 'baseFoodDrink', d.base_food_drink,
      'foodDrinkVouchers', d.food_drink_vouchers,
      'folderMention', d.folder_mention, 'websiteMention', d.website_mention, 'posterMention', d.poster_mention,
      'ledboarding', d.ledboarding, 'barrierCovers', d.barrier_covers, 'herasCovers', d.heras_covers
    )
  )
  where id = p_deal_id;
end;
$$;
