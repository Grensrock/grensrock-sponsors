-- ============================================================
-- 0017 — sponsor contacts can also sign in with a link
-- ============================================================
-- Email + password (0012) stays exactly as it is. This adds the other
-- way in: type your address, get a link, follow it, you are in the
-- portal. Nothing about the account changes — a contact who signs in
-- this way keeps whatever password they had, or none.
--
-- The token itself is Supabase's (admin.generateLink + verifyOtp in
-- app/auth/callback), because a sign-in link has to end in a session
-- and only Auth can mint one. So unlike portal_invites, this table
-- holds NO token, not even a hash: there is nothing here worth
-- stealing, and nothing to keep in step with Auth's own expiry.
--
-- What it is for is the resend gap. /api/portal/magic-link answers
-- anyone who types an address, so without a record of the last send,
-- submitting that form in a loop would be a way to bury a sponsor's
-- inbox. One row per link sent, and the route refuses to send another
-- within a few minutes of the newest one.
-- ============================================================

create table portal_magic_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  -- Denormalised like portal_invites.email: what matters afterwards is the
  -- address the link actually went to, even if the contact is edited later.
  email text not null,
  created_at timestamptz not null default now()
);

-- The route only ever asks "what is the newest row for this contact", so the
-- index is ordered to answer that from its own first entry.
create index portal_magic_links_contact_idx on portal_magic_links(contact_id, created_at desc);

-- RLS on with zero policies: service-role only, exactly like portal_invites.
-- Who asked for a sign-in link and when is not a client's business.
alter table portal_magic_links enable row level security;
