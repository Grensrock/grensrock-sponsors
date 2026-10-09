-- ============================================================
-- 0018 — the agreement mail signs the sponsor in by itself
-- ============================================================
-- The mail that asks a sponsor to accept an agreement used to point at
-- the portal and say "sign in with your email address". Now the link in
-- it IS the way in: following it opens the portal, signed in, on the
-- agreement waiting to be accepted.
--
-- Not Supabase's own sign-in token (0017), because that one lives an
-- hour — auth.email.otp_expiry is project-wide and tops out at a day —
-- and an agreement mail is read whenever the sponsor gets round to it.
-- So this is our own token, like portal_invites (0012), with the same
-- 14 days. Redeeming it (app/auth/accept) mints a Supabase session on
-- the spot.
--
-- Unlike an invite, a link here is NOT spent by its first use. Mail
-- scanners (Outlook Safe Links and the like) open every link in a
-- message before the person does; a one-shot link would be dead by the
-- time the sponsor clicked it. It works until it expires, and every
-- send makes a fresh one per recipient.
--
-- Only the SHA-256 of the token is stored, so a read of this table is
-- not a way into anyone's portal.
-- ============================================================

create table portal_accept_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  -- The address the link was mailed to. If the contact's address is changed
  -- afterwards, the link stops working rather than signing in whoever the
  -- contact has since become.
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index portal_accept_links_contact_idx on portal_accept_links(contact_id);

-- RLS on with zero policies: service-role only, exactly like portal_invites.
alter table portal_accept_links enable row level security;
