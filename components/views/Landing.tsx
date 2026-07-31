"use client";

import { useState } from "react";
import PickLines from "@/components/ui/PickLines";
import PickLogo from "@/components/ui/PickLogo";
import { supabase } from "@/lib/supabase/client";

/* ---------- Landing (choose team vs sponsor access) ----------

   - Team members sign in with their Google Workspace account. Whether
     that account actually gets team access is decided server-side by
     ensure_team_profile() (it requires a verified @grensrock.be address);
     the `hd` parameter below only pre-filters Google's account picker and
     is not a security boundary.
   - Sponsor contacts get a magic link (no password): the link itself
     drives the transition, via app/auth/callback/route.ts.
*/

const TEAM_DOMAIN = "grensrock.be";

export default function Landing({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [side, setSide] = useState<null | "team" | "sponsor">(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [lng, setLng] = useState("nl");
  const L = (nl: string, en: string) => (lng === "nl" ? nl : en);

  const reset = () => {
    setSide(null);
    setEmail("");
    setErr("");
    setInfo("");
  };

  /* Team: Google Workspace */
  const teamLogin = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: TEAM_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) {
      setBusy(false);
      setErr(
        L(
          "Aanmelden met Google lukte niet. Probeer het zo dadelijk opnieuw.",
          "Could not sign in with Google. Please try again in a moment.",
        ),
      );
    }
    /* On success the browser navigates to Google, so `busy` stays true. */
  };

  /* Sponsor: magic link, no password */
  const sponsorLogin = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setErr(
        L(
          "We konden geen aanmeldlink versturen. Probeer het zo dadelijk opnieuw.",
          "We couldn't send a login link. Please try again in a moment.",
        ),
      );
      return;
    }
    setInfo(
      L(
        "We stuurden u een aanmeldlink. Open die link in deze browser om uw pagina te openen.",
        "We've sent you a login link. Open it in this browser to reach your page.",
      ),
    );
  };

  const teamCard = (
    <>
      <p className="gr-muted">
        {L(
          "Beheer sponsors, edities, overeenkomsten en facturatie.",
          "Manage sponsors, editions, agreements and invoicing.",
        )}
      </p>
      <button className="gr-btn" disabled={busy} onClick={teamLogin}>
        {L("Aanmelden met Google", "Sign in with Google")}
      </button>
      <p className="gr-muted" style={{ fontSize: 12 }}>
        {L(`Met uw @${TEAM_DOMAIN}-account.`, `With your @${TEAM_DOMAIN} account.`)}
      </p>
    </>
  );

  const sponsorForm = (
    <>
      <input
        type="email"
        placeholder="uw@email.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && sponsorLogin()}
        autoFocus
      />
      <button className="gr-btn" disabled={busy} onClick={sponsorLogin}>
        {L("Aanmeldlink sturen", "Send login link")}
      </button>
      <button className="gr-linkbtn" onClick={reset}>
        {L("Terug", "Back")}
      </button>
    </>
  );

  return (
    <div className="gr-landing">
      <PickLines />
      <div className="gr-landlang">
        {["nl", "en"].map((k) => (
          <button key={k} className={lng === k ? "on" : ""} onClick={() => setLng(k)}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>
      <PickLogo size={150} />
      <span className="gr-brandsub" style={{ marginTop: 10 }}>
        {L("Sponsorbeheer", "Sponsor management")}
      </span>
      <div className="gr-landcards">
        <div className="gr-landcard">
          <h3 className="gr-h3">{L("Organisatie", "Organisation")}</h3>
          {teamCard}
        </div>
        <div className={"gr-landcard" + (side === "sponsor" ? " on" : "")}>
          <h3 className="gr-h3">Sponsor</h3>
          {side === "sponsor" ? (
            sponsorForm
          ) : (
            <>
              <p className="gr-muted">
                {L(
                  "Werk uw bedrijfsgegevens bij en laad uw logo op.",
                  "Update your company details and upload your logo.",
                )}
              </p>
              <button
                className="gr-btn-ghost"
                onClick={() => {
                  setErr("");
                  setInfo("");
                  setSide("sponsor");
                }}
              >
                {L("Aanmelden als sponsor", "Log in as sponsor")}
              </button>
            </>
          )}
        </div>
      </div>
      {err && <p style={{ color: "var(--red)", fontWeight: 600 }}>{err}</p>}
      {info && !err && <p style={{ color: "#fff", fontWeight: 600 }}>{info}</p>}
    </div>
  );
}
