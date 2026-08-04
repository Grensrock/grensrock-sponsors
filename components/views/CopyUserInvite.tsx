"use client";

import { useState } from "react";
import { buildUserInvite } from "@/lib/email-templates";
import type { TranslateFn, User } from "@/types";

export default function CopyUserInvite({ user, t = (k) => k }: { user: User; t?: TranslateFn }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="gr-mini"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(buildUserInvite(user));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? t("cp.copied") : t("cp.copyinvite")}
    </button>
  );
}
