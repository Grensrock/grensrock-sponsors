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

export const config = {
  matcher: [
    /* Everything except Next internals and static assets. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
