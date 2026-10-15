-- ============================================================
-- 0023 — a sponsor can be marked as having no VAT number
-- ============================================================
-- The team form now asks for a VAT number unless someone ticks "does not
-- have a VAT number" (private persons, associations, …). Storing that choice
-- tells a deliberate blank apart from one nobody has filled in yet.
--
-- Team-only: the portal RPC (update_sponsor_info) does not touch it.
-- ============================================================

alter table sponsors add column no_vat_number boolean not null default false;
