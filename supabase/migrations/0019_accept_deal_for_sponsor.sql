-- ============================================================
-- 0019 — an admin can accept an agreement on the sponsor's behalf
-- ============================================================
-- Not every sponsor clicks through the portal. Some say yes by mail,
-- on the phone or on paper, and until now the agreement then stayed
-- "not yet accepted" for good. An admin can now record that acceptance.
--
-- It is recorded as what it is: `byTeam` is set, and the name and
-- address are the admin's, not a contact's — so nobody reading it later
-- mistakes it for the sponsor having clicked "accept" themselves. The
-- terms are frozen exactly as accept_deal() freezes them, which is why
-- that snapshot now lives in one function both of them call.
-- ============================================================

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
    'ledboarding', d.ledboarding, 'barrierCovers', d.barrier_covers, 'herasCovers', d.heras_covers
  );
$$;

-- Unchanged from 0016 except that the snapshot comes from the shared function.
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
    'snapshot', deal_terms_snapshot(d)
  )
  where id = p_deal_id;
end;
$$;

create or replace function accept_deal_for_sponsor(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p profiles%rowtype;
  d deals%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can accept an agreement on the sponsor''s behalf.';
  end if;
  select * into p from profiles where id = auth.uid();

  select * into d from deals where id = p_deal_id;
  if not found then
    raise exception 'Deal not found.';
  end if;
  if d.acceptance is not null then
    return; -- already accepted, by the sponsor or by someone else on the team
  end if;

  update deals set acceptance = jsonb_build_object(
    'acceptedAt', now(),
    'name', trim(both ' ' from coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    'email', p.email,
    'contactId', null,
    'byTeam', true,
    'snapshot', deal_terms_snapshot(d)
  )
  where id = p_deal_id;
end;
$$;

revoke execute on function accept_deal_for_sponsor(uuid) from public;
grant execute on function accept_deal_for_sponsor(uuid) to authenticated;
