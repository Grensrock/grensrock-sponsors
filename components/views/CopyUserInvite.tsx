"use client";

import { useState } from "react";
import { buildUserInvite } from "@/lib/email-templates";
import type { User } from "@/types";

export default function CopyUserInvite({ user }: { user: User }) {
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
      {copied ? "Copied ✓" : "Copy invite"}
    </button>
  );
}
