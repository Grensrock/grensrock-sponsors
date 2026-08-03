"use client";

import { useState } from "react";
import PickLines from "@/components/ui/PickLines";
import PickLogo from "@/components/ui/PickLogo";
import { userName } from "@/lib/users";
import type { User } from "@/types";

/* ---------- Waiting for an admin to grant access ----------

   Shown to someone whose @grensrock.be sign-in worked but whose profile
   is still unapproved (0011_team_access_approval.sql). Their session is
   real; RLS simply returns nothing for it, so without this screen they
   would land in a fully empty app and read it as broken.

   Deliberately a dead end: there is no action here for them to take, and
   pretending otherwise ("request access", "notify an admin") would imply
   a workflow that doesn't exist. Signing out is the only control.
*/

export default function PendingAccess({ me, onExit }: { me: User; onExit: () => void }) {
  const [lng, setLng] = useState<"nl" | "en">(me.language === "en" ? "en" : "nl");
  const L = (nl: string, en: string) => (lng === "nl" ? nl : en);

  return (
    <div className="gr-landing">
      <PickLines />
      <div className="gr-landlang">
        {(["nl", "en"] as const).map((k) => (
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
          <h3 className="gr-h3">{L("Nog even wachten", "Not quite yet")}</h3>
          <p className="gr-muted">
            {L(
              `U bent aangemeld als ${userName(me)} (${me.email}), maar een beheerder moet uw toegang nog goedkeuren.`,
              `You're signed in as ${userName(me)} (${me.email}), but an admin still has to grant you access.`,
            )}
          </p>
          <p className="gr-muted">
            {L(
              "Laat een beheerder weten dat u klaarstaat — uw aanvraag staat al in hun lijst. Meld u daarna opnieuw aan.",
              "Let an admin know you're waiting — your request is already in their list. Sign in again once they've approved it.",
            )}
          </p>
          <button className="gr-btn" onClick={onExit}>
            {L("Afmelden", "Sign out")}
          </button>
        </div>
      </div>
    </div>
  );
}
