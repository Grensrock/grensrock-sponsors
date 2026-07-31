-- Grensrock Sponsors — Stage 2 row-level security
-- Run after 0002_auth.sql.
--
-- Delete gating below mirrors the current app's UI exactly (confirmed by reading
-- the extracted components, not guessed): sponsors/deals/editions/formulas/team
-- accounts can only be deleted by an admin; contacts can be deleted by any team
-- member. Sponsor-portal sessions never get direct table write access — all
-- their writes go through the SECURITY DEFINER functions in 0004_rpc.sql.

alter table profiles enable row level security;
alter table sponsors enable row level security;
alter table contacts enable row level security;
alter table editions enable row level security;
alter table formulas enable row level security;
alter table deals enable row level security;
alter table vouchers enable row level security;
alter table audit_log enable row level security;
alter table app_settings enable row level security;
alter table integration_secrets enable row level security; -- zero policies: service-role only

-- ---------- profiles ----------
create policy profiles_select_team on profiles for select using (is_team());
create policy profiles_update_own_or_admin on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());
create policy profiles_delete_admin on profiles for delete using (is_admin());
-- No insert policy: rows are created only via bootstrap_first_admin() or the
-- admin-invite server route, both of which bypass RLS (security definer /
-- service-role client) — see supabase/migrations/README.md.

-- ---------- sponsors ----------
create policy sponsors_select_team on sponsors for select using (is_team());
create policy sponsors_insert_team on sponsors for insert with check (is_team());
create policy sponsors_update_team on sponsors for update using (is_team()) with check (is_team());
create policy sponsors_delete_admin on sponsors for delete using (is_admin());
create policy sponsors_select_own_portal on sponsors for select using (id = my_sponsor_id());
-- No insert/update/delete policy for the sponsor-portal role: all portal writes
-- to a sponsor's own row go through update_sponsor_info() in 0004_rpc.sql.

-- ---------- contacts ----------
create policy contacts_select_team on contacts for select using (is_team());
create policy contacts_insert_team on contacts for insert with check (is_team());
create policy contacts_update_team on contacts for update using (is_team()) with check (is_team());
create policy contacts_delete_team on contacts for delete using (is_team());
create policy contacts_select_own_portal on contacts for select using (sponsor_id = my_sponsor_id());
-- No portal insert/update/delete: goes through upsert_sponsor_contact() in 0004_rpc.sql.

-- ---------- editions ----------
create policy editions_select_team on editions for select using (is_team());
create policy editions_insert_admin on editions for insert with check (is_admin());
create policy editions_update_admin on editions for update using (is_admin()) with check (is_admin());
create policy editions_delete_admin on editions for delete using (is_admin());
create policy editions_select_active_portal on editions for select using (active);

-- ---------- formulas ----------
create policy formulas_select_team on formulas for select using (is_team());
create policy formulas_insert_admin on formulas for insert with check (is_admin());
create policy formulas_update_admin on formulas for update using (is_admin()) with check (is_admin());
create policy formulas_delete_admin on formulas for delete using (is_admin());
create policy formulas_select_active_portal on formulas for select
  using (exists (select 1 from editions e where e.id = formulas.edition_id and e.active));

-- ---------- deals ----------
create policy deals_select_team on deals for select using (is_team());
create policy deals_insert_team on deals for insert with check (is_team());
create policy deals_update_team on deals for update using (is_team()) with check (is_team());
create policy deals_delete_admin on deals for delete using (is_admin());
create policy deals_select_own_portal on deals for select using (sponsor_id = my_sponsor_id());
-- All portal writes to deals go through the RPCs in 0004_rpc.sql
-- (request_formula, update_deal_food_drink, update_deal_voucher_split, accept_deal).

-- ---------- vouchers ----------
create policy vouchers_select_team on vouchers for select using (is_team());
create policy vouchers_insert_team on vouchers for insert with check (is_team());
create policy vouchers_update_team on vouchers for update using (is_team()) with check (is_team());
create policy vouchers_delete_team on vouchers for delete using (is_team());
create policy vouchers_select_own_portal on vouchers for select using (sponsor_id = my_sponsor_id());
-- Portal recipient reassignment goes through assign_voucher_recipient() in 0004_rpc.sql.

-- ---------- audit_log ----------
create policy audit_log_select_admin on audit_log for select using (is_admin());
-- Inserted only by the log_audit() trigger (0005_audit.sql), which runs as the
-- table owner and so isn't blocked by the absence of an insert policy here.

-- ---------- app_settings ----------
create policy app_settings_select_team on app_settings for select using (is_team());
create policy app_settings_update_admin on app_settings for update using (is_admin()) with check (is_admin());
