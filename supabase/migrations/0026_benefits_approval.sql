-- ============================================================
-- 0026 — an admin approves benefits that differ from the formula
-- ============================================================
-- A formula fixes what a sponsor gets for their contribution: VIP tickets,
-- drink and food vouchers, visibility. Until now whoever made an agreement
-- could change any of that, and the sponsor was mailed whatever was typed.
-- Now an agreement whose benefits differ from its formula's waits for an
-- admin before it reaches the sponsor:
--
--   - benefits_changed_at: when the benefits were last set apart from the
--     formula; null while they match it.
--   - benefits_approved_at / benefits_approved_by: the admin who approved
--     that, and when. An admin's own change counts as approved — they are
--     who would have approved it.
--   - pending_mail: the agreement mail the team member already wrote, held
--     until then (app/api/deals/send-agreement). Approving sends it
--     (app/api/deals/approve-benefits).
--
-- "Waiting for approval" is benefits_changed_at set and benefits_approved_at
-- null. While it is, the sponsor cannot accept the agreement: not in the
-- portal, and not through an admin on their behalf.
--
-- The database decides all of this, so there is nothing for the browser to
-- set: a trigger holds the benefits against the formula on every write that
-- touches them, and keeps the approval for admins to give.
--
-- The benefits are what the sponsor gets, not what they pay: the cost stays
-- the team's to agree, and so does how a voucher value is split into
-- vouchers (the sponsor can change that in the portal themselves). The food
-- & drink compared is base_food_drink, what the agreement includes; a
-- sponsor topping up in the portal raises only food_drink_value, and pays
-- for the difference.
--
-- An agreement that names no formula of its edition (Op maat, none picked,
-- or one renamed since) is held against no benefits at all: anything it
-- gives was set by hand.
--
-- Agreements that exist already are left as they are; none of them waits.
-- ============================================================

alter table deals
  add column benefits_changed_at timestamptz,
  add column benefits_approved_at timestamptz,
  add column benefits_approved_by text not null default '',
  add column pending_mail jsonb;

-- ---------- what differs ----------
-- LED zones are a set: the form lists them in the order they were ticked.
create or replace function sorted_zones(z text[])
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct x order by x), '{}') from unnest(z) as x;
$$;

-- Security definer for the same reason as clear_sponsor_decline() (0022):
-- the write may come from a portal session.
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
      coalesce(f.drink_value, 0), coalesce(f.food_drink_value, 0),
      coalesce(f.folder_mention, 'none'), coalesce(f.website_mention, 'none'), coalesce(f.poster_mention, 'none'),
      sorted_zones(coalesce(f.ledboarding, '{}')), coalesce(f.fence_covers, 0)
    ) is distinct from row(
      d.vip_friday, d.vip_saturday, d.vip_guests,
      d.drink_value, d.base_food_drink,
      d.folder_mention, d.website_mention, d.poster_mention,
      sorted_zones(d.ledboarding), d.fence_covers
    );
end;
$$;

-- ---------- the trigger ----------
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
       new.drink_value, new.base_food_drink, new.folder_mention, new.website_mention,
       new.poster_mention, sorted_zones(new.ledboarding), new.fence_covers
     ) is distinct from row(
       old.edition_id, old.formula_name, old.vip_friday, old.vip_saturday, old.vip_guests,
       old.drink_value, old.base_food_drink, old.folder_mention, old.website_mention,
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

create trigger deals_review_benefits
  before insert or update on deals
  for each row execute function review_deal_benefits();

-- ---------- nothing waiting can be accepted ----------

-- Unchanged from 0019 apart from the check on the benefits.
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
  if d.benefits_changed_at is not null and d.benefits_approved_at is null then
    raise exception 'This agreement is still being reviewed by Grensrock.';
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

-- Unchanged from 0019 apart from the check on the benefits.
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
  if d.benefits_changed_at is not null and d.benefits_approved_at is null then
    raise exception 'Approve the changed benefits before accepting on the sponsor''s behalf.';
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
