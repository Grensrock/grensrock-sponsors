import GrensrockApp from "@/components/app/GrensrockApp";

/* A static page: nothing here reads the request, so Next prerenders it at
   build time and Vercel serves every hit from the CDN without running a
   function. Keep it that way — reading searchParams, cookies() or headers()
   here would make every visit (bots included) a billed server render.

   The ?auth_error=<code> that app/auth/callback sends a failed sign-in back
   with is read in the browser instead (GrensrockApp). That costs no flicker:
   the app shows "Loading…" until the session check is done, and by then the
   code is already in state for Landing's first render. */
export default function Home() {
  return <GrensrockApp />;
}
