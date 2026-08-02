-- ============================================================
-- 0009 — VAT lookup moves from VIES to the Belgian company registry
-- ============================================================
-- The old VIES setup (viesapi.eu) needed a private key and a signed
-- Authorization header a browser can't send, so it only ever offered
-- 'test' (fake numbers) and 'proxy' (a server that was never built).
-- Lookups now go through app/api/vat/[vat]/route.ts, which holds the
-- cbeapi.be key server-side, so the proxy URL has nothing left to
-- point at and the two dead modes collapse into one: 'cbe'.
--
-- Data: every existing row is switched to 'cbe'. None of the old modes
-- ever returned real company data, so nobody has meaningfully chosen to
-- run without lookups; an admin can still switch it back off under
-- Editions -> VAT lookup.
-- ============================================================

alter table app_settings drop constraint if exists app_settings_vies_mode_check;

alter table app_settings rename column vies_mode to vat_lookup_mode;

update app_settings set vat_lookup_mode = 'cbe';

alter table app_settings
  alter column vat_lookup_mode set default 'cbe',
  add constraint app_settings_vat_lookup_mode_check check (vat_lookup_mode in ('manual', 'cbe'));

alter table app_settings drop column if exists vies_proxy_url;
