This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started 

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environments

| | Branch | Vercel | Supabase project |
| --- | --- | --- | --- |
| Production | `main` | Production deployment | `nxzhrqbbqntdwkjciuzw` |
| Staging | `staging` | Preview, on the branch's stable alias | `uwfbiqnzfdelikqiqpir` |

Work flows `feature/*` → PR into `staging` → validate on the staging URL → PR
`staging` into `main`. Database migrations follow the same path and are applied
with the Supabase CLI — see [supabase/migrations/README.md](supabase/migrations/README.md).

Anything that isn't the production deployment shows a band across the top of the
page naming the environment and the Supabase project it writes to
([EnvBanner.tsx](components/ui/EnvBanner.tsx)). It needs **Automatically expose
System Environment Variables** switched on in the Vercel project so that
`NEXT_PUBLIC_VERCEL_ENV` reaches the build.

## Running against a local database

Pointing a dev server at staging or production works, but it means every screen
you open is a live one, and the screens worth testing are all behind a login —
the team side through Google Workspace, the portal through a contact's password.
Neither is something you can hand out. So there is a local stack instead, with
data seeded to make those screens reachable.

```bash
npm run db:start          # first run pulls the images; needs Docker running
npm run db:reset          # re-applies every migration, then supabase/seed.sql
```

Then create `.env.development.local`. Next loads it ahead of `.env.local` in
development, so the dev server talks to the local stack without `.env.local`
having to be edited — and deleting the file puts everything back:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SECRET_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

Those keys are the Supabase CLI's fixed local-development keys — identical on
every machine, published in Supabase's own docs, and only good against a
database listening on `127.0.0.1`. The band at the top of the page will read
`database 127`, which is how you know you are not on a real project.

Everything seeded uses the password `devdevdev`:

| Sign in as | What it gets you |
| --- | --- |
| `wout@grensrock.be` | Admin: the whole team app |
| `jonas@grensrock.be` | The `user` role, for comparing against "view as user" |
| `nieuw@grensrock.be` | Registered but unapproved — the waiting screen |
| `jan@vanhonsebrouck.be` | Sponsor portal, Dutch |
| `marie@delacroix.be` | Sponsor portal, French |

Team accounts sign in through the **sponsor** form on the landing page. That is
not a workaround: the app routes on the session plus a `profiles` row, not on
which provider produced it, so a team email typed there lands in the team app.
The Google button needs OAuth credentials the local stack does not have.

The seed is fixtures with a purpose rather than filler — a maximal agreement so
the edit modal is as long as it ever gets, a French contact, a sponsor with no
contacts, every settlement type and every acceptance state. See the header of
[supabase/seed.sql](supabase/seed.sql). It only ever runs locally: `db push`
ships migrations, not seeds.

## Environment variables

Set these in `.env.local` for development, and in Vercel scoped to **Production**
(production Supabase project) and **Preview** (staging project) separately —
`NEXT_PUBLIC_*` values are baked in at build time, so each environment builds its
own bundle. The two without `NEXT_PUBLIC_` are server secrets and must never be
exposed to the browser.

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key — safe in the browser, RLS still applies. |
| `SUPABASE_SECRET_KEY` | Supabase secret key, bypasses RLS. Used only by `app/api/team/invite`. |
| `CBE_API_KEY` | [cbeapi.be](https://cbeapi.be/docs/api) key for the VAT check. Without it, `/api/vat/[vat]` reports the lookup as unavailable and VAT numbers are only validated offline. |
| `GOOGLE_SMTP_USER` | Workspace account the app sends mail as, e.g. `wout@grensrock.be`. |
| `GOOGLE_SMTP_PASSWORD` | A Google **App Password** for that account (not the login password) — [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), requires 2-Step Verification. |
| `GOOGLE_SMTP_FROM` | Optional. Overrides the From header, e.g. `Grensrock <wout@grensrock.be>`. Must be the sending account or an alias it owns, or Gmail rejects the send. Defaults to `GOOGLE_SMTP_USER`. |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | Service account address, e.g. `logos@grensrock-xxxx.iam.gserviceaccount.com`. Add it as a **Content Manager** on the Shared Drive. |
| `GOOGLE_DRIVE_PRIVATE_KEY` | That service account's private key, the whole PEM. Vercel stores it on one line, so `\n` arrives escaped — the code un-escapes it. |
| `GOOGLE_DRIVE_FOLDER_ID` | The folder the logos are written into: the last path segment of its Drive URL. |

### Setting up the Drive export

1. Google Cloud console → new project (or an existing one) → enable the **Google Drive API**.
2. Create a **service account**, then a **JSON key** for it. `client_email` and `private_key` from that file are the two variables above.
3. Open the Shared Drive folder in Drive → share it with the service account's address as **Content Manager**.

It must be a **Shared Drive**, not a folder in someone's My Drive. A Shared Drive accepts a service account as a member directly; My Drive does not, and would need domain-wide delegation configured in the Admin console.

Without these three variables the app is unaffected — the button reports that the export isn't configured, and nothing else changes.

Mail goes out through Google Workspace rather than a transactional provider
because `grensrock.be` already sends via Google (MX `smtp.google.com`, SPF
`include:_spf.google.com`), so it inherits the domain's existing SPF and DKIM.
The SPF record ends in `-all`, so adding a third-party sender would mean editing
it — and getting that wrong fails silently into spam folders. Without the two
required variables, granting access still works; only the notification email is
skipped, and the admin is told it didn't go.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
