-- ============================================================
-- 0015 — the table grants the migrations were relying on but never made
-- ============================================================
-- RLS decides which rows a caller may touch. It never grants the right to
-- touch the table at all: that is a plain SQL privilege, and without it
-- PostgREST answers "permission denied for table profiles" before any policy
-- is consulted.
--
-- Those privileges were never in a migration. They exist on staging and
-- production because 0001 was run in the SQL Editor, as the note at the top of
-- it says, and objects created there are owned by supabase_admin, whose default
-- ACLs hand select/insert/update/delete to anon and authenticated. Build the
-- same schema from the migration files instead — `supabase db reset`, or a new
-- project restored from this repo — and the tables are owned by the migration
-- role, no default ACL applies, and every request from the app fails.
--
-- Found by standing up the local stack for the first time: sign-in succeeded
-- and the very next query, reading the caller's own profile, was refused.
--
-- Idempotent and safe to apply to environments that already have the grants —
-- it re-states what is already true there. It does not widen anything: every
-- table in public has RLS enabled (0003), so these privileges only get a caller
-- as far as the policies, and integration_secrets still has no policies at all
-- and so stays closed to everyone but the service role.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- So a table added by a later migration does not reintroduce the same hole.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
