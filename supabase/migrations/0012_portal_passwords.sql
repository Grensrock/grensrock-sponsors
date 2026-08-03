-- ============================================================
-- 0012 — sponsor contacts log in with a password
-- ============================================================
-- Magic links are replaced by email + password. A contact who is given
-- portal access receives a link to set one, valid for 14 days.
--
-- Why our own token rather than a Supabase invite link: Supabase's email
-- link lifetime is a single project-wide setting covering magic links,
-- invites and password resets alike. Stretching it to 14 days to satisfy
-- this requirement would have stretched every other auth email with it.
-- A row per invite lets the 14 days apply only here.
--
-- Only the SHA-256 of the token is stored. The token itself exists in
-- the email and nowhere else, so a copy of this table is not a set of
-- working links into sponsors' accounts.
-- ============================================================

create table portal_invites (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  -- Denormalised on purpose: the address the link was sent to is what the
  -- token is good for, even if the contact's email is edited afterwards.
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_invites_contact_idx on portal_invites(contact_id);

-- RLS on with zero policies: service-role only, exactly like
-- integration_secrets. Nothing about these rows is a client's business —
-- the routes that touch them run on the server with the secret key.
alter table portal_invites enable row level security;

-- ---------- looking a sponsor's auth user up by address ----------
-- The Auth admin API can create a user and update one by id, but it
-- cannot find one by email. Without this, re-inviting a contact who
-- already has an account (anyone who ever used a magic link) would mean
-- paging through every user in the project.
--
-- It reads auth.users, so it is granted to service_role alone: for any
-- other caller this would be a way to ask whether an address has an
-- account here.
create or replace function auth_user_id_for_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, pg_temp
stable
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function auth_user_id_for_email(text) from public, anon, authenticated;
grant execute on function auth_user_id_for_email(text) to service_role;
