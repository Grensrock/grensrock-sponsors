/* Agreements ("deals") and the benefit fields they share with formulas. */

/* Number inputs in the prototype keep "" while the user clears a field, so the
   numeric benefit fields are stored as number-or-empty-string. Every read site
   wraps them in Number(...). */
export type NumLike = number | string;

export type Settlement = "invoice" | "inkind" | "mixed";

export type FolderMention = "none" | "full" | "half" | "quarter" | "eighth";
export type WebsiteMention = "none" | "name" | "logo";
export type PosterMention = "none" | "name" | "logo";
export type LedZone = "vip" | "foodvillage" | "stage";

export interface VoucherRow {
  value: NumLike;
  qty: NumLike;
}

/* Everything a formula defines — a deal carries the same fields (snapshot,
   not a live reference to the formula). */
export interface FormulaFields {
  cost: NumLike;
  vipFriday: NumLike;
  vipSaturday: NumLike;
  vipGuests: NumLike;
  /** Drink vouchers are agreed as an amount in euro, not as a number of tickets. */
  drinkValue: NumLike;
  drinkVouchers: VoucherRow[];
  foodDrinkValue: NumLike;
  /** What the formula included, so a sponsor top-up can still be billed. */
  baseFoodDrink?: NumLike;
  foodDrinkVouchers?: VoucherRow[];
  folderMention: FolderMention;
  websiteMention: WebsiteMention;
  posterMention: PosterMention;
  ledboarding: LedZone[];
  /** Banners. Stored as fence_covers: they started out as Nadar and Heras fence covers (0020). */
  fenceCovers: NumLike;
}

export interface Acceptance {
  acceptedAt: string;
  name: string;
  email: string;
  /** Null when an admin recorded it on the sponsor's behalf. */
  contactId: string | null;
  /** Set when an admin accepted in the sponsor's place; name and email are then the admin's. */
  byTeam?: boolean;
  /** Frozen terms at the moment of acceptance. */
  snapshot: Partial<Deal>;
}

export interface Deal extends FormulaFields {
  id: string;
  sponsorId: string;
  editionId: string;
  /** Loose reference to Formula.name — a snapshot, not a foreign key. */
  formulaName: string;
  baseFoodDrink: NumLike;
  foodDrinkVouchers: VoucherRow[];
  notes: string;
  settlement: Settlement;
  inKindDescription: string;
  inKindValue: NumLike;
  /** Per-agreement override of Sponsor.refRequired. */
  refRequired: boolean;
  invoiceReference: string;
  invoiceCreated: boolean;
  invoiceNumber: string;
  emailSentAt: string | null;
  createdAt: string | null;
  requestedAt: string | null;
  requestedBy: string;
  confirmedAt: string | null;
  responsible?: string;
  acceptance: Acceptance | null;
}

/* What the deal form works with: a partially filled agreement, plus the
   UI-only flag that locks the sponsor picker. */
export type DealDraft = Partial<Deal> & { lockSponsor?: boolean };
