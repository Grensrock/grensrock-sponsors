"use client";

import { useState } from "react";
import { buildInvitation } from "@/lib/email-templates";
import type { Contact, Sponsor } from "@/types";

export default function CopyInviteButton({
  sponsor,
  contact,
  responsible,
}: {
  sponsor: Sponsor;
  contact?: Contact | null;
  responsible?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildInvitation(sponsor, contact, responsible));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button className="gr-btn-ghost" onClick={copy}>
      {copied ? "Copied ✓" : "Invite (" + (contact?.language || "nl").toUpperCase() + ")"}
    </button>
  );
}
