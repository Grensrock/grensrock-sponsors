"use client";

import { useState } from "react";
import PickLines from "@/components/ui/PickLines";
import PickLogo from "@/components/ui/PickLogo";
import { supabase } from "@/lib/supabase/client";
import type { Language } from "@/types";

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

/* An example address reads as an example only in the reader's own language. */
const MAIL_PLACEHOLDER: Record<Language, string> = {
  nl: "uw@bedrijf.be",
  fr: "vous@societe.be",
  en: "you@company.com",
};

export default function Landing({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [side, setSide] = useState<null | "team" | "sponsor" | "forgot">(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [lng, setLng] = useState<Language>("nl");
  const L = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lng];

  const reset = () => {
    setSide(null);
    setEmail("");
    setPassword("");
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
          "La connexion avec Google a échoué. Réessayez dans un instant.",
          "Could not sign in with Google. Please try again in a moment.",
        ),
      );
    }
    /* On success the browser navigates to Google, so `busy` stays true. */
  };

  /* Sponsor: email + password. Magic links are gone — a contact is given a
     link to set a password when the team switches their access on, and can
     ask for a new one below (see app/api/portal/request-link). */
  const sponsorLogin = async () => {
    if (busy) return;
    setErr("");
    setInfo("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setBusy(false);
      /* Supabase does not distinguish a wrong password from an unknown
         address, and neither do we — saying which would let anyone check
         whether a company is a Grensrock sponsor. */
      setErr(
        L(
          "Dat e-mailadres en wachtwoord passen niet bij elkaar.",
          "Cette adresse e-mail et ce mot de passe ne correspondent pas.",
          "That email address and password don't match.",
        ),
      );
      return;
    }
    /* No /auth/callback in a password sign-in, so the binding that the
       callback used to do has to happen here. It is a no-op if already bound. */
    await supabase.rpc("claim_portal_contact");
    setBusy(false);
    await onSignedIn();
  };

  /* "I can't get in": issues a fresh set-password link. Always reports the
     same thing, whether or not the address matched anything. */
  const requestLink = async () => {
    if (busy) return;
    if (!email.trim()) {
      setErr(L("Vul uw e-mailadres in.", "Saisissez votre adresse e-mail.", "Enter your email address."));
      return;
    }
    setErr("");
    setBusy(true);
    try {
      await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      /* The message below is deliberately the same either way. */
    }
    setBusy(false);
    setInfo(
      L(
        "Als dat adres bij een sponsorcontact met portaaltoegang hoort, is er een link onderweg. Die blijft 14 dagen geldig.",
        "Si cette adresse correspond à un contact sponsor disposant d'un accès au portail, un lien est en route. Il reste valable 14 jours.",
        "If that address belongs to a sponsor contact with portal access, a link is on its way. It stays valid for 14 days.",
      ),
    );
  };

  /* Its own screen rather than a second action on the sign-in card: the two
     ask for different things, and a password box sitting under an email box
     invites people to fill both in and wonder why nothing happened. The typed
     address carries over, so arriving here after a failed sign-in costs nothing. */
  const forgotForm = (
    <>
      <p className="gr-muted">
        {L(
          "Vul uw e-mailadres in. Als dat adres bij een sponsorcontact met portaaltoegang hoort, sturen we u een link om een wachtwoord te kiezen. Die link blijft 14 dagen geldig.",
          "Saisissez votre adresse e-mail. Si elle correspond à un contact sponsor disposant d'un accès au portail, nous vous enverrons un lien pour choisir un mot de passe. Ce lien reste valable 14 jours.",
          "Enter your email address. If it belongs to a sponsor contact with portal access, we'll send you a link to choose a password. The link stays valid for 14 days.",
        )}
      </p>
      <input
        type="email"
        placeholder={MAIL_PLACEHOLDER[lng]}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && requestLink()}
        autoFocus
      />
      <button className="gr-btn" disabled={busy} onClick={requestLink}>
        {busy
          ? L("Bezig…", "En cours…", "Working…")
          : L("Stuur me een link", "Envoyez-moi un lien", "Send me a link")}
      </button>
      <button
        className="gr-linkbtn"
        onClick={() => {
          setErr("");
          setInfo("");
          setSide("sponsor");
        }}
      >
        {L("← Terug naar aanmelden", "← Retour à la connexion", "← Back to sign in")}
      </button>
    </>
  );

  const teamCard = (
    <>
      <p className="gr-muted">
        {L(
          "Beheer sponsors, edities, overeenkomsten en facturatie.",
          "Gérez les sponsors, les éditions, les accords et la facturation.",
          "Manage sponsors, editions, agreements and invoicing.",
        )}
      </p>
      <button className="gr-btn" disabled={busy} onClick={teamLogin}>
        {L("Aanmelden met Google", "Se connecter avec Google", "Sign in with Google")}
      </button>
      <p className="gr-muted" style={{ fontSize: 12 }}>
        {L(
          `Met uw @${TEAM_DOMAIN}-account.`,
          `Avec votre compte @${TEAM_DOMAIN}.`,
          `With your @${TEAM_DOMAIN} account.`,
        )}
      </p>
    </>
  );

  const sponsorForm = (
    <>
      <input
        type="email"
        placeholder={MAIL_PLACEHOLDER[lng]}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && sponsorLogin()}
        autoFocus
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder={L("Wachtwoord", "Mot de passe", "Password")}
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && sponsorLogin()}
      />
      <button className="gr-btn" disabled={busy} onClick={sponsorLogin}>
        {L("Aanmelden", "Se connecter", "Sign in")}
      </button>
      <button
        className="gr-linkbtn"
        onClick={() => {
          setErr("");
          setInfo("");
          setPassword("");
          setSide("forgot");
        }}
      >
        {L(
          "Wachtwoord vergeten of nog geen wachtwoord?",
          "Mot de passe oublié, ou pas encore de mot de passe ?",
          "Forgot your password, or don't have one yet?",
        )}
      </button>
      <button className="gr-linkbtn" onClick={reset}>
        {L("Terug", "Retour", "Back")}
      </button>
    </>
  );

  return (
    <div className="gr-landing">
      <PickLines />
      <div className="gr-landlang">
        {(["nl", "fr", "en"] as const).map((k) => (
          <button key={k} className={lng === k ? "on" : ""} onClick={() => setLng(k)}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>
      <PickLogo size={84} />
      <span className="gr-brandsub" style={{ marginTop: 10 }}>
        {L("Sponsorbeheer", "Gestion des sponsors", "Sponsor management")}
      </span>
      <div className="gr-landcards">
        <div className="gr-landcard">
          <h3 className="gr-h3">{L("Organisatie", "Organisation", "Organisation")}</h3>
          {teamCard}
        </div>
        <div className={"gr-landcard" + (side === "sponsor" || side === "forgot" ? " on" : "")}>
          <h3 className="gr-h3">
            {side === "forgot"
              ? L("Wachtwoord vergeten", "Mot de passe oublié", "Forgot your password")
              : "Sponsor"}
          </h3>
          {side === "forgot" ? (
            forgotForm
          ) : side === "sponsor" ? (
            sponsorForm
          ) : (
            <>
              <p className="gr-muted">
                {L(
                  "Werk uw bedrijfsgegevens bij en laad uw logo op.",
                  "Mettez à jour les données de votre entreprise et téléchargez votre logo.",
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
                {L("Aanmelden als sponsor", "Se connecter en tant que sponsor", "Log in as sponsor")}
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
