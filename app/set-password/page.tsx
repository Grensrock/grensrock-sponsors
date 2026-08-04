"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PickLines from "@/components/ui/PickLines";
import PickLogo from "@/components/ui/PickLogo";
import { supabase } from "@/lib/supabase/client";

/* ---------- Set a portal password ----------
   Landed on from the emailed link. The token in the query string is the
   only thing authenticating this page, so it is never rendered, logged,
   or kept after use — it goes straight to /api/portal/set-password.

   On success this signs the contact in immediately rather than sending
   them back to a login form to type what they just chose. */

const MIN = 10;

type Say = (nl: string, fr: string, en: string) => string;

/* The route answers with a `code`; the sentence is written here, where the
   reader's language is known. `error` is its English fallback. */
const apiMessage = (body: { code?: string; error?: string; min?: number }, L: Say): string => {
  switch (body?.code) {
    case "invalidlink":
      return L(
        "Deze link werkt niet meer. Vraag een nieuwe aan op de aanmeldpagina.",
        "Ce lien ne fonctionne plus. Demandez-en un nouveau sur la page de connexion.",
        "This link is no longer valid. Ask for a new one from the sign-in page.",
      );
    case "tooshort":
      return L(
        `Kies een wachtwoord van minstens ${body.min ?? MIN} tekens.`,
        `Choisissez un mot de passe d'au moins ${body.min ?? MIN} caractères.`,
        `Choose a password of at least ${body.min ?? MIN} characters.`,
      );
    default:
      return (
        body?.error ||
        L("Er ging iets mis.", "Une erreur s'est produite.", "Something went wrong.")
      );
  }
};

function SetPassword() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [lng, setLng] = useState<"nl" | "fr" | "en">("nl");
  const L = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lng];

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const tooShort = pw.length > 0 && pw.length < MIN;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const ready = pw.length >= MIN && pw === pw2 && !!token;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiMessage(body, L));

      /* Straight in, rather than bouncing them to a form to retype it. */
      const { error } = await supabase.auth.signInWithPassword({ email: body.email, password: pw });
      if (error) {
        setDone(true); // the password IS set; only the automatic sign-in failed
      } else {
        await supabase.rpc("claim_portal_contact");
        window.location.href = "/";
        return;
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

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
      <PickLogo size={150} />
      <span className="gr-brandsub" style={{ marginTop: 10 }}>
        {L("Sponsorportaal", "Portail sponsors", "Sponsor portal")}
      </span>

      <div className="gr-landcards">
        <div className="gr-landcard on">
          <h3 className="gr-h3">{L("Kies een wachtwoord", "Choisissez un mot de passe", "Choose a password")}</h3>

          {!token ? (
            <p className="gr-muted">
              {L(
                "Deze link is onvolledig. Vraag een nieuwe aan op de aanmeldpagina.",
                "Ce lien est incomplet. Demandez-en un nouveau sur la page de connexion.",
                "This link is incomplete. Request a new one from the sign-in page.",
              )}
            </p>
          ) : done ? (
            <>
              <p className="gr-muted">
                {L(
                  "Uw wachtwoord is ingesteld. U kan zich nu aanmelden.",
                  "Votre mot de passe est défini. Vous pouvez maintenant vous connecter.",
                  "Your password is set. You can sign in now.",
                )}
              </p>
              <Link className="gr-btn gr-btn-link" href="/">
                {L("Naar het aanmelden", "Vers la connexion", "Go to sign in")}
              </Link>
            </>
          ) : (
            <>
              <input
                type="password"
                autoComplete="new-password"
                placeholder={L("Nieuw wachtwoord", "Nouveau mot de passe", "New password")}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={L("Herhaal het wachtwoord", "Répétez le mot de passe", "Repeat the password")}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                style={mismatch ? { borderColor: "var(--red)" } : undefined}
              />
              <span className="gr-hint">
                {tooShort
                  ? L(
                      `Minstens ${MIN} tekens.`,
                      `Au moins ${MIN} caractères.`,
                      `At least ${MIN} characters.`,
                    )
                  : mismatch
                    ? L(
                        "De twee wachtwoorden verschillen.",
                        "Les deux mots de passe diffèrent.",
                        "The two passwords don't match.",
                      )
                    : L(
                        `Minstens ${MIN} tekens.`,
                        `Au moins ${MIN} caractères.`,
                        `At least ${MIN} characters.`,
                      )}
              </span>
              {err && <p className="gr-warn">{err}</p>}
              <button className="gr-btn" disabled={!ready || busy} onClick={submit}>
                {busy
                  ? L("Bezig…", "En cours…", "Working…")
                  : L("Wachtwoord instellen", "Définir le mot de passe", "Set password")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  /* useSearchParams needs a Suspense boundary above it. */
  return (
    <Suspense fallback={<div className="gr-root" />}>
      <div className="gr-root">
        <SetPassword />
      </div>
    </Suspense>
  );
}
