/* ============================================================
   "You are not on production" band
   ============================================================
   Staging and production look identical, so the only thing stopping
   someone editing a real sponsor in the wrong tab is a visible marker.

   It reports the database, not just the deployment. Vercel's own env
   tells you which deployment you opened; it does not tell you which
   Supabase project that deployment writes to — and a local dev server
   pointed at production is the version of this mistake with the worst
   ending. The project ref comes straight from NEXT_PUBLIC_SUPABASE_URL,
   which the browser already sends on every request, so nothing secret
   is being surfaced here.

   NEXT_PUBLIC_VERCEL_ENV / _GIT_COMMIT_REF need "Automatically expose
   System Environment Variables" switched on in the Vercel project.
   Unset (a local `npm run dev`) is treated as not-production too.
   ============================================================ */

import { teamT } from "@/lib/i18n";
import type { TeamLanguage } from "@/types";

/** "https://abcd1234.supabase.co" -> "abcd1234" */
const projectRef = (url?: string) => (url || "").replace(/^https?:\/\//, "").split(".")[0] || "unknown";

export default function EnvBanner({ lang = "nl" }: { lang?: TeamLanguage }) {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === "production") return null;

  const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
  const ref = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const label = teamT(env === "preview" ? "eb.staging" : "eb.local", lang);

  return (
    <div className={"gr-envbanner" + (env === "preview" ? "" : " local")} role="status">
      <strong>{label}</strong>
      {branch && (
        <span>
          {teamT("eb.branch", lang)} {branch}
        </span>
      )}
      <span>
        {teamT("eb.database", lang)} <code>{ref}</code>
      </span>
      <span className="gr-envbanner-note">{teamT("eb.note", lang)}</span>
    </div>
  );
}
