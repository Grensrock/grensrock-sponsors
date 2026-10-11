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
/* Drink vouchers used to be counted in tickets of this value. Only the migration
   of records saved back then still needs it. */
export const LEGACY_DRINK_TICKET_VALUE = 27.5;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const LANGS: Record<Language, string> = { nl: "Nederlands", fr: "Français", en: "English" };
/* team app: NL + EN only */
export const TEAM_LANGS: Record<TeamLanguage, string> = { nl: "Nederlands", en: "English" };
/* grouped under the Admin panel */
export const ADMIN_TABS = ["editions", "team", "audit"];

/* ---------- contacts ---------- */
export type CommKey = "info" | "invoice";

export const COMM_LABELS: LabelMap<CommKey> = {
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

/* ---------- option labels ----------
   Every option map below is keyed by the stored value and holds one label per
   language. The maps double as the set of values we accept (see lib/normalize),
   so there is one place to add an option rather than a key list and a label list
   that drift apart. Read them through `label()` so a missing translation falls
   back to English instead of rendering "undefined". */
export type LabelMap<K extends string> = Record<K, Record<Language, string>>;

export const label = <K extends string>(map: LabelMap<K>, key: K | string, lang: Language = "nl"): string =>
  map[key as K]?.[lang] || map[key as K]?.en || String(key);

const MENTION_LABELS = {
  logo: { nl: "Logo", fr: "Logo", en: "Logo" },
  name: { nl: "Enkel naam", fr: "Nom seul", en: "Name only" },
  none: { nl: "Geen vermelding", fr: "Pas de mention", en: "No mention" },
};

export const WEBSITE_OPTS: LabelMap<WebsiteMention> = MENTION_LABELS;
export const POSTER_OPTS: LabelMap<PosterMention> = MENTION_LABELS;
export const FOLDER_OPTS: LabelMap<FolderMention> = {
  none: { nl: "Geen vermelding", fr: "Pas de mention", en: "No mention" },
  full: { nl: "Volledige pagina", fr: "Page entière", en: "Full page" },
  half: { nl: "Halve pagina", fr: "Demi-page", en: "Half page" },
  quarter: { nl: "1/4 pagina", fr: "1/4 de page", en: "1/4 page" },
  eighth: { nl: "1/8 pagina", fr: "1/8 de page", en: "1/8 page" },
};
/* How much of a page each format takes up, for the folder page count */
export const FOLDER_FRACTION: Record<FolderMention, number> = {
  none: 0,
  full: 1,
  half: 0.5,
  quarter: 0.25,
  eighth: 0.125,
};
/* VIP and Food village are the zones' own names on site and stay as they are;
   "stage" is translated, not least because Dutch "stage" means internship. */
export const LED_ZONES: LabelMap<LedZone> = {
  vip: { nl: "VIP", fr: "VIP", en: "VIP" },
  foodvillage: { nl: "Food village", fr: "Food village", en: "Food village" },
  stage: { nl: "Podium", fr: "Scène", en: "Stage" },
};

/* How the sponsor settles their contribution */
export const SETTLEMENTS: LabelMap<Settlement> = {
  invoice: { nl: "Factuur (geld)", fr: "Facture (argent)", en: "Invoice (money)" },
  inkind: { nl: "In natura — geen factuur", fr: "En nature — sans facture", en: "In kind — no invoice" },
  mixed: {
    nl: "Combinatie: deels gefactureerd, deels in natura",
    fr: "Combinaison : en partie facturé, en partie en nature",
    en: "Combination: part invoiced, part in kind",
  },
};

/* ---------- access ---------- */
export const ROLES: LabelMap<Role> = {
  admin: { nl: "Beheerder — volledige toegang", fr: "Administrateur — accès complet", en: "Admin — full access" },
  user: {
    nl: "Gebruiker — sponsors & overeenkomsten",
    fr: "Utilisateur — sponsors & accords",
    en: "User — sponsors & agreements",
  },
};

/* Team accounts use firstname@grensrock.be */
export const TEAM_DOMAIN = "grensrock.be";

/* Where the personal link in an agreement mail lands (app/auth/accept). The
   mail preview shows it bare; the send route gives each recipient a token. */
export const ACCEPT_PATH = "/auth/accept";

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
  drinkValue: 0,
  drinkVouchers: [],
  foodDrinkValue: 0,
  folderMention: "none",
  websiteMention: "none",
  posterMention: "none",
  ledboarding: [],
  fenceCovers: 0,
};

export const emptyDeal: Omit<Deal, "id"> = {
  sponsorId: "",
  editionId: "",
  formulaName: "",
  cost: "",
  vipFriday: 0,
  vipSaturday: 0,
  vipGuests: 0,
  drinkValue: 0,
  drinkVouchers: [],
  foodDrinkValue: 0,
  foodDrinkVouchers: [],
  baseFoodDrink: 0,
  folderMention: "none",
  websiteMention: "none",
  posterMention: "none",
  ledboarding: [],
  fenceCovers: 0,
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
  /* The form only ever creates accounts via the admin invite route, and an
     admin inviting someone is itself the grant of access (see 0011). */
  approved: true,
  language: "nl",
};

/* ---------- vouchers ---------- */
export const VOUCHER_TYPES: Record<VoucherType, { label: Record<Language, string>; kind: string }> = {
  vipFriday: {
    label: { nl: "VIP-ticket vrijdag", fr: "Ticket VIP vendredi", en: "VIP ticket Friday" },
    kind: "ticket",
  },
  vipSaturday: {
    label: { nl: "VIP-ticket zaterdag", fr: "Ticket VIP samedi", en: "VIP ticket Saturday" },
    kind: "ticket",
  },
  vipGuests: {
    label: { nl: "VIP-ticket genodigde", fr: "Ticket VIP invité", en: "VIP ticket guest" },
    kind: "ticket",
  },
  drink: { label: { nl: "Drankbon", fr: "Bon boissons", en: "Drink voucher" }, kind: "voucher" },
  food: {
    label: { nl: "Bon eten & drinken", fr: "Bon food & boissons", en: "Food & drink voucher" },
    kind: "voucher",
  },
};

export const VOUCHER_STATUS: Record<VoucherStatus, { label: Record<Language, string>; tone: Tone }> = {
  pending: { label: { nl: "Aan te maken", fr: "À créer", en: "To create" }, tone: "amber" },
  created: { label: { nl: "Aangemaakt", fr: "Créé", en: "Created" }, tone: "grey" },
  sent: { label: { nl: "Verzonden", fr: "Envoyé", en: "Sent" }, tone: "green" },
  cancelled: { label: { nl: "Geannuleerd", fr: "Annulé", en: "Cancelled" }, tone: "grey" },
  error: { label: { nl: "Mislukt", fr: "Échec", en: "Failed" }, tone: "amber" },
};

/** Label of a voucher type or status, in the reader's language. */
export const voucherLabel = (
  entry: { label: Record<Language, string> } | undefined,
  lang: Language = "nl",
  fallback = "",
) => entry?.label[lang] || entry?.label.en || fallback;

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
