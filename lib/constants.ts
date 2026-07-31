import type {
  Contact,
  Deal,
  Edition,
  FolderMention,
  Formula,
  Language,
  LedZone,
  PosterMention,
  Role,
  Settlement,
  Sponsor,
  TeamLanguage,
  Tone,
  User,
  VoucherStatus,
  VoucherType,
  WebsiteMention,
} from "@/types";

export const STORAGE_KEY = "grensrock:data:v1";
export const DRINK_TICKET_VALUE = 27.5;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const LANGS: Record<Language, string> = { nl: "Nederlands", fr: "Français", en: "English" };
/* team app: NL + EN only */
export const TEAM_LANGS: Record<TeamLanguage, string> = { nl: "Nederlands", en: "English" };
/* grouped under the Admin panel */
export const ADMIN_TABS = ["editions", "team", "audit"];

/* ---------- contacts ---------- */
export type CommKey = "info" | "invoice";

export const COMMS: Record<CommKey, string> = {
  info: "Information",
  invoice: "Invoicing",
};
export const COMM_LABELS: Record<CommKey, Record<Language, string>> = {
  info: { nl: "Algemene informatie", fr: "Informations générales", en: "General information" },
  invoice: { nl: "Facturatie", fr: "Facturation", en: "Invoicing" },
};
export const emptyContact: Omit<Contact, "id"> = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  language: "nl",
  prefs: { info: true, invoice: false },
  portalAccess: false, // must be activated before they can log in
};

export const WEBSITE_OPTS: Record<WebsiteMention, string> = { logo: "Logo", name: "Name only", none: "No mention" };
export const POSTER_OPTS: Record<PosterMention, string> = { logo: "Logo", name: "Name only", none: "No mention" };
export const FOLDER_OPTS: Record<FolderMention, string> = {
  none: "No mention",
  full: "Full page",
  half: "Half page",
  quarter: "1/4 page",
  eighth: "1/8 page",
};
/* How much of a page each format takes up, for the folder page count */
export const FOLDER_FRACTION: Record<FolderMention, number> = {
  none: 0,
  full: 1,
  half: 0.5,
  quarter: 0.25,
  eighth: 0.125,
};
export const LED_ZONES: Record<LedZone, string> = { vip: "VIP", foodvillage: "Food village", stage: "Stage" };

/* How the sponsor settles their contribution */
export const SETTLEMENTS: Record<Settlement, string> = {
  invoice: "Invoice (money)",
  inkind: "In kind — no invoice",
  mixed: "Combination: part invoiced, part in kind",
};

/* Language-aware display labels for the option constants (keys stay stable) */
export const OPT_KEYMAP: Record<string, string> = {
  none: "opt.nomention",
  name: "opt.nameonly",
  logo: "opt.logo",
  full: "opt.fullpage",
  half: "opt.halfpage",
  quarter: "opt.quarterpage",
  eighth: "opt.eighthpage",
};

/* ---------- access ---------- */
/* Temporary shared password for everyone. Replace with real per-user
   authentication when the app moves to a backend (BillToBox phase). */
export const SHARED_PASSWORD = "grensrock";

export const ROLES: Record<Role, string> = {
  admin: "Admin — full access",
  user: "User — sponsors & agreements",
};

/* Team accounts use firstname@grensrock.be */
export const TEAM_DOMAIN = "grensrock.be";

/* ---------- empty records ---------- */
export const emptySponsor: Omit<Sponsor, "id"> = {
  companyName: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  vatNumber: "",
  entityType: "legal",
  contacts: [],
  voucherContactId: "", // the single contact who receives the vouchers
  responsibleId: "",
  refRequired: false,
};

export const emptyEdition: Omit<Edition, "id"> = {
  name: "",
  startDate: "",
  endDate: "",
  location: "",
  active: true,
  formulas: [],
};

export const emptyFormula: Formula = {
  name: "",
  cost: "",
  vipFriday: 0,
  vipSaturday: 0,
  vipGuests: 0,
  drinkTickets: 0,
  drinkVouchers: [],
  foodDrinkValue: 0,
  folderMention: "none",
  websiteMention: "none",
  posterMention: "none",
  ledboarding: [],
  barrierCovers: 0,
  herasCovers: 0,
};

export const emptyDeal: Omit<Deal, "id"> = {
  sponsorId: "",
  editionId: "",
  formulaName: "",
  cost: "",
  vipFriday: 0,
  vipSaturday: 0,
  vipGuests: 0,
  drinkTickets: 0,
  drinkVouchers: [],
  foodDrinkValue: 0,
  foodDrinkVouchers: [],
  baseFoodDrink: 0,
  folderMention: "none",
  websiteMention: "none",
  posterMention: "none",
  ledboarding: [],
  barrierCovers: 0,
  herasCovers: 0,
  notes: "",
  settlement: "invoice",
  inKindDescription: "",
  inKindValue: "",
  refRequired: false,
  invoiceReference: "",
  invoiceCreated: false,
  invoiceNumber: "",
  emailSentAt: null,
  createdAt: null,
  requestedAt: null,
  requestedBy: "",
  confirmedAt: null,
  acceptance: null, // { acceptedAt, name, email, contactId, snapshot }
};

export const emptyUser: Omit<User, "id"> = {
  firstName: "",
  lastName: "",
  email: "",
  role: "user",
  language: "nl",
};

/* ---------- vouchers ---------- */
export const VOUCHER_TYPES: Record<VoucherType, { label: string; kind: string }> = {
  vipFriday: { label: "VIP ticket Friday", kind: "ticket" },
  vipSaturday: { label: "VIP ticket Saturday", kind: "ticket" },
  vipGuests: { label: "VIP ticket guest", kind: "ticket" },
  drink: { label: "Drink voucher", kind: "voucher" },
  food: { label: "Food & drink voucher", kind: "voucher" },
};

export const VOUCHER_STATUS: Record<VoucherStatus, { label: string; tone: Tone }> = {
  pending: { label: "To create", tone: "amber" },
  created: { label: "Created", tone: "grey" },
  sent: { label: "Sent", tone: "green" },
  cancelled: { label: "Cancelled", tone: "grey" },
  error: { label: "Failed", tone: "amber" },
};

/* ---------- Example images per return type ---------- */
export type ReturnExampleType =
  | "websiteLogo"
  | "websiteName"
  | "poster"
  | "folder"
  | "ledboarding"
  | "barrier"
  | "heras";

export const RETURN_EXAMPLES: Record<ReturnExampleType, Record<Language, string>> = {
  websiteLogo: { nl: "Logo op de website", fr: "Logo sur le site web", en: "Logo on the website" },
  websiteName: {
    nl: "Naamsvermelding op de website",
    fr: "Mention du nom sur le site web",
    en: "Name mention on the website",
  },
  poster: { nl: "Vermelding op de affiche", fr: "Mention sur l'affiche", en: "Mention on the poster" },
  folder: { nl: "Vermelding in de folder", fr: "Mention dans le dépliant", en: "Mention in the folder" },
  ledboarding: {
    nl: "Vermelding op de ledboarding",
    fr: "Mention sur le ledboarding",
    en: "Mention on the LED boarding",
  },
  barrier: { nl: "Hoes voor nadarhek", fr: "Housse pour barrière Nadar", en: "Crowd control barrier cover" },
  heras: { nl: "Hoes voor Heras-hek", fr: "Housse pour clôture Heras", en: "Heras fence cover" },
};

/* Fully custom agreement (not backed by a formula) */
export const OP_MAAT = "Op maat";

/* ---------- audit ---------- */
export const AUDIT_MAX = 1000;
