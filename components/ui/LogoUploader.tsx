"use client";

import ImageStore from "@/components/ui/ImageStore";
import { LOGO_REQUIREMENTS } from "@/lib/logo";
import { logoRef } from "@/lib/supabase/storage";

/* Sponsor logo = ImageStore on the sponsor's own folder in the sponsor-logos bucket */
export default function LogoUploader({ sponsorId, compact }: { sponsorId: string; compact?: boolean }) {
  return <ImageStore image={logoRef(sponsorId)} compact={compact} requirements={LOGO_REQUIREMENTS} />;
}
