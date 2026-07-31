"use client";

import { useState } from "react";
import PickLines from "@/components/ui/PickLines";
import PickLogo from "@/components/ui/PickLogo";
import { supabase } from "@/lib/supabase/client";

/* ---------- Landing (choose team vs sponsor access) ----------

   Real authentication (Stage 2):
   - team members sign in with e-mail + password (Supabase Auth);
   - the very first team member signs up and then completes the setup in
     the app, where bootstrap_first_admin() only succeeds while there is
     no team account at all — so this path can be offered unconditionally,
     the database is what enforces "first person through the door is admin"
     (a landing page has no session, so it cannot read `profiles` to find
     out whether team accounts exist);
   - sponsor contacts get a magic link (no password): the link itself
     drives the transition, via app/auth/callback/route.ts.
*/

export default function Landing({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [side, setSide] = useState<null | "team" | "sponsor">(null); // null | 'team' | 'sponsor'
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [lng, setLng] = useState("nl");
  const L = (nl: string, en: string) => (lng === "nl" ? nl : en);

  const reset = () => {
    setSide(null);
    setEmail("");
    setPwd("");
    setErr("");
    setInfo("");
  };

  /* Team: e-mail + password */
  const teamLogin = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd });
    setBusy(false);
    if (error) {
      setErr(
        L(
          "Aanmelden lukte niet. Controleer uw e-mailadres en wachtwoord.",
          "Could not sign in. Check your email address and password.",
        ),
      );
      return;
    }
    await onSignedIn();
  };

  /* Team: create the very first account (the database rejects this once one exists) */
  const teamSignUp = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    if (pwd.length < 6) {
      setErr(L("Kies een wachtwoord van minstens 6 tekens.", "Choose a password of at least 6 characters."));
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pwd,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!data.session) {
      /* E-mail confirmation is switched on for this project: the account
         exists, but the session only starts once the link is clicked. */
      setInfo(
        L(
          "Bevestig eerst uw e-mailadres via de link die we u net stuurden, en meld u daarna aan.",
          "Confirm your email address via the link we just sent you, then sign in.",
        ),
      );
      return;
    }
    await onSignedIn();
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

  const emailField = (onEnter: () => void) => (
    <input
      type="email"
      placeholder="uw@email.com"
      value={email}
      onChange={(e) => {
        setEmail(e.target.value);
        setErr("");
      }}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      autoFocus
    />
  );

  const teamForm = (
    <>
      {emailField(teamLogin)}
      <input
        type="password"
        placeholder={L("Wachtwoord", "Password")}
        value={pwd}
        onChange={(e) => {
          setPwd(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && teamLogin()}
      />
      <button className="gr-btn" disabled={busy} onClick={teamLogin}>
        {L("Aanmelden", "Log in")}
      </button>
      <button className="gr-linkbtn" disabled={busy} onClick={teamSignUp}>
        {L("Eerste beheerder instellen", "Set up the first admin")}
      </button>
      <button className="gr-linkbtn" onClick={reset}>
        {L("Terug", "Back")}
      </button>
    </>
  );

  const sponsorForm = (
    <>
      {emailField(sponsorLogin)}
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
        <div className={"gr-landcard" + (side === "team" ? " on" : "")}>
          <h3 className="gr-h3">{L("Organisatie", "Organisation")}</h3>
          {side === "team" ? (
            teamForm
          ) : (
            <>
              <p className="gr-muted">
                {L(
                  "Beheer sponsors, edities, overeenkomsten en facturatie.",
                  "Manage sponsors, editions, agreements and invoicing.",
                )}
              </p>
              <button
                className="gr-btn"
                onClick={() => {
                  setErr("");
                  setInfo("");
                  setSide("team");
                }}
              >
                {L("Aanmelden als teamlid", "Log in as team member")}
              </button>
            </>
          )}
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
