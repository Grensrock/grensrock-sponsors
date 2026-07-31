"use client";

import ImageStore from "@/components/ui/ImageStore";
import { LOGO_REQUIREMENTS, logoKey } from "@/lib/logo";

/* Sponsor logo = ImageStore on the sponsor's own key */
export default function LogoUploader({ sponsorId, compact }: { sponsorId: string; compact?: boolean }) {
  return <ImageStore storageKey={logoKey(sponsorId)} compact={compact} requirements={LOGO_REQUIREMENTS} />;
}
