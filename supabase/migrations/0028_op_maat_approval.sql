-- ============================================================
-- 0028 — an admin approves every agreement made Op maat
-- ============================================================
-- Op maat follows no formula: its price and its benefits are whatever the
-- team member typed. Until now it waited for an admin (0026) only once it
-- gave any benefits, so one for a price alone went to the sponsor
-- straight away. Now every agreement made Op maat waits, benefits or not —
-- and so does one with no formula at all, which the mails and the import
-- already treat as Op maat.
--
-- With no formula to hold it against, the price is part of what the admin
-- approves: changing the cost of an Op maat agreement puts it up for
-- approval again, as changing a benefit does. On an agreement with a
-- formula the cost stays the team's to agree, as before (0026).
--
-- Everything else works as in 0026: an admin's own Op maat agreement counts
-- as approved, the mail written while it waits goes out with the approval,
-- and the sponsor cannot accept it until then.
--
-- Agreements that exist already are left as they are; none of them starts
-- waiting until its formula, price or benefits are next changed.
-- ============================================================

-- Matches OP_MAAT in lib/constants.ts, and isCustom() in lib/benefits.ts.
create or replace function formula_is_custom(formula_name text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(coalesce(formula_name, '')) in ('', 'Op maat');
$$;

-- Unchanged from 0027 apart from Op maat: it always waits, and its cost is
-- among what makes the trigger look at it again.
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

  -- Looked at again only when the benefits, the formula they are held
  -- against, or the price of one made Op maat are written to. So an admin
  -- changing a formula later puts none of its agreements up for approval,
  -- and editing the notes of one that waits does not approve it.
  if tg_op = 'INSERT' or row(
       new.edition_id, new.formula_name, new.vip_friday, new.vip_saturday, new.vip_guests,
       new.drink_value, new.folder_mention, new.website_mention,
       new.poster_mention, sorted_zones(new.ledboarding), new.fence_covers,
       case when formula_is_custom(new.formula_name) then new.cost end
     ) is distinct from row(
       old.edition_id, old.formula_name, old.vip_friday, old.vip_saturday, old.vip_guests,
       old.drink_value, old.folder_mention, old.website_mention,
       old.poster_mention, sorted_zones(old.ledboarding), old.fence_covers,
       case when formula_is_custom(old.formula_name) then old.cost end
     ) then
    if not (formula_is_custom(new.formula_name) or deal_benefits_differ(new)) then
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
