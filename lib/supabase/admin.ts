import { createClient } from "@supabase/supabase-js";

/* ============================================================
   Admin Supabase client — SERVER ONLY
   ============================================================
   Built with SUPABASE_SECRET_KEY, which bypasses RLS entirely.
   Never import this from a "use client" file or anything that ends up
   in the browser bundle. It exists for exactly one thing today:
   app/api/team/invite/route.ts, which has to create an auth.users row
   (Auth admin API) and the matching profiles row (profiles has no
   INSERT policy by design — see supabase/migrations/0003_rls.sql).
   ============================================================ */

export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured on the server.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
