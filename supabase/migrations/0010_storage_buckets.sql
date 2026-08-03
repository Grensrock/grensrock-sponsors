-- ============================================================
-- 0010 — the two storage buckets, as a migration
-- ============================================================
-- 0006_storage.sql created the policies but left the buckets themselves
-- as a manual step in the dashboard. That was fine while there was one
-- database; with a staging project alongside production it is exactly
-- the kind of step that gets forgotten, and the failure is silent —
-- policies referencing a bucket that doesn't exist are perfectly legal,
-- uploads just fail later.
--
-- Both stay PRIVATE: access is controlled by the policies in 0006, not
-- by a public URL.
--
-- Idempotent, so it is a no-op on production where the buckets were
-- already created by hand.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('sponsor-logos', 'sponsor-logos', false),
  ('example-images', 'example-images', false)
on conflict (id) do nothing;
