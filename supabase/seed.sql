-- ============================================================
-- Local development seed
-- ============================================================
-- Runs after the migrations on `supabase db reset`, against the LOCAL stack
-- only (config.toml points db.seed at this file). It is never applied to
-- staging or production: `db push` ships migrations, not seeds.
--
-- The point of it is to make the signed-in screens reachable. Everything past
-- the login page needs a session — the team side through Google Workspace, the
-- portal through a password bound to a contacts row — so on a machine without
-- either, the sponsor list, the agreement form and the portal simply cannot be
-- opened. That has meant UI work getting verified by reading rather than by
-- using, and at least one bug shipping because of it: the full-bleed mobile
-- modal clipped its own content, which only shows on a form with twenty fields
-- in it, not on a mock with four.
--
-- So the fixtures below are not "some data". Each one exists to make a state
-- reachable that otherwise is not — the long agreement, the French portal, the
-- sponsor with no contacts, every settlement type, every acceptance state.
--
-- Passwords are the same throwaway string for every account and are meant to
-- be in version control: this database is disposable and listens on localhost.
-- Nothing here is a credential for anything real.
-- ============================================================

-- ---------- accounts that can sign in ----------
-- Every login in one place rather than a helper function: the CLI's statement
-- splitter mishandles a dollar-quoted function body when it re-seeds, and a
-- set-based insert has nothing for it to get wrong.
--
-- Two things are easy to get wrong here and both fail confusingly. GoTrue needs
-- an identities row as well as a users row, or the account exists but sign-in
-- answers "Invalid login credentials". And the four token columns have to be ''
-- rather than left NULL: they are nullable in the table, but GoTrue scans them
-- into non-nullable Go strings, so a NULL turns every sign-in into a 500 with
-- "Database error querying schema" — which reads like the stack is broken
-- rather than like the row is.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.email, crypt('devdevdev', gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'wout@grensrock.be'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'jonas@grensrock.be'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'nieuw@grensrock.be'),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'jan@vanhonsebrouck.be'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'marie@delacroix.be')
) as u(id, email);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', u.id::text, now(), now(), now()
from auth.users u;

-- ---------- team accounts ----------
-- Two roles, because half the app is gated on admin and "view as user" needs
-- something real to be compared against. The third is unapproved, so the
-- "waiting for an admin" screen is reachable too.
insert into profiles (id, first_name, last_name, email, role, language, approved) values
  ('11111111-1111-1111-1111-111111111111', 'Wout',  'Florin',   'wout@grensrock.be',  'admin', 'nl', true),
  ('22222222-2222-2222-2222-222222222222', 'Jonas', 'Verhaeghe','jonas@grensrock.be', 'user',  'nl', true),
  ('33333333-3333-3333-3333-333333333333', 'Nieuwe','Collega',  'nieuw@grensrock.be', 'user',  'nl', false);

-- ---------- editions ----------
insert into editions (id, name, start_date, end_date, location, active) values
  ('ed000000-0000-0000-0000-000000000026', 'Grensrock 2026', '2026-08-07', '2026-08-08', 'Menen', true),
  ('ed000000-0000-0000-0000-000000000025', 'Grensrock 2025', '2025-08-08', '2025-08-09', 'Menen', false);

insert into formulas (edition_id, name, cost, vip_friday, vip_saturday, vip_guests,
                      drink_value, food_drink_value, base_food_drink,
                      folder_mention, website_mention, poster_mention, ledboarding,
                      barrier_covers, heras_covers) values
  ('ed000000-0000-0000-0000-000000000026', 'Goud',   2500, 4, 4, 2, 550, 250, 250, 'full',    'logo', 'logo', '{vip,stage}', 4, 2),
  ('ed000000-0000-0000-0000-000000000026', 'Zilver', 1250, 2, 2, 1, 275, 100, 100, 'half',    'logo', 'name', '{vip}',       2, 0),
  ('ed000000-0000-0000-0000-000000000026', 'Brons',   500, 1, 1, 0, 110,   0,   0, 'quarter', 'name', 'none', '{}',          0, 0),
  ('ed000000-0000-0000-0000-000000000025', 'Goud',   2400, 4, 4, 2, 550, 200, 200, 'full',    'logo', 'logo', '{vip}',       4, 2),
  ('ed000000-0000-0000-0000-000000000025', 'Brons',   450, 1, 1, 0, 110,   0,   0, 'quarter', 'name', 'none', '{}',          0, 0);

-- ---------- sponsors ----------
insert into sponsors (id, company_name, street, house_number, postal_code, city,
                      vat_number, entity_type, responsible_id, ref_required) values
  -- Dutch, long history, the fullest agreement in the set.
  ('59000000-0000-0000-0000-000000000001', 'Brouwerij Vanhonsebrouck', 'Izegemsestraat', '15', '8870', 'Izegem',
   'BE 0405.128.523', 'legal', '11111111-1111-1111-1111-111111111111', false),
  -- French, and the reason the portal preview exists: this is the one to open
  -- when checking that the sponsor side really reads in French.
  ('59000000-0000-0000-0000-000000000002', 'Boulangerie Delacroix SPRL', 'Rue de la Gare', '42', '7700', 'Mouscron',
   'BE 0876.223.114', 'legal', null, false),
  -- English, needs a reference before it can be invoiced.
  ('59000000-0000-0000-0000-000000000003', 'Menen Logistics NV', 'Havenlaan', '3', '8930', 'Menen',
   'BE 0712.445.900', 'legal', '22222222-2222-2222-2222-222222222222', true),
  -- No contacts at all: the empty state, and the sponsor the portal preview
  -- has to cope with when there is nobody to preview as.
  ('59000000-0000-0000-0000-000000000004', 'Café De Zwaan', 'Grote Markt', '7', '8930', 'Menen',
   '', 'legal', null, false),
  -- A natural person rather than a company.
  ('59000000-0000-0000-0000-000000000005', 'Jan Dewulf', 'Kortrijkstraat', '88', '8930', 'Menen',
   '', 'person', '11111111-1111-1111-1111-111111111111', false);

-- ---------- contacts ----------
insert into contacts (id, sponsor_id, first_name, last_name, email, phone, language,
                      pref_info, pref_invoice, portal_access, auth_user_id) values
  ('c1000000-0000-0000-0000-000000000001', '59000000-0000-0000-0000-000000000001',
   'Jan', 'Peeters', 'jan@vanhonsebrouck.be', '+32 51 33 51 51', 'nl', true, false, true,
   'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', '59000000-0000-0000-0000-000000000001',
   'Els', 'Vermeulen', 'els@vanhonsebrouck.be', '', 'nl', false, true, false, null),
  ('c1000000-0000-0000-0000-000000000003', '59000000-0000-0000-0000-000000000002',
   'Marie', 'Dubois', 'marie@delacroix.be', '+32 56 33 12 00', 'fr', true, true, true,
   'c0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000004', '59000000-0000-0000-0000-000000000003',
   'Peter', 'Novak', 'peter@menenlogistics.be', '', 'en', true, false, false, null),
  -- No email, so the "can't be given portal access" branch is reachable.
  ('c1000000-0000-0000-0000-000000000005', '59000000-0000-0000-0000-000000000005',
   'Jan', 'Dewulf', '', '+32 476 11 22 33', 'nl', true, false, false, null);

update sponsors set voucher_contact_id = 'c1000000-0000-0000-0000-000000000001'
  where id = '59000000-0000-0000-0000-000000000001';

-- ---------- agreements ----------
-- The first one is deliberately maximal: every benefit filled in, so the edit
-- modal is as long as it ever gets. That length is the case that broke.
insert into deals (id, sponsor_id, edition_id, formula_name, cost,
                   vip_friday, vip_saturday, vip_guests, drink_value, drink_vouchers,
                   food_drink_value, base_food_drink, food_drink_vouchers,
                   folder_mention, website_mention, poster_mention, ledboarding,
                   barrier_covers, heras_covers, notes, settlement,
                   in_kind_description, in_kind_value, invoice_reference,
                   invoice_created, invoice_number, confirmed_at, acceptance) values
  ('dea10000-0000-0000-0000-000000000001', '59000000-0000-0000-0000-000000000001',
   'ed000000-0000-0000-0000-000000000026', 'Goud', 2500,
   4, 4, 2, 550, '[{"value":25,"qty":22}]',
   250, 250, '[{"value":25,"qty":10}]',
   'full', 'logo', 'logo', '{vip,stage}', 4, 2,
   'Levert ook de tapinstallatie voor de VIP-tent.', 'invoice',
   '', 0, '', false, '', now(),
   jsonb_build_object(
     'acceptedAt', now() - interval '3 days',
     'name', 'Jan Peeters', 'email', 'jan@vanhonsebrouck.be',
     'contactId', 'c1000000-0000-0000-0000-000000000001',
     'snapshot', jsonb_build_object('formulaName','Goud','cost',2500)));

-- Accepted last year, so the portal has history to show.
insert into deals (id, sponsor_id, edition_id, formula_name, cost, vip_friday, vip_saturday,
                   drink_value, folder_mention, website_mention, settlement,
                   invoice_created, invoice_number, confirmed_at, acceptance) values
  ('dea10000-0000-0000-0000-000000000002', '59000000-0000-0000-0000-000000000001',
   'ed000000-0000-0000-0000-000000000025', 'Goud', 2400, 4, 4, 550, 'full', 'logo', 'invoice',
   true, 'F2025-0142', now() - interval '1 year',
   jsonb_build_object('acceptedAt', now() - interval '1 year', 'name', 'Jan Peeters',
                      'email', 'jan@vanhonsebrouck.be',
                      'contactId', 'c1000000-0000-0000-0000-000000000001',
                      'snapshot', jsonb_build_object('formulaName','Goud','cost',2400)));

-- Not yet accepted: the portal opens straight onto this, and the overview
-- counts it as still to confirm.
insert into deals (id, sponsor_id, edition_id, formula_name, cost, vip_friday, vip_saturday,
                   drink_value, food_drink_value, base_food_drink,
                   folder_mention, website_mention, settlement, confirmed_at) values
  ('dea10000-0000-0000-0000-000000000003', '59000000-0000-0000-0000-000000000002',
   'ed000000-0000-0000-0000-000000000026', 'Zilver', 1250, 2, 2, 275, 100, 100,
   'half', 'logo', 'invoice', now());

-- Mixed settlement with a required reference still missing, which is what
-- blocks the invoicing screen.
insert into deals (id, sponsor_id, edition_id, formula_name, cost, drink_value,
                   folder_mention, settlement, in_kind_description, in_kind_value,
                   ref_required, invoice_reference, confirmed_at) values
  ('dea10000-0000-0000-0000-000000000004', '59000000-0000-0000-0000-000000000003',
   'ed000000-0000-0000-0000-000000000026', 'Op maat', 1800, 220,
   'quarter', 'mixed', 'Transport van het podiummateriaal', 800, true, '', now());

-- Entirely in kind: never invoiced.
insert into deals (id, sponsor_id, edition_id, formula_name, cost,
                   folder_mention, settlement, in_kind_description, in_kind_value, confirmed_at) values
  ('dea10000-0000-0000-0000-000000000005', '59000000-0000-0000-0000-000000000005',
   'ed000000-0000-0000-0000-000000000026', 'Op maat', 600,
   'eighth', 'inkind', 'Bouw en afbraak van de backstage', 600, now());

-- Chosen by the sponsor in the portal and awaiting the team's confirmation:
-- requested_at set, confirmed_at null.
insert into deals (id, sponsor_id, edition_id, formula_name, cost, vip_friday, vip_saturday,
                   drink_value, folder_mention, website_mention, settlement,
                   requested_at, requested_by) values
  ('dea10000-0000-0000-0000-000000000006', '59000000-0000-0000-0000-000000000004',
   'ed000000-0000-0000-0000-000000000026', 'Brons', 500, 1, 1, 110, 'quarter', 'name', 'invoice',
   now() - interval '2 days', 'Café De Zwaan');

-- ---------- vouchers ----------
-- One of each status, so the filters and the cancelled-row styling have
-- something to act on.
insert into vouchers (sponsor_id, edition_id, deal_id, type, value, status, code, sent_at, cancelled_at) values
  ('59000000-0000-0000-0000-000000000001','ed000000-0000-0000-0000-000000000026','dea10000-0000-0000-0000-000000000001','vipFriday',   0,'sent',     'GR26-VF-0001', now(), null),
  ('59000000-0000-0000-0000-000000000001','ed000000-0000-0000-0000-000000000026','dea10000-0000-0000-0000-000000000001','vipSaturday', 0,'sent',     'GR26-VS-0001', now(), null),
  ('59000000-0000-0000-0000-000000000001','ed000000-0000-0000-0000-000000000026','dea10000-0000-0000-0000-000000000001','drink',      25,'pending',  '',             null, null),
  ('59000000-0000-0000-0000-000000000001','ed000000-0000-0000-0000-000000000026','dea10000-0000-0000-0000-000000000001','food',       25,'cancelled','GR26-FD-0009', now() - interval '2 days', now());

insert into app_settings (id) values (true) on conflict (id) do nothing;
