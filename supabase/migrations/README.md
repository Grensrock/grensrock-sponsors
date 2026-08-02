# Database migrations

Two Supabase projects, one set of migration files:

| | Project ref | Used by |
| --- | --- | --- |
| **Staging** | `uwfbiqnzfdelikqiqpir` | Vercel Preview deployments (the `staging` branch) |
| **Production** | `nxzhrqbbqntdwkjciuzw` | Vercel Production (the `main` branch) |

Migrations used to be copy-pasted into the SQL editor, which worked while
there was one database and nothing tracking what had run. With two databases
that approach guarantees drift — and a staging environment that has drifted
from production is worse than no staging environment, because it tells you a
migration is safe when it isn't.

So the files in this folder are now applied by the Supabase CLI, which records
each applied version in `supabase_migrations.schema_migrations` on the server.
Both databases are driven from the same files, staging first.

## Everyday use

```bash
npm run db:link:staging   # point the CLI at staging
npm run db:status         # what's applied there vs. what's in this folder
npm run db:plan           # dry run: exactly what would be applied
npm run db:push           # apply it
```

Then, once it's been validated on staging and the change is going live:

```bash
npm run db:link:prod
npm run db:status
npm run db:plan
npm run db:push
```

`db:link:*` is a separate, explicit step precisely so that "which database am I
about to write to" is never implicit. `db:status` after linking tells you where
you are. To write a new migration, `npm run db:new <name>` creates a correctly
named empty file.

## One-time setup

You need to be logged in, once per machine:

```bash
npx supabase login
```

`db:link:*` will ask for that project's **database password** (Project Settings
→ Database). It caches it, so you're only asked the first time per project.

### Production has to be told what it already has

Production already ran `0001`–`0009` by hand, but nothing recorded that, so the
CLI would otherwise try to run them again and fail on the first `create table`.
Mark them as applied without executing them — **once**, and only against
production:

```bash
npm run db:link:prod
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008
```

Add `0009` to that list if you already ran `0009_vat_lookup_cbe.sql` by hand;
leave it off if you haven't, and `npm run db:push` will apply it. `npm run
db:status` afterwards should show every version present on both sides except
the ones genuinely still pending.

### Staging starts empty

Nothing to repair — link it and push, and all ten files run in order:

```bash
npm run db:link:staging
npm run db:push
```

Then in the staging project's dashboard: enable **Google** as an auth provider,
and set **Site URL** plus **Redirect URLs** (Auth → URL Configuration) to the
staging deployment's URL. The storage buckets no longer need creating by hand —
`0010_storage_buckets.sql` does it.

## What each file does, briefly

- **0001_schema.sql** — all the tables (sponsors, contacts, editions, formulas,
  deals, vouchers, audit log, settings).
- **0002_auth.sql** — helper functions the security rules use: "is this a team
  member?", "are they an admin?", "which sponsor does this contact belong to?".
- **0003_rls.sql** — the security rules themselves: team members see and manage
  everything (deletes admin-only where the app already restricted them); a
  sponsor in the portal only ever sees their own company's data.
- **0004_rpc.sql** — the narrow set of actions a sponsor may take from the
  portal, each double-checking it only touches that sponsor's own data.
- **0005_audit.sql** — logs every change (who, what, when) to the audit log.
- **0006_storage.sql** — access rules for uploaded logos and example images.
- **0007_fixes.sql** — corrections to the above.
- **0008_google_team_auth.sql** — replaces the shared team password with Google
  Workspace sign-in; `ensure_team_profile()` holds the `@grensrock.be` check.
- **0009_vat_lookup_cbe.sql** — VAT lookup settings move from VIES to the
  Belgian company registry.
- **0010_storage_buckets.sql** — creates the two storage buckets, so a fresh
  project needs no dashboard clicks.
