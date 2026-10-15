"use client";

import { useEffect, useState } from "react";
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
   - Sponsor contacts have two ways in, and either works at any time:
       * email + password, the password being one they set from an
         emailed link (see app/api/portal/set-password);
       * a sign-in link: type the address, follow the link that arrives,
         and app/auth/callback puts them in the portal.
     Neither replaces the other. A contact who only ever uses links never
     needs a password, and one who has a password keeps it.
*/

const TEAM_DOMAIN = "grensrock.be";

/* An example address reads as an example only in the reader's own language. */
const MAIL_PLACEHOLDER: Record<Language, string> = {
  nl: "uw@bedrijf.be",
  fr: "vous@societe.be",
  en: "you@company.com",
};

/* The codes app/auth/callback sends back when an emailed link didn't open a
   session, as opposed to the raw provider messages it passes through for
   everything else. These two are the ones this page can actually answer. */
const LINK_CODES = ["linkexpired", "linkbroken"];

export default function Landing({
  onSignedIn,
  authError = "",
}: {
  onSignedIn: () => void | Promise<void>;
  /* Read out of the URL server-side (app/page.tsx), not here: as a prop it is
     there for the first render, so a sponsor whose link died sees why straight
     away rather than after a flash of an ordinary sign-in form. */
  authError?: string;
}) {
  const linkFailed = LINK_CODES.includes(authError);
  /* Land them on the form that fixes it: what someone holding a dead link
     wants next is another one, not to be told to go and find the button. */
  const [side, setSide] = useState<null | "team" | "sponsor" | "forgot" | "magic">(
    linkFailed ? "magic" : null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /* Held as a code, not as a sentence: the language buttons still work, so the
     wording has to be chosen at render time rather than fixed on arrival. */
  const [arrivedWith, setArrivedWith] = useState(authError);
  const [err, setErr] = useState("");
  /* Google's failure belongs on the team card, not under the sponsor's form. */
  const [teamErr, setTeamErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [lng, setLng] = useState<Language>("nl");
  const L = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lng];

  /* Anything not in LINK_CODES is a raw Google/Supabase message — English, but
     better shown than swallowed. */
  const arrivalError = !arrivedWith
    ? ""
    : arrivedWith === "linkexpired"
      ? L(
          "Deze aanmeldlink werkt niet meer. Vraag hieronder een nieuwe aan.",
          "Ce lien de connexion ne fonctionne plus. Demandez-en un nouveau ci-dessous.",
          "That sign-in link no longer works. Ask for a new one below.",
        )
      : arrivedWith === "linkbroken"
        ? L(
            "Deze link is onvolledig. Vraag hieronder een nieuwe aan.",
            "Ce lien est incomplet. Demandez-en un nouveau ci-dessous.",
            "That link is incomplete. Ask for a new one below.",
          )
        : arrivedWith;
  /* The link codes are about a sponsor's emailed link; anything else came back
     from Google, so it is the team's. */
  const arrivalIsSponsors = LINK_CODES.includes(arrivedWith);

  /* Tidy the address bar once the message is on screen, so a refresh doesn't
     resurrect a complaint about a link that is long gone. Only the URL is
     touched — the code lives in state from here on, which is what keeps this
     out of the render path. */
  useEffect(() => {
    if (!authError) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("auth_error");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, [authError]);

  /* One place, because there are now four of these: a stale "link expired"
     sitting under a fresh "check your inbox" is how a working portal comes to
     look broken. Anything that starts a new attempt wipes them all. */
  const clearMessages = () => {
    setErr("");
    setTeamErr("");
    setInfo("");
    setArrivedWith("");
  };

  const reset = () => {
    setSide(null);
    setEmail("");
    setPassword("");
    clearMessages();
  };

  /* On a phone the keyboard covers the lower half of the screen, and the
     answer to a sign-in appears under its button — behind the keyboard, unless
     it is put away first. */
  const dropKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  /* Under the button that caused it, in the card it is about. Below both cards
     it sat off the bottom of a phone screen, and in red on the black page. */
  const message = (text: string, tone: "err" | "info") =>
    text ? (
      <p className={"gr-landmsg" + (tone === "err" ? " err" : "")} role={tone === "err" ? "alert" : "status"}>
        {text}
      </p>
    ) : null;
  const sponsorErr = err || (arrivalIsSponsors ? arrivalError : "");

  /* Team: Google Workspace */
  const teamLogin = async () => {
    if (busy) return;
    clearMessages();
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
      setTeamErr(
        L(
          "Aanmelden met Google lukte niet. Probeer het zo dadelijk opnieuw.",
          "La connexion avec Google a échoué. Réessayez dans un instant.",
          "Could not sign in with Google. Please try again in a moment.",
        ),
      );
    }
    /* On success the browser navigates to Google, so `busy` stays true. */
  };

  /* Sponsor, way one: email + password. */
  const sponsorLogin = async () => {
    if (busy) return;
    clearMessages();
    dropKeyboard();
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
       callback does has to happen here. It is a no-op if already bound. */
    await supabase.rpc("claim_portal_contact");
    /* Busy until the portal has loaded and replaced this page: dropped any
       earlier, the button comes back to life for the seconds the data takes,
       and a second tap signs in twice. */
    try {
      await onSignedIn();
    } finally {
      setBusy(false);
    }
  };

  /* ---------- the two "mail me something" forms ----------
     They ask for the same thing and answer the same way, and only differ in
     which route they post to and what they say afterwards, so they are one
     function and one piece of markup rather than two that drift apart.

     Both always report success. Whether the address matched a contact is not
     something an unauthenticated caller gets to learn — see the route. */
  const mailMe = async (kind: "magic" | "forgot") => {
    if (busy) return;
    if (!email.trim()) {
      setErr(L("Vul uw e-mailadres in.", "Saisissez votre adresse e-mail.", "Enter your email address."));
      return;
    }
    clearMessages();
    dropKeyboard();
    setBusy(true);
    try {
      await fetch(kind === "magic" ? "/api/portal/magic-link" : "/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      /* The message below is deliberately the same either way. */
    }
    setBusy(false);
    setInfo(
      kind === "magic"
        ? L(
            "Als dat adres bij een sponsorcontact met portaaltoegang hoort, is er een aanmeldlink onderweg. Die blijft een uur geldig.",
            "Si cette adresse correspond à un contact sponsor disposant d'un accès au portail, un lien de connexion est en route. Il reste valable une heure.",
            "If that address belongs to a sponsor contact with portal access, a sign-in link is on its way. It stays valid for an hour.",
          )
        : L(
            "Als dat adres bij een sponsorcontact met portaaltoegang hoort, is er een link onderweg. Die blijft 14 dagen geldig.",
            "Si cette adresse correspond à un contact sponsor disposant d'un accès au portail, un lien est en route. Il reste valable 14 jours.",
            "If that address belongs to a sponsor contact with portal access, a link is on its way. It stays valid for 14 days.",
          ),
    );
  };

  /* Each on its own screen rather than as extra buttons under the sign-in
     card: the three ask for different things, and a password box sitting
     under an email box invites people to fill both in and wonder why nothing
     happened. The typed address carries over, so arriving here after a failed
     sign-in costs nothing. */
  const mailForm = (kind: "magic" | "forgot") => (
    <>
      <p className="gr-muted">
        {kind === "magic"
          ? L(
              "Vul uw e-mailadres in. Als dat adres bij een sponsorcontact met portaaltoegang hoort, sturen we u een link waarmee u meteen binnen bent. Een wachtwoord hebt u dan niet nodig.",
              "Saisissez votre adresse e-mail. Si elle correspond à un contact sponsor disposant d'un accès au portail, nous vous enverrons un lien qui vous connecte directement. Aucun mot de passe n'est nécessaire.",
              "Enter your email address. If it belongs to a sponsor contact with portal access, we'll send you a link that signs you straight in. No password needed.",
            )
          : L(
              "Vul uw e-mailadres in. Als dat adres bij een sponsorcontact met portaaltoegang hoort, sturen we u een link om een wachtwoord te kiezen. Die link blijft 14 dagen geldig.",
              "Saisissez votre adresse e-mail. Si elle correspond à un contact sponsor disposant d'un accès au portail, nous vous enverrons un lien pour choisir un mot de passe. Ce lien reste valable 14 jours.",
              "Enter your email address. If it belongs to a sponsor contact with portal access, we'll send you a link to choose a password. The link stays valid for 14 days.",
            )}
      </p>
      {/* A form, so the keyboard's own Go key sends it. noValidate keeps the
          browser's bubble out of it: the messages below are the ones that
          speak the sponsor's language. */}
      <form
        className="gr-landform"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          mailMe(kind);
        }}
      >
        <input
          type="email"
          autoComplete="email"
          placeholder={MAIL_PLACEHOLDER[lng]}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearMessages();
          }}
          autoFocus
        />
        <button type="submit" className="gr-btn" disabled={busy}>
          {busy
            ? L("Bezig…", "En cours…", "Working…")
            : kind === "magic"
              ? L("Stuur me een aanmeldlink", "Envoyez-moi un lien de connexion", "Send me a sign-in link")
              : L("Stuur me een link", "Envoyez-moi un lien", "Send me a link")}
        </button>
      </form>
      {message(sponsorErr, "err")}
      {!sponsorErr && message(info, "info")}
      <button
        className="gr-linkbtn"
        onClick={() => {
          clearMessages();
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
      {message(teamErr || (arrivalIsSponsors ? "" : arrivalError), "err")}
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
      {/* A form for the same reason as above, and so a password manager sees
          a sign-in it can fill and offer to save. */}
      <form
        className="gr-landform"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          sponsorLogin();
        }}
      >
        <input
          type="email"
          autoComplete="email"
          placeholder={MAIL_PLACEHOLDER[lng]}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearMessages();
          }}
          autoFocus
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder={L("Wachtwoord", "Mot de passe", "Password")}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearMessages();
          }}
        />
        <button type="submit" className="gr-btn" disabled={busy}>
          {busy ? L("Bezig…", "En cours…", "Working…") : L("Aanmelden", "Se connecter", "Sign in")}
        </button>
      </form>
      {message(sponsorErr, "err")}
      {/* Offered before "forgot your password", because for most people it is
          the better answer to the same problem: it needs nothing remembered. */}
      <button
        className="gr-linkbtn"
        onClick={() => {
          clearMessages();
          setPassword("");
          setSide("magic");
        }}
      >
        {L(
          "Liever zonder wachtwoord? Stuur me een aanmeldlink",
          "Plutôt sans mot de passe ? Envoyez-moi un lien de connexion",
          "Rather not use a password? Send me a sign-in link",
        )}
      </button>
      <button
        className="gr-linkbtn"
        onClick={() => {
          clearMessages();
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

  const open = side === "sponsor" || side === "forgot" || side === "magic";

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
        <div className={"gr-landcard" + (open ? " on" : "")}>
          <h3 className="gr-h3">
            {side === "forgot"
              ? L("Wachtwoord vergeten", "Mot de passe oublié", "Forgot your password")
              : side === "magic"
                ? L("Aanmelden met een link", "Se connecter avec un lien", "Sign in with a link")
                : "Sponsor"}
          </h3>
          {side === "forgot" || side === "magic" ? (
            mailForm(side)
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
                  clearMessages();
                  setSide("sponsor");
                }}
              >
                {L("Aanmelden als sponsor", "Se connecter en tant que sponsor", "Log in as sponsor")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
