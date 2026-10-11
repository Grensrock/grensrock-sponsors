-- ============================================================
-- 0021 — drop the old Nadar and Heras cover columns
-- ============================================================
-- 0020 folded barrier_covers (Nadar) and heras_covers (Heras) into one
-- fence_covers column on formulas and deals, and left the old columns in
-- place, unread, so the app deployed at the time kept working until the
-- code that reads fence_covers went live.
--
-- Production now runs that code, and nothing reads the old columns any
-- more: request_formula() and deal_terms_snapshot() were rewritten in 0020
-- to use fence_covers, and accept_deal() builds its snapshot through
-- deal_terms_snapshot(). 0020 copied their values into fence_covers, so
-- dropping them loses nothing.
-- ============================================================

alter table formulas drop column if exists barrier_covers;
alter table formulas drop column if exists heras_covers;
alter table deals    drop column if exists barrier_covers;
alter table deals    drop column if exists heras_covers;
