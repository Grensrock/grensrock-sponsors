import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* ============================================================
   Supabase session refresh
   ============================================================
   Next.js 16 renamed the `middleware` file convention to `proxy`
   (same functionality, same position at the project root) — see
   node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
   This is the standard @supabase/ssr session-refresh recipe: read the
   auth cookies off the request, let the client refresh them if needed,
   and write the refreshed cookies onto both the request (so the rest
   of the render sees them) and the response (so the browser stores them).
   ============================================================ */

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers || {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Touching the session is what triggers the refresh + the setAll above.
  await supabase.auth.getUser();

  return response;
}

/* ------------------------------------------------------------
   Where the proxy runs: /set-password, nothing else.
   ------------------------------------------------------------
   On Vercel every proxy run is a function invocation billed as Active
   CPU, and the old catch-all matcher ran it in front of everything —
   robots.txt, /icon, every /api call, prefetches, and every path a
   vulnerability scanner probes (/wp-login.php, /.env, …) on the open
   production and dev domains.

   Nothing else needs it. No Server Component reads the session (the app
   is client-rendered and the browser client refreshes its own tokens),
   and the route handlers under /api and /auth build their own client via
   lib/supabase/server.ts, which can write refreshed cookies itself.

   Not on / either: it is a static page served straight from the CDN
   (app/page.tsx), and a proxy match would put a billed invocation back in
   front of every hit to it, bots included. /set-password is rarely visited,
   so keeping it there costs next to nothing.

   Add a path here only if a Server Component on it starts reading the
   session. Prefetches are skipped: they render nothing the user sees.
   ------------------------------------------------------------ */
export const config = {
  matcher: [
    {
      source: "/set-password",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
