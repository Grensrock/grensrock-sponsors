import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ============================================================
   Server / Route-Handler Supabase client
   ============================================================
   Cookie-backed session, publishable key: RLS applies exactly as it
   does in the browser. This is NOT the admin client — see
   lib/supabase/admin.ts for the (server-only) secret-key client.
   ============================================================ */

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* Called from a Server Component: proxy.ts refreshes the session instead. */
          }
        },
      },
    },
  );
}
