-- Grensrock Sponsors — Stage 2 schema
-- Run this file first, in the Supabase SQL Editor (Project > SQL Editor > New query).

create extension if not exists pgcrypto;

-- ---------- profiles (team accounts) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null unique,
  role text not null default 'user' check (role in ('admin','user')),
  language text not null default 'nl' check (language in ('nl','en')),
  created_at timestamptz not null default now()
);

-- ---------- sponsors ----------
create table sponsors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  street text not null default '',
  house_number text not null default '',
  postal_code text not null default '',
  city text not null default '',
  vat_number text not null default '',
  entity_type text not null default 'legal' check (entity_type in ('legal','person')),
  voucher_contact_id uuid, -- FK added below, after contacts exists
  responsible_id uuid references profiles(id) on delete set null,
  ref_required boolean not null default false,
  created_at timestamptz not null default now()
);
create index sponsors_responsible_id_idx on sponsors(responsible_id);

-- ---------- contacts ----------
create table contacts (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  language text not null default 'nl' check (language in ('nl','fr','en')),
  pref_info boolean not null default true,
  pref_invoice boolean not null default false,
  portal_access boolean not null default false,
  auth_user_id uuid references auth.users(id) on delete set null
);
create index contacts_sponsor_id_idx on contacts(sponsor_id);
create index contacts_auth_user_id_idx on contacts(auth_user_id);
-- A portal-activated email must be unique across all sponsors, so a magic-link
-- session can be claimed unambiguously (see claim_portal_contact() in 0002_auth.sql).
create unique index contacts_portal_email_idx on contacts (lower(email)) where portal_access;

alter table sponsors
  add constraint sponsors_voucher_contact_fk
  foreign key (voucher_contact_id) references contacts(id) on delete set null;

-- ---------- editions & formulas ----------
create table editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  location text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table formulas (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions(id) on delete cascade,
  name text not null,
  cost numeric(10,2) not null default 0,
  vip_friday int not null default 0,
  vip_saturday int not null default 0,
  vip_guests int not null default 0,
  drink_tickets int not null default 0,
  drink_vouchers jsonb not null default '[]',
  food_drink_value numeric(10,2) not null default 0,
  base_food_drink numeric(10,2) not null default 0,
  food_drink_vouchers jsonb not null default '[]',
  folder_mention text not null default 'none' check (folder_mention in ('none','full','half','quarter','eighth')),
  website_mention text not null default 'none' check (website_mention in ('none','name','logo')),
  poster_mention text not null default 'none' check (poster_mention in ('none','name','logo')),
  ledboarding text[] not null default '{}',
  barrier_covers int not null default 0,
  heras_covers int not null default 0,
  unique (edition_id, name)
);
create index formulas_edition_id_idx on formulas(edition_id);

-- ---------- deals (agreements) ----------
create table deals (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  edition_id uuid not null references editions(id) on delete cascade,
  formula_name text not null default '',
  -- FormulaFields snapshot (deals never live-reference a formula; see plan)
  cost numeric(10,2) not null default 0,
  vip_friday int not null default 0,
  vip_saturday int not null default 0,
  vip_guests int not null default 0,
  drink_tickets int not null default 0,
  drink_vouchers jsonb not null default '[]',
  food_drink_value numeric(10,2) not null default 0,
  base_food_drink numeric(10,2) not null default 0,
  food_drink_vouchers jsonb not null default '[]',
  folder_mention text not null default 'none' check (folder_mention in ('none','full','half','quarter','eighth')),
  website_mention text not null default 'none' check (website_mention in ('none','name','logo')),
  poster_mention text not null default 'none' check (poster_mention in ('none','name','logo')),
  ledboarding text[] not null default '{}',
  barrier_covers int not null default 0,
  heras_covers int not null default 0,
  -- deal-specific fields
  notes text not null default '',
  settlement text not null default 'invoice' check (settlement in ('invoice','inkind','mixed')),
  in_kind_description text not null default '',
  in_kind_value numeric(10,2) not null default 0,
  ref_required boolean,
  invoice_reference text not null default '',
  invoice_created boolean not null default false,
  invoice_number text not null default '',
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  requested_at timestamptz,
  requested_by text not null default '',
  confirmed_at timestamptz,
  responsible text not null default '',
  acceptance jsonb,
  unique (sponsor_id, edition_id)
);
create index deals_sponsor_id_idx on deals(sponsor_id);
create index deals_edition_id_idx on deals(edition_id);

-- ---------- vouchers ----------
create table vouchers (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  edition_id uuid not null references editions(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  type text not null check (type in ('vipFriday','vipSaturday','vipGuests','drink','food')),
  value numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','created','sent','cancelled','error')),
  code text not null default '',
  url text not null default '',
  recipient_name text not null default '',
  recipient_email text not null default '',
  created_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  error text not null default ''
);
create index vouchers_sponsor_id_idx on vouchers(sponsor_id);
create index vouchers_edition_id_idx on vouchers(edition_id);
create index vouchers_deal_id_idx on vouchers(deal_id);

-- ---------- audit log ----------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('system','team','sponsor')),
  actor_id uuid,
  actor_name text not null default '',
  entity text not null check (entity in ('sponsor','contact','agreement','edition','vouchers','account')),
  entity_id uuid,
  entity_name text not null default '',
  action text not null default '',
  detail text not null default ''
);
create index audit_log_at_idx on audit_log(at desc);

-- ---------- app settings (singleton row) ----------
create table app_settings (
  id boolean primary key default true check (id),
  vies_mode text not null default 'manual' check (vies_mode in ('manual','test','proxy')),
  vies_proxy_url text not null default '',
  tickoweb_mode text not null default 'manual' check (tickoweb_mode in ('manual','live')),
  tickoweb_base_url text not null default 'https://openapi.tickoweb.be/v1',
  tickoweb_proxy_url text not null default '',
  tickoweb_event_id text not null default '',
  tickoweb_product_ids jsonb not null default '{}'
);
insert into app_settings (id) values (true);

-- ---------- integration secrets (service-role only, no client access at all) ----------
create table integration_secrets (
  key text primary key,
  value text not null
);
