-- ============================================================
-- 0024 — a team user changes only the sponsors they are responsible for
-- ============================================================
-- Until now every approved team member could change every sponsor, its
-- contact persons, its declines and its agreements. Sponsors are divided
-- among the team (sponsors.responsible_id), and that division now holds:
-- someone on the user role may change a sponsor, and what hangs off it,
-- only while they are its responsible. Admins still change anything.
--
-- A sponsor with nobody responsible is therefore admin-only until an
-- admin assigns it to someone.
--
-- What stays open to the whole team:
--   - reading everything (lists, overview, analytics, exports);
--   - creating a sponsor. The form puts whoever creates it down as the
--     responsible by default, but that is the app's default, not a rule;
--   - logos (sponsor_logos and its storage bucket), which sponsors mostly
--     manage themselves in the portal anyway.
--
-- Deleting a sponsor or an agreement was already admin-only (0003) and
-- stays that way. Importing a list of sponsors is admin-only in the app
-- alone: the database cannot tell an import from sponsors created one by
-- one, and creating sponsors is still everyone's.
--
-- The sponsor portal is unaffected. Every portal write goes through the
-- SECURITY DEFINER functions of 0004 and later, which do not consult these
-- policies and check the caller's own sponsor themselves.
-- ============================================================

-- ---------- the rule, in one place ----------
-- Security definer so a policy on contacts, deals or sponsor_declines can
-- read the sponsor's responsible without that read going through RLS again.
-- Also called by the mail routes before they send on someone's behalf
-- (app/api/deals/send-agreement, app/api/portal/invite).

create or replace function can_manage_sponsor(p_sponsor_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select is_admin()
      or (is_team() and exists (
            select 1 from sponsors where id = p_sponsor_id and responsible_id = auth.uid()
          ));
$$;

-- ---------- sponsors ----------
-- USING picks the rows someone may change; WITH CHECK only asks that the
-- result is still written by a team member. That lets a responsible hand a
-- sponsor over to a colleague, after which it is no longer theirs to change.

drop policy sponsors_update_team on sponsors;
create policy sponsors_update_responsible on sponsors for update
  using (is_admin() or (is_team() and responsible_id = auth.uid()))
  with check (is_team());

-- ---------- contacts ----------
-- Both sides of an update are checked, so a contact cannot be moved from a
-- sponsor someone manages to one they don't, or the other way round.

drop policy contacts_insert_team on contacts;
drop policy contacts_update_team on contacts;
drop policy contacts_delete_team on contacts;
create policy contacts_insert_responsible on contacts for insert
  with check (can_manage_sponsor(sponsor_id));
create policy contacts_update_responsible on contacts for update
  using (can_manage_sponsor(sponsor_id))
  with check (can_manage_sponsor(sponsor_id));
create policy contacts_delete_responsible on contacts for delete
  using (can_manage_sponsor(sponsor_id));

-- ---------- sponsor_declines ----------
-- clear_sponsor_decline() (0022) still removes a decline when an agreement
-- is made: it is security definer, so it is not held back by this.

drop policy sponsor_declines_insert_team on sponsor_declines;
drop policy sponsor_declines_update_team on sponsor_declines;
drop policy sponsor_declines_delete_team on sponsor_declines;
create policy sponsor_declines_insert_responsible on sponsor_declines for insert
  with check (can_manage_sponsor(sponsor_id));
create policy sponsor_declines_update_responsible on sponsor_declines for update
  using (can_manage_sponsor(sponsor_id))
  with check (can_manage_sponsor(sponsor_id));
create policy sponsor_declines_delete_responsible on sponsor_declines for delete
  using (can_manage_sponsor(sponsor_id));

-- ---------- deals ----------
-- An agreement belongs to whoever is responsible for its sponsor; there is
-- no separate responsible per agreement (deals.responsible is only the name
-- that signs the confirmation mail). Creating one counts as changing the
-- sponsor: the creator could not edit or send it afterwards otherwise.
-- deals_delete_admin (0003) is left as it is.

drop policy deals_insert_team on deals;
drop policy deals_update_team on deals;
create policy deals_insert_responsible on deals for insert
  with check (can_manage_sponsor(sponsor_id));
create policy deals_update_responsible on deals for update
  using (can_manage_sponsor(sponsor_id))
  with check (can_manage_sponsor(sponsor_id));
