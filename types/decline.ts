/* A sponsor's "no" to one edition: asked, and decided not to sponsor it. */
export interface SponsorDecline {
  id: string;
  sponsorId: string;
  editionId: string;
  reason: string;
  declinedAt: string;
  /** Name of the team member who recorded it. */
  recordedBy: string;
}
