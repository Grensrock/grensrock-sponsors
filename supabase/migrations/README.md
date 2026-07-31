# Running these migrations

These six files set up the database for the Grensrock sponsor app. They've been
tested end-to-end against a real Postgres instance (schema, security rules, and
every write path) before being handed to you — but they run against *your*
project, so please run them yourself rather than sharing the database password.

## Steps

1. Go to your Supabase project → **SQL Editor** → **New query**.
2. Open `0001_schema.sql` in this folder, copy its full contents, paste into the
   editor, click **Run**. Wait for it to say "Success."
3. Repeat for `0002_auth.sql`, `0003_rls.sql`, `0004_rpc.sql`, `0005_audit.sql`
   — **in that exact order** (each one depends on the previous file existing).
4. Before running `0006_storage.sql`: go to **Storage** in the left sidebar and
   create two buckets, both set to **Private**:
   - `sponsor-logos`
   - `example-images`
5. Then run `0006_storage.sql` the same way as the others.

That's it — no other setup needed on the database side. Once all six have run,
let me know and I'll verify each table is reachable before building the app
code that uses them.

## What each file does, briefly

- **0001_schema.sql** — creates all the tables (sponsors, contacts, editions,
  formulas, deals, vouchers, audit log, settings).
- **0002_auth.sql** — helper functions the security rules use to check "is this
  a team member?", "are they an admin?", "which sponsor does this contact
  belong to?".
- **0003_rls.sql** — the actual security rules: team members can see/manage
  everything (deletes are admin-only where the app already restricted them);
  a sponsor logged into the portal can only ever see their own company's data.
- **0004_rpc.sql** — the specific, narrow actions a sponsor is allowed to take
  from the portal (update their own info, add a contact, pick a formula, top up
  vouchers, accept a contract, reassign a ticket) — each one double-checks it's
  only touching that sponsor's own data before doing anything.
- **0005_audit.sql** — automatically logs every change (who did what, when) into
  the audit log, replacing the old app's manual change-tracking.
- **0006_storage.sql** — security rules for uploaded logo images, matching the
  same "team sees everything, sponsor sees only their own" pattern.
