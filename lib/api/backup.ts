import { supabase } from "@/lib/supabase/client";
import { asRows, unwrap, type Row } from "@/lib/api/util";

/* ============================================================
   Full backup: every table, every row, every column
   ============================================================
   Read straight from the tables with `select *` rather than from the
   app's loaded state, for two reasons. The state is shaped for the
   screens (camelCase, some columns left out, the audit log capped at
   1000 rows), and a backup that drops what the screens don't show is
   no backup. And `*` takes in a column a later migration adds without
   anyone having to remember this file.

   Read with the admin's own session, so RLS decides what goes in, the
   same as everywhere else. That keeps out what has no place in a file
   on someone's laptop anyway: integration_secrets, and the one-time
   portal sign-in links (portal_invites, portal_magic_links,
   portal_accept_links), none of which a team session can read.
   ============================================================ */

/* In the order the sheets appear: what the team works with first. */
export const BACKUP_TABLES = [
  "sponsors",
  "contacts",
  "deals",
  "sponsor_declines",
  "editions",
  "formulas",
  "vouchers",
  "sponsor_logos",
  "profiles",
  "app_settings",
  "audit_log",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type Backup = Record<BackupTable, Row[]>;

const PAGE = 1000;

/* PostgREST hands out at most max_rows per request (1000 on Supabase), and
   past that it cuts the answer short without saying so. So: page by id, and
   stop on an empty page rather than a short one, which keeps this right
   even if a project's max_rows is set lower than PAGE. */
async function readTable(table: BackupTable): Promise<Row[]> {
  const out: Row[] = [];
  for (;;) {
    const page = asRows(
      unwrap(
        await supabase
          .from(table)
          .select("*")
          .order("id")
          .range(out.length, out.length + PAGE - 1),
      ),
    );
    if (page.length === 0) return out;
    out.push(...page);
  }
}

export async function readBackup(): Promise<Backup> {
  const tables = await Promise.all(BACKUP_TABLES.map(readTable));
  return Object.fromEntries(BACKUP_TABLES.map((name, i) => [name, tables[i]])) as Backup;
}
