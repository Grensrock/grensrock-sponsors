/* A logo file belonging to a sponsor, and what it may be used for. */
export interface SponsorLogo {
  id: string;
  sponsorId: string;
  /** Object name inside the sponsor-logos bucket: "{sponsorId}/{uuid}.{ext}". */
  path: string;
  /** The name the sponsor's file had, so the team can recognise it. */
  fileName: string;
  useFolder: boolean;
  useLedboarding: boolean;
}
