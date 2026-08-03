import type { MetadataRoute } from "next";

/* ============================================================
   robots.txt — nothing here is for search engines
   ============================================================
   Every deployment, production included, asks crawlers to stay out.
   There is no public surface to index: the landing page is a pair of
   sign-in buttons, and everything past it is a team account or a
   sponsor's own portal. A search result pointing here could only ever
   be a dead end, or an invitation to try the door.

   It matters more since Vercel Authentication came off the preview
   deployments (so sponsors can follow a magic link into
   dev.sponsors.grensrock.be) — staging and production are now both on
   the open web, and the amber environment banner does nothing about a
   search result.

   No environment check: the answer is the same everywhere, and a branch
   that always returns the same thing is just a place for a mistake to
   hide later.

   This is a request, not a control. Crawlers honour it by choice, and it
   does nothing about anyone who simply has the URL — what actually
   protects the data is the app's own auth: the server-side
   @grensrock.be check in ensure_team_profile(), an admin's approval on
   top of it (0011), magic links for sponsors, and RLS behind all of it.
   ============================================================ */

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
