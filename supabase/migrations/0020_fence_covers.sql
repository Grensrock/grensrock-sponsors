-- ============================================================
-- 0020 — Nadar and Heras covers become one field
-- ============================================================
-- A formula or agreement counted barrier covers (Nadar) and fence covers
-- (Heras) separately. They are now one number, fence_covers: covers for
-- the festival's fencing, Nadar or Heras. Existing rows get the two
-- added together, so no agreed cover is lost.
--
-- Frozen acceptance snapshots get the same treatment. Without it every
-- accepted agreement would read as changed the moment this ran: the
-- snapshot would hold two fields the agreement no longer has, and lack
-- the one it does.
--
-- barrier_covers and heras_covers are left in place, unread. Dropping them
-- here would break the app that is still deployed between this migration
-- and the code that stops reading them; a later migration drops them once
-- production runs that code.
-- ============================================================

alter table formulas add column fence_covers int not null default 0;
alter table deals    add column fence_covers int not null default 0;

update formulas set fence_covers = coalesce(barrier_covers, 0) + coalesce(heras_covers, 0);
update deals    set fence_covers = coalesce(barrier_covers, 0) + coalesce(heras_covers, 0);

comment on column formulas.barrier_covers is 'Deprecated by fence_covers (0020); no longer read. To be dropped.';
comment on column formulas.heras_covers   is 'Deprecated by fence_covers (0020); no longer read. To be dropped.';
comment on column deals.barrier_covers    is 'Deprecated by fence_covers (0020); no longer read. To be dropped.';
comment on column deals.heras_covers      is 'Deprecated by fence_covers (0020); no longer read. To be dropped.';

-- ---------- frozen acceptance snapshots ----------
update deals
set acceptance = jsonb_set(
      acceptance,
      '{snapshot,fenceCovers}',
      to_jsonb(coalesce((acceptance #>> '{snapshot,barrierCovers}')::int, 0)
             + coalesce((acceptance #>> '{snapshot,herasCovers}')::int, 0))
    ) #- '{snapshot,barrierCovers}' #- '{snapshot,herasCovers}'
where acceptance ? 'snapshot';

-- ---------- the two functions that named the old columns ----------

-- Unchanged from 0019 apart from the covers.
create or replace function deal_terms_snapshot(d deals)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'formulaName', d.formula_name, 'cost', d.cost, 'settlement', d.settlement,
    'notes', d.notes, 'inKindDescription', d.in_kind_description, 'inKindValue', d.in_kind_value,
    'invoiceReference', d.invoice_reference,
    'vipFriday', d.vip_friday, 'vipSaturday', d.vip_saturday, 'vipGuests', d.vip_guests,
    'drinkValue', d.drink_value, 'drinkVouchers', d.drink_vouchers,
    'foodDrinkValue', d.food_drink_value, 'baseFoodDrink', d.base_food_drink,
    'foodDrinkVouchers', d.food_drink_vouchers,
    'folderMention', d.folder_mention, 'websiteMention', d.website_mention, 'posterMention', d.poster_mention,
    'ledboarding', d.ledboarding, 'fenceCovers', d.fence_covers
  );
$$;

-- Unchanged from 0016 apart from the covers.
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
    fence_covers, requested_at, requested_by
  ) values (
    sid, p_edition_id, f.name,
    f.cost, f.vip_friday, f.vip_saturday, f.vip_guests, f.drink_value, f.drink_vouchers,
    f.food_drink_value, f.base_food_drink, f.food_drink_vouchers,
    f.folder_mention, f.website_mention, f.poster_mention, f.ledboarding,
    f.fence_covers, now(), p_requested_by
  )
  returning id into new_id;

  return new_id;
end;
$$;
