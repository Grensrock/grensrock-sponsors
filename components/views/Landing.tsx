"use client";

import { useState } from "react";
import PickLines from "@/components/ui/PickLines";
import PickLogo from "@/components/ui/PickLogo";
import { SHARED_PASSWORD } from "@/lib/constants";
import { canLogIn, sponsorContacts } from "@/lib/contacts";
import { sameEmail } from "@/lib/email-validate";
import type { Sponsor, User } from "@/types";

/* ---------- Landing (choose team vs sponsor access) ---------- */

export default function Landing({
  users,
  sponsors,
  onTeam,
  onPortal,
}: {
  users: User[];
  sponsors: Sponsor[];
  onTeam: (userId: string | null) => void;
  onPortal: (sponsorId: string, contactId: string) => void;
}) {
  const [side, setSide] = useState<null | "team" | "sponsor">(null); // null | 'team' | 'sponsor'
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [lng, setLng] = useState("nl");
  const L = (nl: string, en: string) => (lng === "nl" ? nl : en);
  const noAccounts = users.length === 0;

  const check = (who: "team" | "sponsor") => {
    if (pwd !== SHARED_PASSWORD) {
      setErr(L("Verkeerd wachtwoord.", "Wrong password."));
      return;
    }
    if (who === "team") {
      const u = users.find((x) => sameEmail(x.email, email));
      if (u) {
        onTeam(u.id);
        return;
      }
      setErr(
        L(
          "Geen teamaccount met dit e-mailadres. Vraag een beheerder om u toe te voegen.",
          "No team account with that email address. Ask an admin to add you.",
        ),
      );
    } else {
      let found: { sponsorId: string; contactId: string } | null = null,
        inactive = false;
      for (const sp of sponsors) {
        const c = sponsorContacts(sp).find((x) => x.email && sameEmail(x.email, email));
        if (c) {
          if (canLogIn(c)) {
            found = { sponsorId: sp.id, contactId: c.id };
          } else {
            inactive = true;
          }
          break;
        }
      }
      if (found) {
        onPortal(found.sponsorId, found.contactId);
        return;
      }
      setErr(
        inactive
          ? L(
              "Dit account is nog niet geactiveerd. Vraag uw Grensrock-contact, of een collega die al toegang heeft, om het te activeren.",
              "This account hasn't been activated yet. Ask your Grensrock contact, or a colleague who already has access, to activate it.",
            )
          : L(
              "Dit e-mailadres kennen we niet. Gebruik het adres dat wij van u hebben.",
              "We don't know that email address. Use the address we have on file for you.",
            ),
      );
    }
  };

  const form = (who: "team" | "sponsor", label: string) => (
    <>
      <input
        type="email"
        placeholder="uw@email.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && check(who)}
        autoFocus
      />
      <input
        type="password"
        placeholder={L("Wachtwoord", "Password")}
        value={pwd}
        onChange={(e) => {
          setPwd(e.target.value);
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && check(who)}
      />
      <button className="gr-btn" onClick={() => check(who)}>
        {label}
      </button>
      <button
        className="gr-linkbtn"
        onClick={() => {
          setSide(null);
          setEmail("");
          setPwd("");
          setErr("");
        }}
      >
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
          {noAccounts ? (
            <>
              <p className="gr-muted">
                {L(
                  "Nog geen teamaccounts — stel de eerste beheerder in.",
                  "No team accounts yet — set up the first admin.",
                )}
              </p>
              <button className="gr-btn" onClick={() => onTeam(null)}>
                {L("Instellen", "Set up")}
              </button>
            </>
          ) : side === "team" ? (
            form("team", L("Aanmelden", "Log in"))
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
            form("sponsor", L("Mijn pagina openen", "Open my page"))
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
    </div>
  );
}
