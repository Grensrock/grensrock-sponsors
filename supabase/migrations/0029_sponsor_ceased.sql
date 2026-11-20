-- ============================================================
-- 0029 — a sponsor can be marked as no longer existing
-- ============================================================
-- Companies go bankrupt, stop or are taken over. Deleting them would take
-- their agreements, vouchers and history with them, so instead the team ticks
-- "this company no longer exists" and may add a short note (bankruptcy,
-- stopped, taken over by …). The sponsor stays in the list, marked, and drops
-- out of "no answer yet for <edition>" so nobody keeps chasing it.
--
-- Team-only: the portal RPC (update_sponsor_info) does not touch it.
-- ============================================================

alter table sponsors add column ceased boolean not null default false;
alter table sponsors add column ceased_note text not null default '';
