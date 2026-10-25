-- ============================================================
-- 0027 — food & drink vouchers always come on top of the formula
-- ============================================================
-- Food & drink vouchers are never part of a formula: a sponsor who wants
-- them pays for them on top of their contribution, whether they add them
-- in the portal (update_deal_food_drink, as before) or the team puts them
-- in the agreement. So:
--
--   - formulas no longer carry any. Their food & drink value goes to 0 here,
--     and the formula form stops asking for it. Agreements keep what they
--     were made with: they are snapshots, and their base_food_drink still
--     says how much of it was included back then;
--   - adding them is not a change of benefits for an admin to approve
--     (0026): what the trigger holds against the formula no longer includes
--     food & drink. An agreement that waited only because of it waits no
--     longer.
-- ============================================================

update formulas
set food_drink_value = 0, base_food_drink = 0, food_drink_vouchers = '[]'
where food_drink_value <> 0 or base_food_drink <> 0 or food_drink_vouchers <> '[]';

-- Unchanged from 0026 apart from leaving food & drink out.
create or replace function deal_benefits_differ(d deals)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  f formulas%rowtype;
begin
  -- No such formula leaves every field of f null, and the coalesces turn
  -- that into no benefits at all.
  select * into f from formulas where edition_id = d.edition_id and name = d.formula_name;
  return row(
      coalesce(f.vip_friday, 0), coalesce(f.vip_saturday, 0), coalesce(f.vip_guests, 0),
      coalesce(f.drink_value, 0),
      coalesce(f.folder_mention, 'none'), coalesce(f.website_mention, 'none'), coalesce(f.poster_mention, 'none'),
      sorted_zones(coalesce(f.ledboarding, '{}')), coalesce(f.fence_covers, 0)
    ) is distinct from row(
      d.vip_friday, d.vip_saturday, d.vip_guests,
      d.drink_value,
      d.folder_mention, d.website_mention, d.poster_mention,
      sorted_zones(d.ledboarding), d.fence_covers
    );
end;
$$;

-- Unchanged from 0026 apart from leaving food & drink out of what makes the
-- trigger look at the benefits again.
create or replace function review_deal_benefits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admin_name text;
begin
  -- Only an admin approves. Anyone else's write leaves the approval as it
  -- was — apart from the service role, which RLS already trusts with
  -- everything (same exception as guard_profile_privileges, 0011).
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then
      new.benefits_changed_at := null;
      new.benefits_approved_at := null;
      new.benefits_approved_by := '';
    else
      new.benefits_changed_at := old.benefits_changed_at;
      new.benefits_approved_at := old.benefits_approved_at;
      new.benefits_approved_by := old.benefits_approved_by;
    end if;
  end if;

  -- Looked at again only when the benefits, or the formula they are held
  -- against, are written to. So an admin changing a formula later puts none
  -- of its agreements up for approval, and editing the notes of one that
  -- waits does not approve it.
  if tg_op = 'INSERT' or row(
       new.edition_id, new.formula_name, new.vip_friday, new.vip_saturday, new.vip_guests,
       new.drink_value, new.folder_mention, new.website_mention,
       new.poster_mention, sorted_zones(new.ledboarding), new.fence_covers
     ) is distinct from row(
       old.edition_id, old.formula_name, old.vip_friday, old.vip_saturday, old.vip_guests,
       old.drink_value, old.folder_mention, old.website_mention,
       old.poster_mention, sorted_zones(old.ledboarding), old.fence_covers
     ) then
    if not deal_benefits_differ(new) then
      new.benefits_changed_at := null;
      new.benefits_approved_at := null;
      new.benefits_approved_by := '';
    elsif is_admin() then
      select trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
        into admin_name from profiles where id = auth.uid();
      new.benefits_changed_at := now();
      new.benefits_approved_at := now();
      new.benefits_approved_by := coalesce(admin_name, '');
    elsif is_team() then
      new.benefits_changed_at := now();
      new.benefits_approved_at := null;
      new.benefits_approved_by := '';
    end if;
    -- A sponsor (request_formula copies a formula as it is) or the service
    -- role: left as it was.
  end if;

  -- A held mail spells out the terms as they were when it was written.
  if tg_op = 'UPDATE' and deal_terms_snapshot(new) is distinct from deal_terms_snapshot(old) then
    new.pending_mail := null;
  end if;
  -- And once nothing waits, there is nothing left to hold it for.
  if new.benefits_changed_at is null or new.benefits_approved_at is not null then
    new.pending_mail := null;
  end if;
  return new;
end;
$$;

-- Waiting only because of food & drink: nothing left to approve. Any mail
-- held for it is dropped with the wait (the trigger above), so the
-- agreement can be sent the ordinary way.
update deals
set benefits_changed_at = null, benefits_approved_at = null, benefits_approved_by = ''
where benefits_changed_at is not null and not deal_benefits_differ(deals);
