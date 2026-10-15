"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import ContactForm from "@/components/forms/ContactForm";
import DealForm, { type DealFormState } from "@/components/forms/DealForm";
import EditionForm from "@/components/forms/EditionForm";
import FormulaForm from "@/components/forms/FormulaForm";
import SponsorForm from "@/components/forms/SponsorForm";
import TickowebSettings from "@/components/forms/TickowebSettings";
import UserForm, { type UserFormState } from "@/components/forms/UserForm";
import VatLookupSettings from "@/components/forms/VatLookupSettings";
import ContactImportModal, { type ContactImportRow } from "@/components/modals/ContactImportModal";
import EmailModal from "@/components/modals/EmailModal";
import ExampleImagesManager from "@/components/modals/ExampleImagesManager";
import ImportModal, { type SponsorImportRow } from "@/components/modals/ImportModal";
import NewContactModal from "@/components/modals/NewContactModal";
import ConfirmDialog, { type DialogSpec } from "@/components/ui/ConfirmDialog";
import { MailLink, PhoneLink } from "@/components/ui/ContactLink";
import Modal from "@/components/ui/Modal";
import PickLogo from "@/components/ui/PickLogo";
import Tag from "@/components/ui/Tag";
import CopyUserInvite from "@/components/views/CopyUserInvite";
import Faq from "@/components/views/Faq";
import FolderOverview from "@/components/views/FolderOverview";
import Landing from "@/components/views/Landing";
import SponsorDetail from "@/components/views/SponsorDetail";
import DeclineForm from "@/components/forms/DeclineForm";
import PendingAccess from "@/components/views/PendingAccess";
import SponsorPortal from "@/components/views/SponsorPortal";
import { changedSinceAcceptance, fmtDateTime, isAccepted } from "@/lib/acceptance";
import { formatAddress } from "@/lib/address";
import { auditActorLabel } from "@/lib/audit-engine";
import * as auditApi from "@/lib/api/audit";
import * as contactsApi from "@/lib/api/contacts";
import * as logosApi from "@/lib/api/logos";
import * as dealsApi from "@/lib/api/deals";
import * as declinesApi from "@/lib/api/declines";
import * as editionsApi from "@/lib/api/editions";
import * as formulasApi from "@/lib/api/formulas";
import * as settingsApi from "@/lib/api/settings";
import * as sponsorsApi from "@/lib/api/sponsors";
import * as usersApi from "@/lib/api/users";
import * as vouchersApi from "@/lib/api/vouchers";
import { supabase } from "@/lib/supabase/client";
import { removeAllLogoFiles } from "@/lib/supabase/storage";
import {
  ADMIN_TABS,
  AUDIT_ENTITIES,
  COMM_LABELS,
  FOLDER_OPTS,
  LANGS,
  POSTER_OPTS,
  TEAM_LANGS,
  VOUCHER_STATUS,
  VOUCHER_TYPES,
  WEBSITE_OPTS,
  emptySponsor,
  label,
  voucherLabel,
  type CommKey,
} from "@/lib/constants";
import { contactName, primaryContact, sponsorContacts, voucherContact } from "@/lib/contacts";
import { sameEmail } from "@/lib/email-validate";
import { isNetworkError } from "@/lib/errors";
import { defaultTickoweb, tickoweb } from "@/lib/integrations/tickoweb";
import { defaultVatLookup } from "@/lib/integrations/vat-lookup";
import {
  dealTotalCost,
  eur,
  foodDrinkExtra,
  invoiceAmount,
  needsInvoice,
  refMissing,
  refRequiredFor,
} from "@/lib/money";
import { ledLabel, normFolder, normLed, normNameKey, normVatKey } from "@/lib/normalize";
import { isAdmin, responsibleName, userName } from "@/lib/users";
import { teamFaq } from "@/lib/faq";
import { portalDialogT, teamT } from "@/lib/i18n";
import { expectedVouchers, ticketLines, visibilityLines, voucherProducts } from "@/lib/vouchers";
import type {
  AppData,
  AuditEntity,
  AuditEntry,
  Contact,
  Deal,
  DealDraft,
  Edition,
  Formula,
  Language,
  Role,
  Settings,
  Sponsor,
  SponsorDecline,
  SponsorLogo,
  TeamLanguage,
  TickowebConfig,
  TranslateFn,
  User,
  Voucher,
  VoucherStatus,
} from "@/types";

/* ============================================================
   Main app
   ============================================================ */

type ModalState =
  | { type: "sponsor"; payload?: Sponsor }
  | { type: "contact"; payload: { sponsorId: string; contact: Contact | null } }
  | { type: "newContact" }
  | { type: "importContacts" }
  | { type: "acceptance"; payload: Deal }
  | { type: "examples" }
  | { type: "vatlookup" }
  | { type: "tickoweb" }
  | { type: "user"; payload?: Partial<User> }
  | { type: "import" }
  | { type: "edition"; payload?: Edition }
  | { type: "formula"; payload: { editionId: string; formula?: Formula } }
  | { type: "deal"; payload?: DealDraft }
  | { type: "email"; payload: Deal }
  | { type: "decline"; payload: { sponsorId: string } };

type ViewMode =
  | { view: "landing" }
  | { view: "team" }
  | { view: "portal"; sponsorId: string; contactId: string }
  | { view: "pending"; profile: User };

const EMPTY_DATA: AppData = { sponsors: [], editions: [], deals: [], users: [], vouchers: [], audit: [] };

/* The database keeps contacts and formulas in their own tables; the components
   were written against sponsors with an embedded contacts[] and editions with an
   embedded formulas[], so the flat rows are grouped back under their parent here
   and nothing downstream has to change. */
const groupContacts = (sponsors: Sponsor[], contacts: contactsApi.ContactWithSponsor[]): Sponsor[] =>
  sponsors.map((s) => ({
    ...s,
    contacts: contacts
      .filter((c) => c.sponsorId === s.id)
      .map(({ sponsorId: _sponsorId, ...c }) => c as Contact),
  }));

const groupFormulas = (editions: Edition[], formulas: formulasApi.FormulaWithEdition[]): Edition[] =>
  editions.map((e) => ({
    ...e,
    formulas: formulas
      .filter((f) => f.editionId === e.id)
      .map(({ editionId: _editionId, ...f }) => f as Formula),
  }));

/* `authError` is a code from app/auth/callback, read server-side in app/page.tsx
   and passed straight through to Landing — the only screen that can act on it. */
export default function GrensrockApp({ authError = "" }: { authError?: string }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [mode, setMode] = useState<ViewMode>({ view: "landing" }); // landing | team | portal
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState<ModalState | null>(null); // {type, payload}
  const [query, setQuery] = useState("");
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null);
  const [invEdition, setInvEdition] = useState("");
  const [voEdition, setVoEdition] = useState("");
  const [voSponsor, setVoSponsor] = useState("");
  const [voStatus, setVoStatus] = useState("");
  const [voSel, setVoSel] = useState<string[]>([]);
  const [spSel, setSpSel] = useState<string[]>([]);
  const [coSel, setCoSel] = useState<string[]>([]);
  const [coBusy, setCoBusy] = useState("");
  const [spBusy, setSpBusy] = useState(false);
  const [voBusy, setVoBusy] = useState(false);
  const [folEdition, setFolEdition] = useState("");
  const [coQuery, setCoQuery] = useState("");
  const [coComm, setCoComm] = useState("");
  const [coLang, setCoLang] = useState("");
  const [auQuery, setAuQuery] = useState("");
  const [auEntity, setAuEntity] = useState("");
  const [agQuery, setAgQuery] = useState("");
  const [agEdition, setAgEdition] = useState("");
  const [agResponsible, setAgResponsible] = useState("");
  const [agStatus, setAgStatus] = useState("");
  const [agSettle, setAgSettle] = useState("");
  const [adminSub, setAdminSub] = useState("editions");
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  /* ----- "view as user" -----
     An admin checking what a colleague on the user role sees. Everything
     admin-only already hangs off `admin` (below), so hiding it is a matter of
     answering false — there is no second list of features to keep in step.

     A preview of the interface, not of the permissions: the session is still
     an admin's, so is_admin() in the policies stays true and anything written
     from here is written as an admin. It shows what a user can reach, not what
     they would be allowed to do. Kept in memory, like langOverride, so a
     reload or a new session always lands back on the admin's own view. */
  const [previewUser, setPreviewUser] = useState(false);
  /* Below 900px the header nav collapses behind this (see the mobile block in
     grensrock.css). Nine destinations plus the account controls need ~1500px to
     sit on one line, so on a phone the wrapped menu filled most of the screen
     before any content started. */
  const [navOpen, setNavOpen] = useState(false);
  /* The same idea one audience further out: the sponsor's own portal, as one of
     their contacts receives it. Read-only — see the lock in SponsorPortal. */
  const [previewPortal, setPreviewPortal] = useState<{ sponsorId: string; contactId: string } | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: number }>({ key: "companyName", dir: 1 });
  /* "" = all editions, else "<kind>:<editionId>": with an agreement (agr),
     declined (decl), or neither yet (open). */
  const [fEdition, setFEdition] = useState("");
  const [fResponsible, setFResponsible] = useState(""); // "" = everyone, "me", "none", or a user id
  const toggleSort = (key: string) => setSort((p) => (p.key === key ? { key, dir: -p.dir } : { key, dir: 1 }));
  const ask = (message: string, onConfirm: () => void, opts: Partial<DialogSpec> = {}) =>
    setDialog({ message, onConfirm, danger: true, ...opts });
  const notify = (message: string, title?: string) => setDialog({ message, title: title || t("dlg.done") });

  /* ----- error surface for every write ----- */
  /* The title is passed on as a key, not a sentence: the UI language is only
     known further down (it comes from the loaded user), while failWith has to
     keep a stable identity for the effects that depend on it. ConfirmDialog
     translates it at the point it is drawn. A dropped connection gets a key
     for its message too, so it reads as words rather than the browser's
     "TypeError: Load failed". */
  const failWith = useCallback((e: unknown, title?: string) => {
    console.error(e);
    setSaveErr(true);
    setDialog(
      isNetworkError(e)
        ? { messageKey: "dlg.offline", title, titleKey: "dlg.savefail" }
        : { message: String((e as Error)?.message || e), title, titleKey: "dlg.savefail" },
    );
  }, []);

  /* ----- load: one parallel read per table, assembled into the shape the UI expects ----- */
  const loadAll = useCallback(async (scope: "team" | "portal", asAdmin: boolean) => {
    const [
      sponsorRows,
      contactRows,
      editionRows,
      formulaRows,
      dealRows,
      voucherRows,
      logoRows,
      userRows,
      pendingRows,
      settings,
      auditRows,
      declineRows,
    ] =
      await Promise.all([
        sponsorsApi.listSponsors(),
        contactsApi.listContacts(),
        editionsApi.listEditions(),
        formulasApi.listFormulas(),
        dealsApi.listDeals(),
        vouchersApi.listVouchers(),
        logosApi.listLogos(),
        scope === "team" ? usersApi.listUsers() : Promise.resolve([] as User[]),
        scope === "team" ? usersApi.listPendingUsers() : Promise.resolve([] as User[]),
        scope === "team" ? settingsApi.getSettings() : Promise.resolve({} as Settings),
        scope === "team" && asAdmin ? auditApi.listAudit() : Promise.resolve([] as AuditEntry[]),
        scope === "team" ? declinesApi.listDeclines() : Promise.resolve([] as SponsorDecline[]),
      ]);
    setData({
      sponsors: groupContacts(sponsorRows, contactRows),
      editions: groupFormulas(editionRows, formulaRows),
      deals: dealRows,
      vouchers: voucherRows,
      logos: logoRows,
      declines: declineRows,
      users: userRows,
      pendingUsers: pendingRows,
      audit: auditRows,
      settings,
    });
    setSaveErr(false);
  }, []);

  /* Where a visitor lands is decided by their Supabase session, not by a click:
     a profiles row means team, a claimed contacts row means sponsor portal. */
  const enterSession = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setUserId(null);
        setData(EMPTY_DATA);
        setMode({ view: "landing" });
        return;
      }

      const profile = await usersApi.getMyProfile();
      /* Registered but not yet granted access (0011): the session is real, RLS
         just returns nothing for it, so loading the app would show an empty
         shell that reads as broken. */
      if (profile && !profile.approved) {
        setUserId(null);
        setData(EMPTY_DATA);
        setMode({ view: "pending", profile });
        return;
      }
      /* The mode is set once the data is in, not before. Switched first, the
         screen rendered on empty data while it loaded: a portal with no sponsor
         in it is the "not available" page with a sign-out button, and a team
         view with no users takes everyone for the bootstrap admin. Set in a
         finally, so a failed load still lands on the screen that reports it. */
      if (profile) {
        setUserId(profile.id);
        setTab("overview");
        try {
          await loadAll("team", profile.role === "admin");
        } finally {
          setMode({ view: "team" });
        }
        return;
      }

      const contact = await contactsApi.getMyContact();
      if (contact) {
        setUserId(null);
        try {
          await loadAll("portal", false);
        } finally {
          setMode({ view: "portal", sponsorId: contact.sponsorId, contactId: contact.id });
        }
        return;
      }

      /* Signed in, but neither a team profile nor a claimed sponsor contact:
         a Google account outside grensrock.be, or a sponsor whose contact was
         never given portal access. ensure_team_profile()/claim_portal_contact()
         both declined, so there is nothing to show and RLS blocks every write. */
      setUserId(null);
      setTab("overview");
      try {
        await loadAll("team", false);
      } finally {
        setMode({ view: "team" });
      }
    } catch (e) {
      console.error(e);
      setSaveErr(true);
    } finally {
      setLoaded(true);
    }
  }, [loadAll]);

  useEffect(() => {
    (async () => {
      await enterSession();
    })();
  }, [enterSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setData(EMPTY_DATA);
    setPreviewUser(false); // whoever signs in next starts on their own view
    setPreviewPortal(null);
    setMode({ view: "landing" });
  };

  /* ----- derived ----- */
  const { sponsors, editions, deals } = data;
  const users = data.users || [];
  const vouchers = data.vouchers || [];
  const declines = useMemo(() => data.declines || [], [data.declines]);
  const me = users.find((u) => u.id === userId) || null;
  const realAdmin = users.length === 0 ? true : isAdmin(me); // bootstrap: first entry is admin
  const admin = realAdmin && !previewUser;
  /* Who may change a sponsor, its contacts, declines and agreements: an admin,
     or the team member responsible for it (0024 enforces the same rule in the
     database). Unassigned sponsors are therefore an admin's to hand out. */
  const canManage = (s?: Pick<Sponsor, "responsibleId"> | null) =>
    !!s && (admin || (!!userId && s.responsibleId === userId));
  const manageableSponsors = sponsors.filter((s) => canManage(s));
  // A non-admin should never sit on an admin-only tab (e.g. after losing admin, or stale state)
  useEffect(() => {
    const adminOnly = ADMIN_TABS.includes(tab) || ["folder", "invoicing", "vouchers"].includes(tab);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- unchanged Stage-1 guard
    if (!admin && adminOnly) setTab("overview");
  }, [admin, tab]);
  /* Escape closes the collapsed nav. It is a disclosure rather than a modal —
     it pushes the page down instead of covering it — so it does not trap focus;
     Escape is just the key people reach for to dismiss something. */
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);
  /* The audit log is written by database triggers now, so it is re-read when the
     tab is opened instead of being kept up to date in memory. */
  useEffect(() => {
    if (tab !== "audit" || !admin || mode.view !== "team") return;
    let live = true;
    auditApi
      .listAudit()
      .then((rows) => live && setData((d) => ({ ...d, audit: rows })))
      .catch((e) => console.error(e));
    return () => {
      live = false;
    };
  }, [tab, admin, mode.view]);
  const [langOverride, setLangOverride] = useState<TeamLanguage | null>(null); // header switcher, this session only
  const uiLang: TeamLanguage = langOverride || me?.language || "nl";
  const t: TranslateFn = (key, params) => teamT(key, uiLang, params);
  /* For an error quoted inside a longer message (a mail that didn't go out, a
     list of what failed); failWith does the same for a dialog of its own. */
  const errText = (e: unknown) => (isNetworkError(e) ? t("dlg.offline") : String((e as Error)?.message || e));
  const activeEditions = editions.filter((e) => e.active);
  const sortedEditions = [...editions].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));

  const filteredSponsors = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...sponsors];

    /* Where each sponsor stands for one edition */
    if (fEdition) {
      const [kind, edId] = fEdition.split(":");
      const agreed = (s: Sponsor) => deals.some((d) => d.sponsorId === s.id && d.editionId === edId);
      const declined = (s: Sponsor) => declines.some((x) => x.sponsorId === s.id && x.editionId === edId);
      list = list.filter((s) =>
        kind === "agr" ? agreed(s) : kind === "decl" ? declined(s) : !agreed(s) && !declined(s),
      );
    }

    /* Responsible team member */
    if (fResponsible === "me") list = list.filter((s) => s.responsibleId === userId);
    else if (fResponsible === "none") list = list.filter((s) => !s.responsibleId);
    else if (fResponsible) list = list.filter((s) => s.responsibleId === fResponsible);

    if (q)
      list = list.filter((s) =>
        [
          s.companyName,
          s.vatNumber,
          responsibleName(s, users),
          formatAddress(s),
          s.postalCode,
          s.city,
          ...sponsorContacts(s).flatMap((c) => [contactName(c), c.email]),
        ].some((f) => (f || "").toLowerCase().includes(q)),
      );

    const dealsOf = (s: Sponsor) => deals.filter((d) => d.sponsorId === s.id);
    const value = (s: Sponsor): string | number => {
      switch (sort.key) {
        case "contact":
          return contactName(primaryContact(s)) || "";
        case "language":
          return [...new Set(sponsorContacts(s).map((c) => c.language || "nl"))].sort().join(",");
        case "responsible":
          return responsibleName(s, users);
        case "city":
          return s.city || "";
        case "editions":
          return dealsOf(s).length;
        case "lifetime":
          return dealsOf(s).reduce((sum, d) => sum + dealTotalCost(d), 0);
        default:
          return s.companyName || "";
      }
    };
    return list.sort((a, b) => {
      const va = value(a),
        vb = value(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "nl", { sensitivity: "base" });
      /* empty values always sink to the bottom, whichever direction */
      if (String(va) === "" && String(vb) !== "") return 1;
      if (String(vb) === "" && String(va) !== "") return -1;
      return cmp * sort.dir;
    });
  }, [sponsors, query, deals, declines, users, sort, fEdition, fResponsible, userId]);

  /* The selection intersected with what the filters actually show. Derived
     rather than pruned on change, so nothing has to watch the filters — and a
     sponsor that scrolls out of view by filter simply stops being actionable
     instead of being deleted unseen. */
  const spSelected = useMemo(
    () => filteredSponsors.filter((s) => spSel.includes(s.id)).map((s) => s.id),
    [filteredSponsors, spSel],
  );
  const allVisibleSelected = filteredSponsors.length > 0 && spSelected.length === filteredSponsors.length;

  /* Export the currently filtered & sorted sponsor list to .xlsx */
  const exportSponsors = () => {
    if (filteredSponsors.length === 0) {
      notify(t("ex.emptymsg"), t("ex.empty"));
      return;
    }
    const rows = filteredSponsors.map((s) => {
      const sDeals = deals.filter((d) => d.sponsorId === s.id);
      const pc = primaryContact(s);
      const vc = voucherContact(s);
      return {
        [t("sp.company")]: s.companyName,
        [t("c.type")]: s.entityType === "legal" ? t("c.legal") : t("c.person"),
        [t("c.vat")]: s.vatNumber || "",
        [t("sf.street")]: s.street || "",
        [t("sf.number")]: s.houseNumber || "",
        [t("sf.postal")]: s.postalCode || "",
        [t("sp.city")]: s.city || "",
        [t("sp.contact")]: contactName(pc) || "",
        [t("c.email")]: pc?.email || "",
        [t("c.phone")]: pc?.phone || "",
        [t("sp.language")]: [...new Set(sponsorContacts(s).map((c) => (c.language || "nl").toUpperCase()))].join(", "),
        [t("vc.receiver")]: vc ? `${contactName(vc) || "?"} <${vc.email}>` : "",
        [t("sp.responsible")]: responsibleName(s, users),
        [t("sp.editions")]: sDeals.length,
        [t("sp.lifetime")]: sDeals.reduce((sum, d) => sum + dealTotalCost(d), 0),
        [t("inv.reference")]: s.refRequired ? t("xl.yes") : "",
        [t("c.contact") + "s"]: sponsorContacts(s).length,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 16 },
      { wch: 20 },
      { wch: 8 },
      { wch: 9 },
      { wch: 16 },
      { wch: 22 },
      { wch: 26 },
      { wch: 16 },
      { wch: 10 },
      { wch: 30 },
      { wch: 18 },
      { wch: 9 },
      { wch: 12 },
      { wch: 10 },
      { wch: 9 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sponsors");
    // filename reflects the active filters so exports don't get confused
    const parts = ["grensrock-sponsors"];
    if (fResponsible === "me") parts.push("mine");
    else if (fResponsible === "none") parts.push("unassigned");
    else if (fResponsible)
      parts.push((userName(users.find((u) => u.id === fResponsible)) || "resp").toLowerCase().replace(/\s+/g, "-"));
    if (fEdition) {
      const [kind, edId] = fEdition.split(":");
      parts.push((editions.find((e) => e.id === edId)?.name || "edition").toLowerCase().replace(/\s+/g, "-"));
      if (kind !== "agr") parts.push(kind === "decl" ? "declined" : "open");
    }
    XLSX.writeFile(wb, parts.join("-") + ".xlsx");
  };

  const openSponsor = sponsors.find((s) => s.id === openSponsorId);

  /* ----- mutations -----
     Every one of these is a targeted call into lib/api: team-side writes are
     plain table calls under the is_team()/is_admin() policies, sponsor-portal
     writes go through the SECURITY DEFINER RPCs. Local React state is updated
     from what the database actually returned, never from an optimistic guess. */
  const saveUser = async (u: UserFormState) => {
    try {
      if (u.id) {
        const saved = await usersApi.updateUser(u.id, u);
        setData((d) => ({ ...d, users: (d.users || []).map((x) => (x.id === saved.id ? saved : x)) }));
      } else {
        /* A new account needs an auth user, which only the server can create.
           Team members on the grensrock.be domain don't need this at all —
           ensure_team_profile() provisions them on their first Google sign-in. */
        const created = await usersApi.inviteUser(u);
        setData((d) => ({ ...d, users: [...(d.users || []), created] }));
      }
      setSaveErr(false);
      setModal(null);
    } catch (e) {
      failWith(e);
    }
  };
  /* ----- access requests (0011) ----- */
  /* An admin granting access also picks the role, so the two decisions that
     arrive together are made together rather than in two round trips. */
  const approveUser = async (id: string, role: Role) => {
    try {
      const saved = await usersApi.approveUser(id, role);
      setData((d) => ({
        ...d,
        users: [...(d.users || []), saved].sort((a, b) => userName(a).localeCompare(userName(b))),
        pendingUsers: (d.pendingUsers || []).filter((x) => x.id !== id),
      }));
      setSaveErr(false);
      /* The grant is already done and stands on its own. A mail that didn't
         go out is worth saying out loud — the person is waiting on it — but
         it is not a reason to pretend the access wasn't given. */
      try {
        await usersApi.notifyAccessGranted(id);
      } catch (mailErr) {
        console.error(mailErr);
        notify(
          t("dlg.usermailfail", { name: userName(saved), error: errText(mailErr) }),
          t("dlg.mailnotsent"),
        );
      }
    } catch (e) {
      failWith(e);
    }
  };

  const declineUser = (id: string) => {
    const u = (data.pendingUsers || []).find((x) => x.id === id);
    ask(
      t("dlg.declineask", { name: userName(u) }),
      async () => {
        try {
          await usersApi.deleteUser(id);
          setData((d) => ({ ...d, pendingUsers: (d.pendingUsers || []).filter((x) => x.id !== id) }));
          setSaveErr(false);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.declinetitle"), confirmLabel: t("dlg.decline") },
    );
  };

  const deleteUser = (id: string) => {
    const u = users.find((x) => x.id === id);
    const admins = users.filter(isAdmin);
    if (isAdmin(u) && admins.length <= 1) {
      notify(t("dlg.lastadmin"), t("dlg.notpossible"));
      return;
    }
    ask(
      t("dlg.removeuserask", { name: userName(u) }),
      async () => {
        try {
          await usersApi.deleteUser(id);
          setData((d) => ({ ...d, users: (d.users || []).filter((x) => x.id !== id) }));
          setSaveErr(false);
          if (id === userId) await signOut();
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.removeusertitle"), confirmLabel: t("dlg.remove") },
    );
  };
  const deleteDeal = (dealId: string) => {
    const d = deals.find((x) => x.id === dealId);
    if (!d) return;
    const linked = vouchers.filter((v) => v.dealId === dealId);
    const issued = linked.filter((v) => v.status === "created" || v.status === "sent");
    const msg = issued.length
      ? t("dlg.deldealissued", { n: issued.length })
      : linked.length
        ? t("dlg.deldealpending", { n: linked.length })
        : t("dlg.deldeal");
    ask(
      msg,
      async () => {
        try {
          /* vouchers.deal_id cascades, so the agreement's voucher rows go with it. */
          await dealsApi.deleteDeal(dealId);
          setData((d) => ({
            ...d,
            deals: d.deals.filter((x) => x.id !== dealId),
            vouchers: (d.vouchers || []).filter((v) => v.dealId !== dealId),
          }));
          setSaveErr(false);
          setModal(null);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.deldealtitle"), confirmLabel: t("dlg.delete") },
    );
  };

  /* ----- sponsor portal writes -----
     Each one says whether it worked. failWith has already told the sponsor
     when it didn't; the answer is for the portal, which keeps a button busy
     until it comes and leaves a form open when it is false. */

  /* Sponsor accepts the agreement: accept_deal() records who, when, and freezes
     the terms server-side from the caller's own contacts row. */
  const acceptAgreement = async (dealId: string): Promise<boolean> => {
    try {
      await dealsApi.portalAcceptDeal(dealId);
      const fresh = await dealsApi.getDeal(dealId);
      if (fresh) setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === dealId ? fresh : x)) }));
      setSaveErr(false);
      return true;
    } catch (e) {
      failWith(e);
      return false;
    }
  };

  /* An admin recording an acceptance the sponsor gave outside the portal (by
     mail, phone, on paper). The RPC checks the role and marks it byTeam, in
     the admin's name, so it never passes for the sponsor's own click. */
  const acceptForSponsor = (d: Deal) =>
    ask(
      t("dlg.teamacceptask", { sponsor: sponsors.find((s) => s.id === d.sponsorId)?.companyName || "" }),
      async () => {
        try {
          await dealsApi.teamAcceptDeal(d.id);
          const fresh = await dealsApi.getDeal(d.id);
          if (fresh) setData((prev) => ({ ...prev, deals: prev.deals.map((x) => (x.id === d.id ? fresh : x)) }));
          setSaveErr(false);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.teamaccepttitle"), confirmLabel: t("dlg.teamaccept"), danger: false },
    );

  /* Sponsor tops up their food & drink value. Allowed until the food vouchers are created.
     Changing the total drops the pending food split + any pending food voucher records so they
     regenerate for the new amount. */
  const updateDealExtra = async (dealId: string, patch: Partial<Deal>): Promise<boolean> => {
    if (vouchers.some((v) => v.dealId === dealId && v.type === "food" && v.status !== "pending")) return false;
    try {
      await dealsApi.portalUpdateFoodDrink(dealId, patch.foodDrinkValue);
      await refreshDealAndVouchers(dealId);
      setSaveErr(false);
      return true;
    } catch (e) {
      failWith(e);
      return false;
    }
  };

  const updateDealSplit = async (
    dealId: string,
    pool: "drink" | "food",
    rows: Deal["drinkVouchers"],
  ): Promise<boolean> => {
    if (vouchers.some((v) => v.dealId === dealId && v.type === pool && v.status !== "pending")) return false;
    try {
      await dealsApi.portalUpdateSplit(dealId, pool, rows);
      await refreshDealAndVouchers(dealId);
      setSaveErr(false);
      return true;
    } catch (e) {
      failWith(e);
      return false;
    }
  };

  /* Both RPCs above drop the deal's pending vouchers for that pool, so the deal
     and the voucher list are re-read together. */
  const refreshDealAndVouchers = async (dealId: string) => {
    const [fresh, voucherRows] = await Promise.all([dealsApi.getDeal(dealId), vouchersApi.listVouchers()]);
    setData((d) => ({
      ...d,
      deals: fresh ? d.deals.map((x) => (x.id === dealId ? fresh : x)) : d.deals,
      vouchers: voucherRows,
    }));
  };

  /* A sponsor picked a formula themselves: request_formula() builds the agreement
     from the formula's own columns, server-side. */
  const requestFormula = async (editionId: string, formulaName: string, byName: string): Promise<boolean> => {
    try {
      const dealId = await dealsApi.portalRequestFormula(editionId, formulaName, byName);
      const fresh = await dealsApi.getDeal(dealId);
      if (fresh)
        setData((d) => ({
          ...d,
          deals: d.deals.some((x) => x.id === fresh.id)
            ? d.deals.map((x) => (x.id === fresh.id ? fresh : x))
            : [...d.deals, fresh],
        }));
      setSaveErr(false);
      return true;
    } catch (e) {
      failWith(e);
      return false;
    }
  };

  /* ----- vouchers ----- */
  const updateVoucher = async (id: string, patch: Partial<Voucher>) => {
    try {
      const saved = await vouchersApi.updateVoucher(id, patch);
      setData((d) => ({ ...d, vouchers: (d.vouchers || []).map((v) => (v.id === id ? saved : v)) }));
      setSaveErr(false);
    } catch (e) {
      failWith(e);
    }
  };

  /* The portal may only ever change a voucher's recipient, and only via the RPC. */
  const assignVoucherRecipient = async (id: string, patch: Partial<Voucher>): Promise<boolean> => {
    try {
      await vouchersApi.portalAssignRecipient(id, patch.recipientName || "", patch.recipientEmail || "");
      setData((d) => ({
        ...d,
        vouchers: (d.vouchers || []).map((v) =>
          v.id === id ? { ...v, recipientName: patch.recipientName || "", recipientEmail: patch.recipientEmail || "" } : v,
        ),
      }));
      setSaveErr(false);
      return true;
    } catch (e) {
      failWith(e);
      return false;
    }
  };

  /* Create voucher records for everything the agreements of an edition entitle to.
     Existing (incl. cancelled) records are kept; only the shortfall is added. */
  const generateVouchers = async (editionId: string) => {
    const edDeals = deals.filter((d) => d.editionId === editionId);
    const added: Array<Partial<Voucher>> = [];
    edDeals.forEach((d) => {
      const wanted = expectedVouchers(d);
      const have = vouchers.filter((v) => v.dealId === d.id && v.status !== "cancelled");
      const countBy = (list: Array<{ type: string; value: number }>, ty: string, val: number) =>
        list.filter((x) => x.type === ty && Number(x.value) === Number(val)).length;
      const seen = new Set<string>();
      wanted.forEach((w) => {
        const key = `${w.type}|${w.value}`;
        if (seen.has(key)) return;
        seen.add(key);
        const need = countBy(wanted, w.type, w.value) - countBy(have, w.type, w.value);
        for (let i = 0; i < need; i++) {
          added.push({
            sponsorId: d.sponsorId,
            editionId,
            dealId: d.id,
            type: w.type,
            value: w.value,
            status: "pending",
            code: "",
            url: "",
            recipientName: "",
            recipientEmail: "",
            createdAt: null,
            sentAt: null,
            cancelledAt: null,
            error: "",
          });
        }
      });
    });
    if (added.length === 0) {
      notify(t("dlg.allgenerated"), t("dlg.nothingtoadd"));
      return;
    }
    try {
      const created = await vouchersApi.createVouchers(added);
      setData((d) => ({ ...d, vouchers: [...(d.vouchers || []), ...created] }));
      setSaveErr(false);
      notify(t("dlg.vouchersadded", { n: created.length }), t("dlg.vouchersgenerated"));
    } catch (e) {
      failWith(e);
    }
  };

  /* Run a Tickoweb action over a selection, one by one so a failure doesn't stop the rest */
  const runVoucherAction = async (action: string, ids: string[]) => {
    if (action === "cancel") {
      ask(t("dlg.cancelvouchersask", { n: ids.length }), () => doVoucherAction(action, ids), {
        title: t("dlg.cancelvoucherstitle"),
        confirmLabel: t("dlg.cancelvoucherstitle"),
      });
      return;
    }
    return doVoucherAction(action, ids);
  };

  const doVoucherAction = async (action: string, ids: string[]) => {
    const cfg: TickowebConfig = data.settings?.tickoweb || defaultTickoweb;
    setVoBusy(true);
    let next = vouchers;
    let failed = false;
    for (const id of ids) {
      const v = next.find((x) => x.id === id);
      if (!v) continue;
      const sponsor = sponsors.find((s) => s.id === v.sponsorId);
      const edition = editions.find((e) => e.id === v.editionId);
      const target = v.recipientEmail
        ? { name: v.recipientName, email: v.recipientEmail }
        : (() => {
            const c = voucherContact(sponsor);
            return c ? { name: contactName(c), email: c.email } : null;
          })();
      try {
        let patch: Partial<Voucher> = {};
        if (action === "createSend") {
          if (v.status === "pending") {
            const r = await tickoweb.create(cfg, { voucher: v, sponsor, edition, recipient: target });
            patch = {
              ...patch,
              code: r.code || v.code,
              url: r.url || v.url,
              createdAt: new Date().toISOString(),
              status: "created",
              error: "",
            };
          }
          const sendable = { ...v, ...patch };
          if (sendable.code || cfg.mode !== "live") {
            await tickoweb.send(cfg, { voucher: sendable, recipient: target });
            patch = { ...patch, status: "sent", sentAt: new Date().toISOString() };
          }
        } else if (action === "resend") {
          await tickoweb.send(cfg, { voucher: v, recipient: target });
          patch = { status: "sent", sentAt: new Date().toISOString(), error: "" };
        } else if (action === "cancel") {
          if (v.code) await tickoweb.cancel(cfg, { voucher: v });
          patch = { status: "cancelled", cancelledAt: new Date().toISOString(), error: "" };
        }
        if (Object.keys(patch).length === 0) continue; // nothing to write for this one
        const saved = await vouchersApi.updateVoucher(id, patch);
        next = next.map((x) => (x.id === id ? saved : x));
      } catch (ex) {
        /* One voucher failing must not stop the rest — record why on the row itself. */
        const errPatch: Partial<Voucher> = {
          status: "error" as VoucherStatus,
          error: String((ex as Error).message || ex),
        };
        try {
          const saved = await vouchersApi.updateVoucher(id, errPatch);
          next = next.map((x) => (x.id === id ? saved : x));
        } catch (writeEx) {
          console.error(writeEx);
          failed = true;
          next = next.map((x) => (x.id === id ? { ...x, ...errPatch } : x));
        }
      }
    }
    setData((d) => ({ ...d, vouchers: next }));
    setSaveErr(failed);
    setVoSel([]);
    setVoBusy(false);
  };

  /* Find a possible duplicate sponsor by VAT (strong) or name (soft) */
  const findDuplicateSponsor = (s: Sponsor) => {
    const vk = normVatKey(s.vatNumber);
    const nk = normNameKey(s.companyName);
    const others = sponsors.filter((x) => x.id !== s.id);
    const byVat = vk ? others.find((x) => normVatKey(x.vatNumber) === vk) : null;
    if (byVat) return { sponsor: byVat, on: "vat" };
    const byName = nk ? others.find((x) => normNameKey(x.companyName) === nk) : null;
    if (byName) return { sponsor: byName, on: "name" };
    return null;
  };

  const saveSponsor = (s: Sponsor) => {
    const commit = async () => {
      try {
        if (s.id) {
          // the edit modal no longer handles contacts — keep the stored ones
          const saved = await sponsorsApi.updateSponsor(s.id, s);
          setData((d) => ({
            ...d,
            sponsors: d.sponsors.map((x) => (x.id === s.id ? { ...saved, contacts: sponsorContacts(x) } : x)),
          }));
        } else {
          const created = await sponsorsApi.createSponsor(s);
          const contacts = s.contacts || [];
          const savedContacts = contacts.length
            ? await contactsApi.createContacts(contacts.map((c) => ({ sponsorId: created.id, contact: c })))
            : [];
          setData((d) => ({
            ...d,
            sponsors: [
              ...d.sponsors,
              { ...created, contacts: savedContacts.map(({ sponsorId: _s, ...c }) => c as Contact) },
            ],
          }));
        }
        setSaveErr(false);
        setModal(null);
      } catch (e) {
        failWith(e);
      }
    };
    // Only check on creation (editing an existing sponsor shouldn't warn about itself)
    if (!s.id) {
      const dup = findDuplicateSponsor(s);
      if (dup) {
        const which = dup.on === "vat" ? `${t("dup.samevat")} ${dup.sponsor.vatNumber}` : t("dup.samename");
        ask(`${dup.sponsor.companyName}: ${which} ${t("dup.addanyway")}`, commit, {
          title: t("dup.title"),
          confirmLabel: t("dup.add"),
          danger: false,
        });
        return;
      }
    }
    commit();
  };
  /* Switching portal access on is what sends a contact their set-password
     link, so the two are one action from the team's point of view. Resending
     uses the same route — a new link, the previous one dead. */
  const sendPortalLink = async (contact: Contact): Promise<boolean> => {
    try {
      /* Deliberately silent on success. Sending the link is a consequence of
         granting access, not a separate thing the team asked for, and a dialog
         per contact turns activating a handful of people into a clicking
         exercise. Failure still speaks up — that one needs acting on. */
      await contactsApi.sendPortalLink(contact.id);
      return true;
    } catch (e) {
      /* The access itself is already saved; only the email failed. Saying so
         beats rolling back a permission the team meant to grant. */
      notify(
        t("dlg.contactmailfail", {
          name: contactName(contact) || contact.email,
          error: errText(e),
        }),
        t("dlg.mailnotsent"),
      );
      return false;
    }
  };

  /* Resending IS something the team asked for, and it mails a sponsor and
     voids the link they already had — so it is confirmed first, and says
     afterwards that it went. */
  const resendPortalLink = (contact: Contact) => {
    const name = contactName(contact) || contact.email;
    ask(
      t("dlg.resendlinkask", { name, email: contact.email }),
      async () => {
        if (await sendPortalLink(contact)) notify(t("dlg.resendlinkdone", { email: contact.email }));
      },
      { title: t("dlg.resendlinktitle"), confirmLabel: t("dlg.resendlink"), danger: false },
    );
  };

  const saveContact = async (
    sponsorId: string,
    contact: Contact,
    { onDuplicate }: { onDuplicate?: (clash: Contact) => void } = {},
  ) => {
    const sponsor = sponsors.find((s) => s.id === sponsorId);
    if (sponsor && contact.email) {
      const clash = sponsorContacts(sponsor).find(
        (c) => c.id !== contact.id && c.email && sameEmail(c.email, contact.email),
      );
      if (clash) {
        if (onDuplicate) {
          onDuplicate(clash);
          return false;
        }
        ask(
          `${sponsor.companyName} ${t("nc.dupehas")} ${contact.email} (${contactName(clash) || "?"}). ${t("dup.addanyway")}`,
          async () => {
            await commitContact(sponsorId, contact);
            setModal(null);
          },
          { title: t("dup.title"), confirmLabel: t("dup.add"), danger: false },
        );
        return false;
      }
    }
    await commitContact(sponsorId, contact);
    setModal(null);
    return true;
  };
  /* Returns the saved contact (with the id the database assigned) so a caller
     that has to keep working with it — EmailModal adding a recipient mid-send —
     doesn't have to go looking for it in state. null means the save failed. */
  const commitContact = async (sponsorId: string, contact: Contact): Promise<Contact | null> => {
    try {
      const sponsor = sponsors.find((s) => s.id === sponsorId);
      const known = sponsorContacts(sponsor).some((c) => c.id === contact.id);
      /* Was portal access off before this save? Only the transition sends a
         link — re-saving a contact who already has access shouldn't mail them
         a fresh one every time their phone number is corrected. */
      const hadAccess = !!sponsorContacts(sponsor).find((c) => c.id === contact.id)?.portalAccess;
      /* A contact that isn't in the sponsor's list yet only has a form-generated
         id, so it is an insert — the database assigns the real uuid. */
      const saved = known
        ? await contactsApi.updateContact(contact.id, contact)
        : await contactsApi.createContact(sponsorId, contact);
      const { sponsorId: _s, ...clean } = saved;
      setData((d) => ({
        ...d,
        sponsors: d.sponsors.map((s) => {
          if (s.id !== sponsorId) return s;
          const list = sponsorContacts(s);
          return {
            ...s,
            contacts: known
              ? list.map((c) => (c.id === contact.id ? (clean as Contact) : c))
              : [...list, clean as Contact],
          };
        }),
      }));
      setSaveErr(false);
      /* After the row exists, so the id in the email's link is the real one. */
      if (saved.portalAccess && !hadAccess && saved.email) {
        await sendPortalLink(clean as Contact);
      }
      return clean as Contact;
    } catch (e) {
      failWith(e);
      return null;
    }
  };
  const importContacts = async (list: ContactImportRow[]) => {
    try {
      const created = await contactsApi.createContacts(
        list.map((x) => ({ sponsorId: x.sponsorId, contact: x.contact })),
      );
      setData((d) => ({
        ...d,
        sponsors: d.sponsors.map((s) => {
          const mine = created.filter((c) => c.sponsorId === s.id).map(({ sponsorId: _s, ...c }) => c as Contact);
          return mine.length ? { ...s, contacts: [...sponsorContacts(s), ...mine] } : s;
        }),
      }));
      setSaveErr(false);
    } catch (e) {
      failWith(e);
    }
  };
  const deleteContact = (sponsorId: string, contactId: string) =>
    ask(
      t("dlg.delcontactask"),
      async () => {
        try {
          await contactsApi.deleteContact(contactId);
          setData((d) => ({
            ...d,
            sponsors: d.sponsors.map((s) =>
              s.id === sponsorId ? { ...s, contacts: sponsorContacts(s).filter((c) => c.id !== contactId) } : s,
            ),
          }));
          setSaveErr(false);
          setModal(null);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.delcontacttitle"), confirmLabel: t("dlg.remove") },
    );

  /* Logos are written by LogoManager itself; this only keeps the app's copy
     in step so the folder overview and the other tabs see the change. */
  const applyLogos = (sponsorId: string, next: SponsorLogo[]) =>
    setData((d) => ({
      ...d,
      logos: [...(d.logos || []).filter((l) => l.sponsorId !== sponsorId), ...next],
    }));

  /* ----- bulk actions on the contact overview ----- */
  type ContactRow = { contact: Contact; sponsor: Sponsor };

  const grantPortalAccess = async (items: ContactRow[]) => {
    /* Already-active contacts are skipped rather than re-sent: this is "give
       these people access", not "mail everyone again". Use Resend link for that. */
    const todo = items.filter((x) => !x.contact.portalAccess && x.contact.email);
    const noEmail = items.filter((x) => !x.contact.email).length;
    if (todo.length === 0) {
      notify(
        noEmail > 0 ? t("dlg.grantnoemail", { n: noEmail }) : t("dlg.grantalready"),
        t("dlg.grantnothing"),
      );
      return;
    }
    setCoBusy("grant");
    for (const x of todo) await commitContact(x.sponsor.id, { ...x.contact, portalAccess: true });
    setCoBusy("");
    setCoSel([]);
    notify(
      t("dlg.granted", { n: todo.length }) + (noEmail > 0 ? t("dlg.grantskipped", { n: noEmail }) : ""),
      t("dlg.granttitle"),
    );
  };

  const deleteContacts = (items: ContactRow[]) => {
    if (items.length === 0) return;
    const withAccess = items.filter((x) => x.contact.portalAccess).length;
    const names =
      items.length <= 8
        ? items.map((x) => `  • ${contactName(x.contact) || x.contact.email || "?"} (${x.sponsor.companyName})`).join("\n")
        : items
            .slice(0, 8)
            .map((x) => `  • ${contactName(x.contact) || x.contact.email || "?"} (${x.sponsor.companyName})`)
            .join("\n") + t("dlg.andmore", { n: items.length - 8 });

    ask(
      `${t("dlg.delcontactsask", { n: items.length })}\n\n${names}\n\n` +
        (withAccess > 0
          ? t("dlg.delcontactsaccess", { n: withAccess })
          : t("dlg.delcontactsnoaccess")),
      async () => {
        setCoBusy("delete");
        const gone: string[] = [];
        const failed: string[] = [];
        for (const x of items) {
          try {
            await contactsApi.deleteContact(x.contact.id);
            gone.push(x.contact.id);
          } catch (e) {
            failed.push(`${contactName(x.contact) || x.contact.email} — ${errText(e)}`);
          }
        }
        setData((d) => ({
          ...d,
          sponsors: d.sponsors.map((s) => ({
            ...s,
            contacts: sponsorContacts(s).filter((c) => !gone.includes(c.id)),
          })),
        }));
        setCoSel((prev) => prev.filter((id) => !gone.includes(id)));
        setCoBusy("");
        if (failed.length) {
          failWith(
            new Error(
              t("dlg.removefailed", { done: gone.length, failed: failed.length, list: failed.join("\n") }),
            ),
            t("dlg.removefailedtitle"),
          );
        } else {
          setSaveErr(false);
        }
      },
      { title: t("dlg.delcontactstitle", { n: items.length }), confirmLabel: t("dlg.remove") },
    );
  };

  /* The sponsor portal's own save button. Never a table write: the company
     details go through update_sponsor_info(), each contact through
     upsert_sponsor_contact()/delete_sponsor_contact() — all three re-derive
     the caller's sponsor server-side. */
  const portalSaveSponsor = async (id: string, patch: Partial<Sponsor>): Promise<boolean> => {
    try {
      const { contacts, ...info } = patch;
      if (Object.keys(info).length) await sponsorsApi.portalUpdateSponsorInfo(info);

      if (contacts) {
        const before = sponsorContacts(sponsors.find((s) => s.id === id));
        /* Collected while saving, sent after: a sponsor giving a colleague
           portal access is the same act as the team doing it, so it has to
           send the same link.
           Whether access was granted is the RPC's answer, not ours (0013).
           Comparing against `before` was wrong: it is client state, and the
           portal's copy is stale by the time a second save happens, so the
           comparison concluded "nothing changed" and sent nothing. */
        const toInvite: Contact[] = [];
        for (const c of contacts) {
          const was = before.find((x) => x.id === c.id);
          if (!was || JSON.stringify(was) !== JSON.stringify(c)) {
            const { id: savedId, granted } = await contactsApi.portalUpsertContact(c);
            /* savedId is the database's uuid — a contact added in the portal
               still carries a form-generated id the link must not be built on. */
            if (granted && c.email) toInvite.push({ ...c, id: savedId });
          }
        }
        for (const gone of before.filter((x) => !contacts.some((c) => c.id === x.id))) {
          await contactsApi.portalDeleteContact(gone.id);
        }
        /* Not sendPortalLink: its message is the team's, in a team language,
           about a button the portal doesn't have. The access stands either
           way, so this is a notice and the save still counts as done. */
        for (const c of toInvite) {
          try {
            await contactsApi.sendPortalLink(c.id);
          } catch (mailErr) {
            console.error(mailErr);
            setDialog({
              messageKey: "dlg.portalmailfail",
              messageParams: { name: contactName(c) || c.email },
              titleKey: "dlg.portalmailnotsent",
            });
          }
        }
      }

      const [fresh, freshContacts] = await Promise.all([sponsorsApi.getSponsor(id), contactsApi.listContacts()]);
      setData((d) => ({
        ...d,
        sponsors: d.sponsors.map((s) =>
          s.id === id
            ? {
                ...(fresh || s),
                contacts: freshContacts.filter((c) => c.sponsorId === id).map(({ sponsorId: _s, ...c }) => c as Contact),
              }
            : s,
        ),
      }));
      setSaveErr(false);
      return true;
    } catch (e) {
      failWith(e);
      return false;
    }
  };
  const addSponsorInline = async (s: Sponsor): Promise<Sponsor> => {
    const created = await sponsorsApi.createSponsor({ ...emptySponsor, ...s });
    setData((d) => ({ ...d, sponsors: [...d.sponsors, created] }));
    setSaveErr(false);
    return created;
  };
  const importSponsors = async (list: SponsorImportRow[]) => {
    try {
      const payload = list.map(
        ({ vatInvalid: _v, mailInvalid: _m, contactPreview: _c, emailPreview: _e, langPreview: _l, ...s }) =>
          ({ ...emptySponsor, ...s }) as Sponsor,
      );
      const created = await sponsorsApi.createSponsors(payload);
      setData((d) => ({ ...d, sponsors: [...d.sponsors, ...created] }));
      setSaveErr(false);
    } catch (e) {
      failWith(e);
    }
  };
  const deleteSponsor = (id: string) => {
    ask(
      t("dlg.delsponsorask"),
      async () => {
        try {
          /* contacts, deals and vouchers cascade with the sponsor row. */
          await sponsorsApi.deleteSponsor(id);
          removeAllLogoFiles(id).catch(() => {
            /* nothing stored */
          });
          setData((d) => ({
            ...d,
            sponsors: d.sponsors.filter((s) => s.id !== id),
            deals: d.deals.filter((x) => x.sponsorId !== id),
            vouchers: (d.vouchers || []).filter((v) => v.sponsorId !== id),
          }));
          setSaveErr(false);
          setOpenSponsorId(null);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.delsponsortitle"), confirmLabel: t("dlg.delete") },
    );
  };
  /* Bulk delete. Acts only on rows the filters currently show — see where
     spSelected is derived — so a selection made before a filter change can
     never take something off-screen with it. */
  const deleteSponsors = (ids: string[]) => {
    if (ids.length === 0) return;
    const chosen = sponsors.filter((s) => ids.includes(s.id));
    const dealCount = deals.filter((d) => ids.includes(d.sponsorId)).length;
    const voucherCount = vouchers.filter((v) => ids.includes(v.sponsorId)).length;
    const contactCount = chosen.reduce((n, s) => n + sponsorContacts(s).length, 0);

    /* Named rather than counted up to a point: "delete 3 sponsors" is easy to
       agree to when you have lost track of which 3 are selected. */
    const names =
      chosen.length <= 8
        ? chosen.map((s) => `  • ${s.companyName}`).join("\n")
        : chosen
            .slice(0, 8)
            .map((s) => `  • ${s.companyName}`)
            .join("\n") + t("dlg.andmore", { n: chosen.length - 8 });

    const alsoGoes = [
      contactCount && t("dlg.ncontacts", { n: contactCount }),
      dealCount && t("dlg.ndeals", { n: dealCount }),
      voucherCount && t("dlg.nvouchers", { n: voucherCount }),
    ]
      .filter(Boolean)
      .join(", ");

    ask(
      `${t("dlg.delsponsorsask", { n: chosen.length })}\n\n${names}\n\n` +
        (alsoGoes ? t("dlg.delsponsorsalso", { what: alsoGoes }) : t("dlg.undone")),
      async () => {
        setSpBusy(true);
        const failed: string[] = [];
        const gone: string[] = [];
        for (const s of chosen) {
          try {
            await sponsorsApi.deleteSponsor(s.id);
            gone.push(s.id);
            removeAllLogoFiles(s.id).catch(() => {
              /* nothing stored */
            });
          } catch (e) {
            failed.push(`${s.companyName} — ${errText(e)}`);
          }
        }
        /* Whatever succeeded is dropped from view even when some failed, so the
           screen matches the database rather than the intent. */
        setData((d) => ({
          ...d,
          sponsors: d.sponsors.filter((s) => !gone.includes(s.id)),
          deals: d.deals.filter((x) => !gone.includes(x.sponsorId)),
          vouchers: (d.vouchers || []).filter((v) => !gone.includes(v.sponsorId)),
        }));
        setSpSel((prev) => prev.filter((id) => !gone.includes(id)));
        setSpBusy(false);
        if (failed.length) {
          failWith(
            new Error(
              t("dlg.deletefailed", { done: gone.length, failed: failed.length, list: failed.join("\n") }),
            ),
            t("dlg.deletefailedtitle"),
          );
        } else {
          setSaveErr(false);
        }
      },
      { title: t("dlg.delsponsorstitle", { n: chosen.length }), confirmLabel: t("dlg.delete") },
    );
  };

  const saveEdition = async (ed: Edition) => {
    try {
      if (ed.id) {
        const saved = await editionsApi.updateEdition(ed.id, ed);
        setData((d) => ({
          ...d,
          editions: d.editions.map((x) => (x.id === ed.id ? { ...saved, formulas: x.formulas || [] } : x)),
        }));
      } else {
        const created = await editionsApi.createEdition(ed);
        setData((d) => ({ ...d, editions: [...d.editions, created] }));
      }
      setSaveErr(false);
      setModal(null);
    } catch (e) {
      failWith(e);
    }
  };
  const toggleEdition = async (id: string) => {
    const current = editions.find((e) => e.id === id);
    try {
      const saved = await editionsApi.updateEdition(id, { active: !current?.active });
      setData((d) => ({
        ...d,
        editions: d.editions.map((e) => (e.id === id ? { ...saved, formulas: e.formulas || [] } : e)),
      }));
      setSaveErr(false);
    } catch (e) {
      failWith(e);
    }
  };
  const deleteEdition = (id: string) => {
    const n = deals.filter((d) => d.editionId === id).length;
    ask(
      n ? t("dlg.deleditionask", { n }) : t("dlg.deleditionplain"),
      async () => {
        try {
          /* formulas, deals and vouchers cascade with the edition row. */
          await editionsApi.deleteEdition(id);
          setData((d) => ({
            ...d,
            editions: d.editions.filter((e) => e.id !== id),
            deals: d.deals.filter((x) => x.editionId !== id),
            vouchers: (d.vouchers || []).filter((v) => v.editionId !== id),
          }));
          setSaveErr(false);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.deleditiontitle"), confirmLabel: t("dlg.delete") },
    );
  };
  const saveFormula = async (editionId: string, f: Formula, originalName?: string) => {
    try {
      const saved = originalName
        ? await formulasApi.updateFormula(editionId, originalName, f)
        : await formulasApi.createFormula(editionId, f);
      const { editionId: _e, ...clean } = saved;
      setData((d) => ({
        ...d,
        editions: d.editions.map((e) => {
          if (e.id !== editionId) return e;
          const fs = e.formulas || [];
          return {
            ...e,
            formulas: originalName
              ? fs.map((x) => (x.name === originalName ? (clean as Formula) : x))
              : [...fs, clean as Formula],
          };
        }),
      }));
      setSaveErr(false);
      setModal(null);
    } catch (e) {
      failWith(e);
    }
  };
  const deleteFormula = (editionId: string, name: string) =>
    ask(
      t("dlg.delformulaask", { name }),
      async () => {
        try {
          await formulasApi.deleteFormula(editionId, name);
          setData((d) => ({
            ...d,
            editions: d.editions.map((e) =>
              e.id === editionId ? { ...e, formulas: (e.formulas || []).filter((f) => f.name !== name) } : e,
            ),
          }));
          setSaveErr(false);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.delformulatitle"), confirmLabel: t("dlg.delete") },
    );
  const saveDeal = async (d: DealFormState) => {
    try {
      if (d.id) {
        const current = deals.find((x) => x.id === d.id);
        const saved = await dealsApi.updateDeal(d.id, {
          ...d,
          confirmedAt: current?.requestedAt && !current?.confirmedAt ? new Date().toISOString() : current?.confirmedAt,
        });
        setData((prev) => ({ ...prev, deals: prev.deals.map((x) => (x.id === saved.id ? saved : x)) }));
        setSaveErr(false);
        setModal(null);
      } else {
        const created = await dealsApi.createDeal({ ...d, responsible: d.responsible || userName(me) || "" });
        /* The database drops a decline for this sponsor and edition (0022); mirror it. */
        setData((prev) => ({
          ...prev,
          deals: [...prev.deals, created],
          declines: (prev.declines || []).filter(
            (x) => !(x.sponsorId === created.sponsorId && x.editionId === created.editionId),
          ),
        }));
        setSaveErr(false);
        // Offer the email right after creating a new agreement
        setModal({ type: "email", payload: created });
      }
    } catch (e) {
      /* DealForm already refuses a second agreement for the same sponsor and
         edition; this is the one it couldn't see — added meanwhile by someone
         else — and Postgres's own wording for it means nothing to the reader. */
      if (/duplicate key/i.test(String((e as Error)?.message))) {
        failWith(
          new Error(
            t("df.clash", {
              sponsor: sponsors.find((x) => x.id === d.sponsorId)?.companyName || "",
              edition: editions.find((x) => x.id === d.editionId)?.name || "",
            }),
          ),
        );
      } else failWith(e);
    }
  };
  const saveDecline = async (sponsorId: string, editionId: string, reason: string) => {
    try {
      const created = await declinesApi.createDecline({ sponsorId, editionId, reason, recordedBy: userName(me) || "" });
      setData((prev) => ({ ...prev, declines: [...(prev.declines || []), created] }));
      setSaveErr(false);
      setModal(null);
    } catch (e) {
      failWith(e);
    }
  };
  const withdrawDecline = (id: string) => {
    const x = declines.find((d) => d.id === id);
    ask(
      t("dlg.withdrawdecline", { edition: editions.find((e) => e.id === x?.editionId)?.name || "" }),
      async () => {
        try {
          await declinesApi.deleteDecline(id);
          setData((prev) => ({ ...prev, declines: (prev.declines || []).filter((d) => d.id !== id) }));
          setSaveErr(false);
        } catch (e) {
          failWith(e);
        }
      },
      { title: t("dlg.withdrawdeclinetitle"), confirmLabel: t("dlg.withdraw") },
    );
  };
  const markEmailSent = async (dealId: string) => {
    try {
      const saved = await dealsApi.updateDeal(dealId, { emailSentAt: new Date().toISOString() });
      setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === dealId ? saved : x)) }));
      setSaveErr(false);
      setModal(null);
    } catch (e) {
      failWith(e);
    }
  };
  /* The send route marks the agreement itself, inside the same request that
     sent the mail — so this only brings the screen into line with what the
     server already recorded. Re-saving it here would be a pointless second
     write, and one that could fail after the mail had gone. */
  const noteEmailSent = (dealId: string, sentAt: string) =>
    setData((d) => ({
      ...d,
      deals: d.deals.map((x) => (x.id === dealId ? { ...x, emailSentAt: sentAt } : x)),
    }));
  const setInvoice = async (dealId: string, patch: Partial<Deal>) => {
    const current = deals.find((d) => d.id === dealId);
    if (!current) return;
    const next = { ...current, ...patch };
    // Never allow "invoice created" while a required reference is still missing
    if (refMissing(next, sponsors.find((x) => x.id === next.sponsorId))) patch = { ...patch, invoiceCreated: false };
    try {
      const saved = await dealsApi.updateDeal(dealId, patch);
      setData((d) => ({ ...d, deals: d.deals.map((x) => (x.id === dealId ? saved : x)) }));
      setSaveErr(false);
    } catch (e) {
      failWith(e);
    }
  };

  /* Integration settings (admin only). The Tickoweb API key is not stored here —
     secrets live in integration_secrets, which no browser session can reach. */
  const saveSettings = async (patch: Settings) => {
    try {
      const saved = await settingsApi.updateSettings({ ...(data.settings || {}), ...patch });
      setData((d) => ({ ...d, settings: saved }));
      setSaveErr(false);
      setModal(null);
    } catch (e) {
      failWith(e);
    }
  };

  /* ----- overview stats ----- */
  const pendingRequests = deals.filter((d) => d.requestedAt && !d.confirmedAt);
  const awaitingAcceptance = deals.filter((d) => !isAccepted(d) && editions.find((e) => e.id === d.editionId)?.active);
  const overviewEdition = activeEditions[0] || sortedEditions[0];
  const ovDeals = overviewEdition ? deals.filter((d) => d.editionId === overviewEdition.id) : [];
  const ovTotal = ovDeals.reduce((s, d) => s + dealTotalCost(d), 0);
  const ovCash = ovDeals.reduce((s, d) => s + invoiceAmount(d), 0);
  const ovKind = ovTotal - ovCash;
  const ovBillable = ovDeals.filter(needsInvoice);
  const ovInvoiced = ovBillable.filter((d) => d.invoiceCreated).length;

  if (!loaded)
    return (
      <div className="gr-root">
        <p className="gr-loading">Loading…</p>
      </div>
    );

  /* ----- access modes ----- */
  if (mode.view === "landing") {
    return (
      <div className="gr-root">
        <Landing onSignedIn={enterSession} authError={authError} />
      </div>
    );
  }
  if (mode.view === "pending") {
    return (
      <div className="gr-root">
        <PendingAccess me={mode.profile} onExit={signOut} />
      </div>
    );
  }
  if (mode.view === "portal") {
    const ps = sponsors.find((s) => s.id === mode.sponsorId);
    if (!ps) {
      return (
        <div className="gr-root">
          <div className="gr-landing">
            <p style={{ color: "#fff" }}>{t("po.unavail")}</p>
            <button className="gr-btn-ghost" onClick={signOut}>
              {t("po.backstart")}
            </button>
          </div>
        </div>
      );
    }
    const asContact = sponsorContacts(ps).find((c) => c.id === mode.contactId);
    /* The same rule SponsorPortal uses for its own text. The dialog is
       passed in rather than living in the portal because failWith, here, is
       what opens it; without it a failed save said nothing to a sponsor. */
    const portalLang: Language = asContact?.language || primaryContact(ps)?.language || "nl";
    return (
      <SponsorPortal
        sponsor={ps}
        asContact={asContact}
        deals={deals}
        editions={editions}
        vouchers={vouchers}
        vatCfg={data.settings?.vatLookup || defaultVatLookup}
        logos={(data.logos || []).filter((l) => l.sponsorId === ps.id)}
        onLogosChange={(next) => applyLogos(ps.id, next)}
        onSaveSponsor={portalSaveSponsor}
        onAssignVoucher={assignVoucherRecipient}
        onRequestFormula={requestFormula}
        onUpdateSplit={updateDealSplit}
        onUpdateExtra={updateDealExtra}
        onAcceptAgreement={acceptAgreement}
        onExit={signOut}
      >
        <ConfirmDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          t={(key, params) => portalDialogT(key, portalLang, params)}
          lang={portalLang}
        />
      </SponsorPortal>
    );
  }

  /* Team member looking at a sponsor's portal. The write handlers are no-ops
     rather than the real ones: the screen is already inert, and a preview that
     silently does nothing is a far better failure than one that writes to a
     sponsor's record if that lock ever comes off. */
  if (previewPortal) {
    const ps = sponsors.find((s) => s.id === previewPortal.sponsorId);
    if (ps) {
      const noop = async () => false;
      return (
        <SponsorPortal
          preview
          sponsor={ps}
          asContact={sponsorContacts(ps).find((c) => c.id === previewPortal.contactId)}
          deals={deals}
          editions={editions}
          vouchers={vouchers}
          vatCfg={data.settings?.vatLookup || defaultVatLookup}
          logos={(data.logos || []).filter((l) => l.sponsorId === ps.id)}
          onSaveSponsor={noop}
          onAssignVoucher={noop}
          onRequestFormula={noop}
          onUpdateSplit={noop}
          onUpdateExtra={noop}
          onAcceptAgreement={noop}
          onExit={() => setPreviewPortal(null)}
        />
      );
    }
  }

  const invEd = editions.find((e) => e.id === (invEdition || overviewEdition?.id));
  const invDeals = invEd ? deals.filter((d) => d.editionId === invEd.id) : [];

  return (
    <div className="gr-root">
      <header className="gr-header">
        <div className="gr-brand">
          <PickLogo size={34} />
          <span className="gr-brandsub">{t("hd.subtitle")}</span>
        </div>
        {(() => {
          const destinations = [
            ["overview", t("nav.overview")],
            ["sponsors", t("nav.sponsors")],
            ["agreements", t("nav.agreements")],
            ["contacts", t("nav.contacts")],
            /* Issuing and sending vouchers is admin work, like invoicing. */
            ...(admin ? ([["vouchers", t("nav.vouchers")]] as Array<[string, string]>) : []),
            ["analytics", t("nav.analytics")],
            ...(admin
              ? ([
                  ["folder", t("nav.folder")],
                  ["invoicing", t("nav.invoicing")],
                  ["admin", t("nav.admin")],
                ] as Array<[string, string]>)
              : []),
            ["faq", t("nav.faq")],
          ] as Array<[string, string]>;
          /* Naming the current screen on the button means the collapsed menu
             still answers "where am I?" without being opened. */
          const here =
            destinations.find(([k]) => k === tab || (k === "admin" && ADMIN_TABS.includes(tab)))?.[1] || "";
          return (
            <>
              <button
                className="gr-navtoggle"
                aria-expanded={navOpen}
                aria-controls="gr-mainnav"
                onClick={() => setNavOpen((o) => !o)}
              >
                <span aria-hidden="true">☰</span>
                <span className="gr-navtoggle-label">{here || t("nav.menu")}</span>
              </button>
              <nav id="gr-mainnav" className={"gr-nav" + (navOpen ? " open" : "")}>
                {destinations.map(([k, l]) => (
                  <button
                    key={k}
                    className={tab === k || (k === "admin" && ADMIN_TABS.includes(tab)) ? "on" : ""}
                    onClick={() => {
                      setTab(k === "admin" ? adminSub : k);
                      setOpenSponsorId(null);
                      setNavOpen(false);
                    }}
                  >
                    {l}
                  </button>
                ))}
                <select
                  className="gr-langswitch"
                  value={uiLang}
                  onChange={(e) => setLangOverride(e.target.value as TeamLanguage)}
                  title={t("tt.uilanguage")}
                >
                  {Object.entries(TEAM_LANGS).map(([k]) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="gr-whoami">
                  {me ? (
                    <>
                      {userName(me)} <Tag tone={admin ? "green" : "grey"}>{admin ? "admin" : "user"}</Tag>
                    </>
                  ) : (
                    "setup"
                  )}
                </span>
                {realAdmin && !previewUser && (
                  <button
                    onClick={() => {
                      setPreviewUser(true);
                      setNavOpen(false);
                    }}
                    title={t("vu.starthint")}
                  >
                    {t("vu.start")}
                  </button>
                )}
                <button onClick={signOut} title={t("common.logout")}>
                  {t("common.logout")}
                </button>
              </nav>
            </>
          );
        })()}
      </header>
      <div className="gr-borderline" aria-hidden="true" />
      {/* Sticky, and the only way back: an admin who forgets they are in here
          would read the missing Admin tab as the app having broken. */}
      {previewUser && (
        <div className="gr-previewbar" role="status">
          <strong>{t("vu.banner")}</strong>
          <span className="gr-previewbar-note">{t("vu.note")}</span>
          <button className="gr-mini" onClick={() => setPreviewUser(false)}>
            {t("vu.stop")}
          </button>
        </div>
      )}
      {saveErr && <div className="gr-warn">{t("hd.saveerr")}</div>}
      <main className="gr-main">
        {/* Admin panel sub-navigation */}
        {admin && ADMIN_TABS.includes(tab) && (
          <div className="gr-subnav">
            {(
              [
                ["editions", t("nav.editions")],
                ["team", t("nav.team")],
                ["audit", t("nav.audit")],
              ] as Array<[string, string]>
            ).map(([k, l]) => (
              <button
                key={k}
                className={tab === k ? "on" : ""}
                onClick={() => {
                  setTab(k);
                  setAdminSub(k);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {/* ---------- OVERVIEW ---------- */}
        {tab === "overview" && (
          <section>
            {editions.length === 0 && sponsors.length === 0 ? (
              <div className="gr-onboard">
                <h2 className="gr-h2">{t("on.welcome")}</h2>
                <p>{t("ov.setupsteps")}</p>
                <ol>
                  <li>
                    <strong>{t("ov.createedition")}</strong> {t("ov.step1rest")}
                  </li>
                  <li>
                    <strong>{t("ov.addsponsors")}</strong> {t("ov.step2rest")}
                  </li>
                  <li>
                    <strong>{t("ov.regagreements")}</strong> {t("ov.step3rest")}
                  </li>
                </ol>
                <div className="gr-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="gr-btn" onClick={() => setModal({ type: "edition" })}>
                    {t("on.first")}
                  </button>
                  <button className="gr-btn-ghost" onClick={() => setModal({ type: "sponsor" })}>
                    {t("ov.addsponsor")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="gr-h2">{overviewEdition ? overviewEdition.name : t("ov.noedition")}</h2>
                {overviewEdition && (
                  <p className="gr-muted">
                    {overviewEdition.startDate}
                    {overviewEdition.endDate ? " – " + overviewEdition.endDate : ""}
                    {overviewEdition.location && " · " + overviewEdition.location}
                    {" · "}
                    {overviewEdition.active ? <Tag tone="green">{t("ov.active")}</Tag> : <Tag>{t("ov.inactive")}</Tag>}
                  </p>
                )}
                {awaitingAcceptance.length > 0 && (
                  <div className="gr-setupbar" style={{ background: "#E7F0F7", color: "var(--blue-deep)" }}>
                    {awaitingAcceptance.length}{" "}
                    {awaitingAcceptance.length > 1 ? t("ov.agrsnotaccepted") : t("ov.agrnotaccepted")}
                    <button
                      className="gr-mini"
                      onClick={() => {
                        setTab("agreements");
                        setAgQuery("");
                        setAgEdition("");
                        setAgResponsible("");
                        setAgSettle("");
                        setAgStatus("toaccept");
                      }}
                    >
                      {t("ov.view")}
                    </button>
                  </div>
                )}
                {pendingRequests.length > 0 && (
                  <div className="gr-setupbar">
                    {pendingRequests.length} {pendingRequests.length > 1 ? t("ov.reqsmade") : t("ov.reqmade")}
                    <button
                      className="gr-mini"
                      onClick={() => {
                        setTab("sponsors");
                        setOpenSponsorId(pendingRequests[0].sponsorId);
                      }}
                    >
                      {t("ov.review")}
                    </button>
                  </div>
                )}
                <div className="gr-statrow">
                  <div className="gr-stat">
                    <span>{ovDeals.length}</span>
                    {t("ov.sponsorsedition")}
                  </div>
                  <div className="gr-stat">
                    <span>{eur(ovTotal)}</span>
                    {t("ov.totalvalue")}
                  </div>
                  <div className="gr-stat">
                    <span>{eur(ovCash)}</span>
                    {t("ov.toinvoice")}
                    {ovKind > 0 ? ` · ${eur(ovKind)} ${t("sd.inkind")}` : ""}
                  </div>
                  <div className="gr-stat">
                    <span>
                      {ovInvoiced} / {ovBillable.length}
                    </span>
                    {t("ov.invoiced")}
                  </div>
                </div>
                <div className="gr-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="gr-btn" onClick={() => setModal({ type: "deal" })}>
                    {t("ov.newagreement")}
                  </button>
                  <button className="gr-btn-ghost" onClick={() => setModal({ type: "sponsor" })}>
                    {t("ov.newsponsor")}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ---------- SPONSORS ---------- */}
        {tab === "sponsors" && !openSponsor && (
          <section>
            <div className="gr-toolbar">
              <input
                className="gr-search"
                placeholder={t("common.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {admin && (
                <button className="gr-btn-ghost" onClick={() => setModal({ type: "import" })}>
                  {t("common.import")}
                </button>
              )}
              <button className="gr-btn-ghost" onClick={exportSponsors}>
                {t("common.export")}
              </button>
              <button className="gr-btn" onClick={() => setModal({ type: "sponsor" })}>
                {t("sp.new")}
              </button>
            </div>
            <div className="gr-toolbar">
              <select
                className="gr-search"
                style={{ maxWidth: 260 }}
                value={fResponsible}
                onChange={(e) => setFResponsible(e.target.value)}
              >
                {me && <option value="me">{t("sp.myspon")}</option>}
                <option value="">{t("sp.allresp")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userName(u)}
                  </option>
                ))}
                <option value="none">{t("sp.notassigned")}</option>
              </select>
              <select
                className="gr-search"
                style={{ maxWidth: 260 }}
                value={fEdition}
                onChange={(e) => setFEdition(e.target.value)}
              >
                <option value="">{t("sp.alleditions")}</option>
                {sortedEditions.map((e) => (
                  <optgroup key={e.id} label={e.name}>
                    <option value={`agr:${e.id}`}>
                      {t("sp.withagr")} {e.name}
                    </option>
                    <option value={`decl:${e.id}`}>
                      {t("sp.declined")} {e.name}
                    </option>
                    <option value={`open:${e.id}`}>
                      {t("sp.undecided")} {e.name}
                    </option>
                  </optgroup>
                ))}
              </select>
              {(fEdition || fResponsible || query) && (
                <button
                  className="gr-mini"
                  onClick={() => {
                    setFEdition("");
                    setFResponsible("");
                    setQuery("");
                  }}
                >
                  {t("common.clear")}
                </button>
              )}
              <span className="gr-muted">
                {filteredSponsors.length} {t("common.of")} {sponsors.length} {t("sp.count")}
              </span>
            </div>
            {/* Selecting is only there for the bulk delete, which is an admin's.
                For anyone else the boxes ticked and led nowhere — and on a phone
                the column cost 40px of a 375px screen. */}
            {admin && spSelected.length > 0 && (
              <div className="gr-toolbar">
                <div className="gr-detail-btns">
                  <span className="gr-muted">
                    {spSelected.length} {t("sp.selected")}
                  </span>
                  <button className="gr-mini" onClick={() => setSpSel([])}>
                    {t("common.clear")}
                  </button>
                </div>
                <button
                  className="gr-btn gr-danger"
                  disabled={spBusy}
                  onClick={() => deleteSponsors(spSelected)}
                >
                  {spBusy ? "…" : `${t("sp.delsel")} (${spSelected.length})`}
                </button>
              </div>
            )}
            {filteredSponsors.length === 0 ? (
              <p className="gr-empty">
                {t(sponsors.length === 0 ? "em.nosponsors" : "em.nosponsormatch")}
              </p>
            ) : (
              <div className="gr-tablewrap">
                <table className="gr-table gr-clickable">
                  <thead>
                    <tr>
                      {admin && (
                        <th style={{ width: 28 }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={t("sp.selectall")}
                            checked={allVisibleSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = spSelected.length > 0 && !allVisibleSelected;
                            }}
                            onChange={(e) =>
                              setSpSel(e.target.checked ? filteredSponsors.map((x) => x.id) : [])
                            }
                          />
                        </th>
                      )}
                      {(
                        [
                          ["companyName", t("sp.company"), ""],
                          ["contact", t("sp.contact"), ""],
                          ["city", t("sp.city"), ""],
                          ["language", t("sp.language"), ""],
                          ["responsible", t("sp.responsible"), ""],
                          ["editions", t("sp.editions"), "gr-r"],
                          ["lifetime", t("sp.lifetime"), "gr-r"],
                        ] as Array<[string, string, string]>
                      ).map(([k, label, cls]) => (
                        <th key={k} className={"gr-sortable " + cls} onClick={() => toggleSort(k)} title={t("tt.sort")}>
                          {label}
                          <span className="gr-sortarrow">{sort.key === k ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSponsors.map((s) => {
                      const hs = deals.filter((d) => d.sponsorId === s.id);
                      const tot = hs.reduce((sum, d) => sum + (Number(d.cost) || 0), 0);
                      return (
                        <tr key={s.id} onClick={() => setOpenSponsorId(s.id)}>
                          {/* Stops the row's own click, or ticking a box would open the sponsor. */}
                          {admin && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`${t("sp.select")} ${s.companyName}`}
                                checked={spSel.includes(s.id)}
                                onChange={(e) =>
                                  setSpSel(e.target.checked ? [...spSel, s.id] : spSel.filter((x) => x !== s.id))
                                }
                              />
                            </td>
                          )}
                          <td>
                            <strong>{s.companyName}</strong>
                            {s.vatNumber && <span className="gr-muted"> · {s.vatNumber}</span>}
                            {s.refRequired && (
                              <>
                                {" "}
                                <Tag tone="amber">ref.</Tag>
                              </>
                            )}
                          </td>
                          <td>
                            {(() => {
                              const pc = primaryContact(s);
                              const extra = sponsorContacts(s).length - 1;
                              return pc ? (
                                <>
                                  {contactName(pc)}
                                  {pc.email && <span className="gr-muted"> · {pc.email}</span>}
                                  {extra > 0 && <span className="gr-muted"> +{extra}</span>}
                                </>
                              ) : (
                                <span className="gr-muted">—</span>
                              );
                            })()}
                          </td>
                          <td>{s.city || <span className="gr-muted">—</span>}</td>
                          <td>
                            {[...new Set(sponsorContacts(s).map((c) => (c.language || "nl").toUpperCase()))].join(
                              ", ",
                            ) || "—"}
                          </td>
                          <td>{responsibleName(s, users) || "—"}</td>
                          <td className="gr-r">{hs.length}</td>
                          <td className="gr-r">
                            <strong>{eur(tot)}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "sponsors" && openSponsor && (
          <SponsorDetail
            sponsor={openSponsor}
            deals={deals}
            editions={editions}
            users={users}
            vouchers={vouchers}
            t={t}
            lang={uiLang}
            onBack={() => setOpenSponsorId(null)}
            onEdit={() => setModal({ type: "sponsor", payload: openSponsor })}
            canEdit={canManage(openSponsor)}
            canDelete={admin}
            onDelete={() => deleteSponsor(openSponsor.id)}
            onAddDeal={() => setModal({ type: "deal", payload: { sponsorId: openSponsor.id, lockSponsor: true } })}
            declines={declines}
            onDecline={() => setModal({ type: "decline", payload: { sponsorId: openSponsor.id } })}
            onWithdrawDecline={withdrawDecline}
            onEditDeal={(d) => setModal({ type: "deal", payload: d })}
            onDeleteDeal={deleteDeal}
            onEditContact={(c) => setModal({ type: "contact", payload: { sponsorId: openSponsor.id, contact: c } })}
            onShowAcceptance={(d) => setModal({ type: "acceptance", payload: d })}
            onAcceptForSponsor={admin ? acceptForSponsor : undefined}
            onActivateContact={(c) => saveContact(openSponsor.id, { ...c, portalAccess: true })}
            /* No contact given (the sponsor has none, or none was picked) still
               previews: the portal falls back to the primary contact's language
               and hides the accept button, which is what such a sponsor sees. */
            onPreviewPortal={(c) =>
              setPreviewPortal({
                sponsorId: openSponsor.id,
                contactId: c?.id || primaryContact(openSponsor)?.id || "",
              })
            }
            logos={(data.logos || []).filter((l) => l.sponsorId === openSponsor.id)}
            onLogosChange={(next) => applyLogos(openSponsor.id, next)}
            onEmail={(d) => setModal({ type: "email", payload: d })}
          />
        )}

        {/* ---------- EDITIONS ---------- */}
        {tab === "editions" && admin && (
          <section>
            <div className="gr-toolbar">
              <h2 className="gr-h2" style={{ margin: 0 }}>
                {t("ed.editionstitle")}
              </h2>
              {admin && (
                <>
                  <button className="gr-mini" onClick={() => setModal({ type: "examples" })}>
                    {t("ed.examples")}
                  </button>
                  <button className="gr-mini" onClick={() => setModal({ type: "vatlookup" })}>
                    {t("ed.vatlookup")}
                  </button>
                  <button className="gr-btn" onClick={() => setModal({ type: "edition" })}>
                    {t("ed.new")}
                  </button>
                </>
              )}
            </div>
            {sortedEditions.length === 0 && <p className="gr-empty">{t("ed.none")}</p>}
            {sortedEditions.map((ed) => {
              const edDeals = deals.filter((d) => d.editionId === ed.id);
              const tot = edDeals.reduce((s, d) => s + (Number(d.cost) || 0), 0);
              return (
                <div key={ed.id} className="gr-card">
                  <div className="gr-cardhead">
                    <div>
                      <h3 className="gr-h3">
                        {ed.name} {ed.active ? <Tag tone="green">{t("ov.active")}</Tag> : <Tag>{t("ov.inactive")}</Tag>}
                      </h3>
                      <p className="gr-muted">
                        {ed.startDate}
                        {ed.endDate ? " – " + ed.endDate : ""}
                        {ed.location && " · " + ed.location}
                        {" · "}
                        {edDeals.length} sponsor(s) · {eur(tot)}
                      </p>
                    </div>
                    <div className="gr-detail-btns">
                      {admin && (
                        <>
                          <button className="gr-mini" onClick={() => setModal({ type: "edition", payload: ed })}>
                            {t("common.edit")}
                          </button>
                          <button className="gr-mini" onClick={() => toggleEdition(ed.id)}>
                            {ed.active ? t("ed.deactivate") : t("c.activate")}
                          </button>
                          <button className="gr-mini gr-danger" onClick={() => deleteEdition(ed.id)}>
                            {t("common.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="gr-formulas">
                    <div className="gr-formulahead">
                      <span className="gr-label">{t("ed.formulas")}</span>
                      {admin && (
                        <button
                          className="gr-mini"
                          onClick={() => setModal({ type: "formula", payload: { editionId: ed.id } })}
                        >
                          {t("ed.addformula")}
                        </button>
                      )}
                    </div>
                    {(ed.formulas || []).length === 0 ? (
                      <p className="gr-muted" style={{ margin: "4px 0 0" }}>
                        {t("ed.noformulas")}
                      </p>
                    ) : (
                      <div className="gr-tablewrap">
                        <table className="gr-table gr-compact gr-clickable">
                          <thead>
                            <tr>
                              <th>{t("c.name")}</th>
                              <th className="gr-r">{t("c.cost")}</th>
                              <th className="gr-r">{t("th.vipfsg")}</th>
                              <th className="gr-r">{t("th.drinks")}</th>
                              <th className="gr-r">{t("th.fooddrink")}</th>
                              <th>{t("th.folder")}</th>
                              <th>{t("th.website")}</th>
                              <th>{t("th.poster")}</th>
                              <th>{t("th.led")}</th>
                              <th className="gr-r">{t("th.covers")}</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ed.formulas || []).map((f) => (
                              <tr
                                key={f.name}
                                title={t("tt.editformula")}
                                onClick={() =>
                                  admin && setModal({ type: "formula", payload: { editionId: ed.id, formula: f } })
                                }
                              >
                                <td>
                                  <strong>{f.name}</strong>
                                </td>
                                <td className="gr-r">{eur(f.cost)}</td>
                                <td className="gr-r">
                                  {f.vipFriday || 0} / {f.vipSaturday || 0} / {f.vipGuests || 0}
                                </td>
                                <td className="gr-r">{Number(f.drinkValue) > 0 ? eur(f.drinkValue) : "—"}</td>
                                <td className="gr-r">{Number(f.foodDrinkValue) > 0 ? eur(f.foodDrinkValue) : "—"}</td>
                                <td>
                                  {normFolder(f.folderMention) !== "none"
                                    ? label(FOLDER_OPTS, normFolder(f.folderMention), uiLang)
                                    : "—"}
                                </td>
                                <td>
                                  {f.websiteMention !== "none" ? label(WEBSITE_OPTS, f.websiteMention, uiLang) : "—"}
                                </td>
                                <td>
                                  {f.posterMention && f.posterMention !== "none"
                                    ? label(POSTER_OPTS, f.posterMention, uiLang)
                                    : "—"}
                                </td>
                                <td>{normLed(f.ledboarding).length > 0 ? ledLabel(f.ledboarding, uiLang) : "—"}</td>
                                <td className="gr-r">
                                  {Number(f.fenceCovers) > 0 ? Number(f.fenceCovers) : "—"}
                                </td>
                                <td className="gr-rowbtns">
                                  {admin && (
                                    <button
                                      className="gr-mini gr-danger"
                                      title={t("tt.delformula")}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteFormula(ed.id, f.name);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ---------- VOUCHERS ---------- */}
        {tab === "vouchers" &&
          admin &&
          (() => {
            const ved = editions.find((e) => e.id === (voEdition || overviewEdition?.id));
            const all = ved ? vouchers.filter((v) => v.editionId === ved.id) : [];
            const shown = all.filter(
              (v) => (voSponsor ? v.sponsorId === voSponsor : true) && (voStatus ? v.status === voStatus : true),
            );
            const counts = (Object.keys(VOUCHER_STATUS) as VoucherStatus[]).reduce<Record<string, number>>(
              (a, k) => ({ ...a, [k]: all.filter((v) => v.status === k).length }),
              {},
            );
            const selectable = shown.filter((v) => v.status !== "cancelled");
            const cfg: TickowebConfig = data.settings?.tickoweb || defaultTickoweb;
            const products = ved
              ? voucherProducts(
                  deals.filter((d) => d.editionId === ved.id),
                  all,
                )
              : [];

            return (
              <section>
                <div className="gr-toolbar">
                  <h2 className="gr-h2" style={{ margin: 0 }}>
                    {t("vo.title")}
                  </h2>
                  <div className="gr-detail-btns">
                    {admin && (
                      <button className="gr-mini" onClick={() => setModal({ type: "tickoweb" })}>
                        {t("vo.tickoweb")}
                      </button>
                    )}
                    {ved && (
                      <button className="gr-btn" onClick={() => generateVouchers(ved.id)}>
                        {t("vo.generate")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="gr-toolbar">
                  <select
                    className="gr-search"
                    style={{ maxWidth: 220 }}
                    value={voEdition || overviewEdition?.id || ""}
                    onChange={(e) => {
                      setVoEdition(e.target.value);
                      setVoSel([]);
                    }}
                  >
                    {sortedEditions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="gr-search"
                    style={{ maxWidth: 220 }}
                    value={voSponsor}
                    onChange={(e) => setVoSponsor(e.target.value)}
                  >
                    <option value="">{t("vo.allspon")}</option>
                    {[...new Set(all.map((v) => v.sponsorId))].map((id) => {
                      const sp = sponsors.find((x) => x.id === id);
                      return (
                        <option key={id} value={id}>
                          {sp ? sp.companyName : "?"}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="gr-search"
                    style={{ maxWidth: 200 }}
                    value={voStatus}
                    onChange={(e) => setVoStatus(e.target.value)}
                  >
                    <option value="">{t("vo.allstatus")}</option>
                    {Object.entries(VOUCHER_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {voucherLabel(v, uiLang, k)}
                      </option>
                    ))}
                  </select>
                </div>

                {cfg.mode !== "live" && (
                  <p className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
                    {t("vo.manualmode")}
                  </p>
                )}

                <div className="gr-statrow">
                  {Object.entries(VOUCHER_STATUS).map(([k, v]) => (
                    <div className="gr-stat" key={k}>
                      <span>{counts[k] || 0}</span>
                      {voucherLabel(v, uiLang, k).toLowerCase()}
                    </div>
                  ))}
                </div>

                {products.length > 0 && (
                  <>
                    <h4 className="gr-subhead">{t("vo.products")}</h4>
                    <p className="gr-muted">{t("vo.products2")}</p>
                    <div className="gr-tablewrap" style={{ marginBottom: 24 }}>
                      <table className="gr-table">
                        <thead>
                          <tr>
                            <th>{t("vo.product")}</th>
                            <th className="gr-r">{t("c.value")}</th>
                            <th className="gr-r">{t("vo.fromagreements")}</th>
                            <th className="gr-r">{t("vo.generated")}</th>
                            <th className="gr-r">{t("vo.sponsorcount")}</th>
                            <th>{t("tw.productid")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => {
                            const own = cfg.productIds?.[p.key] || "";
                            const fallback = cfg.productIds?.[p.type] || "";
                            return (
                              <tr key={p.key}>
                                <td>{voucherLabel(VOUCHER_TYPES[p.type], uiLang, p.type)}</td>
                                <td className="gr-r">{p.value > 0 ? eur(p.value) : "—"}</td>
                                <td className="gr-r">{p.expected}</td>
                                <td className="gr-r">{p.generated}</td>
                                <td className="gr-r">{p.sponsors}</td>
                                <td>
                                  {/* Saved when the field is left, not on every keystroke. */}
                                  <input
                                    key={`${p.key}|${own}`}
                                    className="gr-inline-input"
                                    defaultValue={own}
                                    placeholder={fallback || t("tw.productid")}
                                    onBlur={(e) => {
                                      const next = e.target.value.trim();
                                      if (next === own) return;
                                      const ids = { ...(cfg.productIds || {}) };
                                      if (next) ids[p.key] = next;
                                      else delete ids[p.key];
                                      saveSettings({ tickoweb: { ...cfg, productIds: ids } });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {shown.length === 0 ? (
                  <p className="gr-empty">
                    {all.length === 0
                      ? t("em.novouchers")
                      : t("em.novouchermatch")}
                  </p>
                ) : (
                  <>
                    <div className="gr-toolbar">
                      <div className="gr-detail-btns">
                        <button className="gr-mini" onClick={() => setVoSel(selectable.map((v) => v.id))}>
                          {t("vo.selectall")}
                        </button>
                        <button className="gr-mini" onClick={() => setVoSel([])}>
                          {t("common.clear")}
                        </button>
                      </div>
                      <div className="gr-detail-btns">
                        <button
                          className="gr-btn"
                          disabled={voSel.length === 0 || voBusy}
                          onClick={() => runVoucherAction("createSend", voSel)}
                        >
                          {voBusy ? "…" : `${t("vo.createsend")} (${voSel.length})`}
                        </button>
                        <button
                          className="gr-mini"
                          disabled={voSel.length === 0 || voBusy}
                          onClick={() => runVoucherAction("resend", voSel)}
                        >
                          {t("vo.resend")}
                        </button>
                        <button
                          className="gr-mini gr-danger"
                          disabled={voSel.length === 0 || voBusy}
                          onClick={() => runVoucherAction("cancel", voSel)}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                    <div className="gr-tablewrap">
                      <table className="gr-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>{t("c.company")}</th>
                            <th>{t("c.type")}</th>
                            <th className="gr-r">{t("c.value")}</th>
                            <th>{t("c.status")}</th>
                            <th>{t("vo.code")}</th>
                            <th>{t("c.assignedto")}</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((v) => {
                            const sp = sponsors.find((x) => x.id === v.sponsorId);
                            const st = VOUCHER_STATUS[v.status] || VOUCHER_STATUS.pending;
                            return (
                              <tr key={v.id} className={v.status === "cancelled" ? "gr-cancelled" : undefined}>
                                <td>
                                  <input
                                    type="checkbox"
                                    disabled={v.status === "cancelled"}
                                    checked={voSel.includes(v.id)}
                                    onChange={(e) =>
                                      setVoSel(e.target.checked ? [...voSel, v.id] : voSel.filter((x) => x !== v.id))
                                    }
                                  />
                                </td>
                                <td>{sp ? sp.companyName : "?"}</td>
                                <td>{voucherLabel(VOUCHER_TYPES[v.type], uiLang, v.type)}</td>
                                <td className="gr-r">{v.value > 0 ? eur(v.value) : "—"}</td>
                                <td>
                                  <Tag tone={st.tone}>{voucherLabel(st, uiLang, v.status)}</Tag>
                                  {v.error && (
                                    <div className="gr-muted" style={{ color: "var(--red)", fontSize: 11 }}>
                                      {v.error}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {/* Saved when the field is left, like the product ids
                                      above: a save per keystroke reverted the field while
                                      each round trip was out. */}
                                  <input
                                    key={`${v.id}|${v.code || ""}`}
                                    className="gr-inline-input"
                                    placeholder={t("vo.codefrom")}
                                    defaultValue={v.code || ""}
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    enterKeyHint="done"
                                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                    onBlur={(e) => {
                                      const next = e.target.value.trim();
                                      if (next !== (v.code || "")) updateVoucher(v.id, { code: next });
                                    }}
                                  />
                                </td>
                                <td>
                                  {v.recipientName || v.recipientEmail ? (
                                    <>
                                      {v.recipientName}
                                      <div className="gr-muted" style={{ fontSize: 11 }}>
                                        {v.recipientEmail}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="gr-muted">sponsor</span>
                                  )}
                                </td>
                                <td className="gr-rowbtns">
                                  {v.url && (
                                    <a className="gr-mini gr-btn-link" href={v.url} target="_blank" rel="noreferrer">
                                      {t("c.view")}
                                    </a>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            );
          })()}

        {/* ---------- CONTACTS ---------- */}
        {tab === "contacts" &&
          (() => {
            const all = sponsors.flatMap((sp) => sponsorContacts(sp).map((c) => ({ contact: c, sponsor: sp })));
            const q = coQuery.trim().toLowerCase();
            const rows = all
              .filter(({ contact: c }) => (coComm ? !!c.prefs?.[coComm as CommKey] : true))
              .filter(({ contact: c }) => (coLang ? (c.language || "nl") === coLang : true))
              .filter(
                ({ contact: c, sponsor: sp }) =>
                  !q ||
                  [contactName(c), c.email, c.phone, sp.companyName, responsibleName(sp, users)].some((f) =>
                    (f || "").toLowerCase().includes(q),
                  ),
              )
              .sort(
                (a, b) =>
                  a.sponsor.companyName.localeCompare(b.sponsor.companyName) ||
                  contactName(a.contact).localeCompare(contactName(b.contact)),
              );

            /* Same rule as the sponsors table: intersected with the filters, so a
               selection made before narrowing the list can never act on rows that
               are no longer on screen. Only contacts of a sponsor this person may
               change can be selected at all — every bulk action is a change. */
            const selectable = rows.filter((r) => r.contact.id && canManage(r.sponsor));
            const selectedRows = selectable.filter((r) => coSel.includes(r.contact.id));
            const allShown = selectable.length > 0 && selectedRows.length === selectable.length;

            const exportContacts = () => {
              const rowData = rows.map(({ contact: c, sponsor: sp }) => ({
                Sponsor: sp.companyName,
                [t("xl.firstname")]: c.firstName || "",
                [t("xl.lastname")]: c.lastName || "",
                [t("c.email")]: c.email || "",
                [t("c.phone")]: c.phone || "",
                [t("c.language")]: (c.language || "nl").toUpperCase(),
                [t("xl.portalaccess")]: c.portalAccess ? t("xl.activated") : t("xl.notactivated"),
                [label(COMM_LABELS, "info", uiLang)]: c.prefs?.info ? t("xl.yes") : "",
                [label(COMM_LABELS, "invoice", uiLang)]: c.prefs?.invoice ? t("xl.yes") : "",
                [t("xl.receivesvouchers")]: voucherContact(sp)?.id === c.id ? t("xl.yes") : "",
                [t("sp.responsible")]: responsibleName(sp, users),
                [t("sp.city")]: sp.city || "",
              }));
              if (rowData.length === 0) {
                notify(t("dlg.nothingexport"), t("dlg.emptylist"));
                return;
              }
              const ws = XLSX.utils.json_to_sheet(rowData);
              ws["!cols"] = [
                { wch: 28 },
                { wch: 14 },
                { wch: 18 },
                { wch: 28 },
                { wch: 16 },
                { wch: 9 },
                { wch: 14 },
                { wch: 11 },
                { wch: 10 },
                { wch: 17 },
                { wch: 18 },
                { wch: 16 },
              ];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Contacts");
              const suffix = coComm ? `-${coComm}` : "";
              XLSX.writeFile(wb, `grensrock-contacts${suffix}.xlsx`);
            };

            return (
              <section>
                <div className="gr-toolbar">
                  <h2 className="gr-h2" style={{ margin: 0 }}>
                    {t("nav.contacts")}
                  </h2>
                  <div className="gr-detail-btns">
                    {admin && (
                      <button className="gr-btn-ghost" onClick={() => setModal({ type: "importContacts" })}>
                        {t("common.import")}
                      </button>
                    )}
                    {manageableSponsors.length > 0 && (
                      <button className="gr-btn-ghost" onClick={() => setModal({ type: "newContact" })}>
                        {t("sd.addcontact")}
                      </button>
                    )}
                    <button className="gr-btn" onClick={exportContacts}>
                      {t("common.export")}
                    </button>
                  </div>
                </div>
                <div className="gr-toolbar">
                  <input
                    className="gr-search"
                    placeholder={t("common.search")}
                    value={coQuery}
                    onChange={(e) => setCoQuery(e.target.value)}
                  />
                  <select
                    className="gr-search"
                    style={{ maxWidth: 220 }}
                    value={coComm}
                    onChange={(e) => setCoComm(e.target.value)}
                  >
                    <option value="">{t("c.allcomm")}</option>
                    {Object.keys(COMM_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {t("c.receives")}: {label(COMM_LABELS, k, uiLang)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="gr-search"
                    style={{ maxWidth: 170 }}
                    value={coLang}
                    onChange={(e) => setCoLang(e.target.value)}
                  >
                    <option value="">{t("c.alllang")}</option>
                    {Object.entries(LANGS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {(coQuery || coComm || coLang) && (
                    <button
                      className="gr-mini"
                      onClick={() => {
                        setCoQuery("");
                        setCoComm("");
                        setCoLang("");
                      }}
                    >
                      {t("common.clear")}
                    </button>
                  )}
                  <span className="gr-muted">
                    {rows.length} {t("common.of")} {all.length} {t("nav.contacts").toLowerCase()}
                  </span>
                </div>

                {selectedRows.length > 0 && (
                  <div className="gr-toolbar">
                    <div className="gr-detail-btns">
                      <span className="gr-muted">
                        {selectedRows.length} {t("sp.selected")}
                      </span>
                      <button className="gr-mini" onClick={() => setCoSel([])}>
                        {t("common.clear")}
                      </button>
                    </div>
                    <div className="gr-detail-btns">
                      <button
                        className="gr-btn"
                        disabled={!!coBusy}
                        onClick={() => grantPortalAccess(selectedRows)}
                      >
                        {coBusy === "grant" ? "…" : `${t("ct.grantsel")} (${selectedRows.length})`}
                      </button>
                      <button
                        className="gr-btn-ghost gr-danger"
                        disabled={!!coBusy}
                        onClick={() => deleteContacts(selectedRows)}
                      >
                        {coBusy === "delete" ? "…" : `${t("ct.delsel")} (${selectedRows.length})`}
                      </button>
                    </div>
                  </div>
                )}
                {rows.length === 0 ? (
                  <p className="gr-empty">
                    {t(all.length === 0 ? "em.nocontacts" : "em.nocontactmatch")}
                  </p>
                ) : (
                  <div className="gr-tablewrap">
                    <table className="gr-table gr-clickable">
                      <thead>
                        <tr>
                          <th style={{ width: 28 }}>
                            <input
                              type="checkbox"
                              aria-label={t("sp.selectall")}
                              checked={allShown}
                              disabled={selectable.length === 0}
                              ref={(el) => {
                                if (el) el.indeterminate = selectedRows.length > 0 && !allShown;
                              }}
                              onChange={(e) =>
                                setCoSel(e.target.checked ? selectable.map((r) => r.contact.id) : [])
                              }
                            />
                          </th>
                          <th>{t("c.name")}</th>
                          <th>{t("c.company")}</th>
                          <th>{t("c.email")}</th>
                          <th>{t("c.phone")}</th>
                          <th>{t("sp.language")}</th>
                          <th>{t("c.portal")}</th>
                          <th>{t("c.receives")}</th>
                          <th>{t("c.responsible")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ contact: c, sponsor: sp }) => {
                          const mine = canManage(sp);
                          return (
                          <tr
                            key={sp.id + (c.id || "")}
                            className={mine ? undefined : "gr-readonly"}
                            title={mine ? t("tt.editcontact") : undefined}
                            onClick={() =>
                              mine && setModal({ type: "contact", payload: { sponsorId: sp.id, contact: c } })
                            }
                          >
                            {/* Stops the row's own click, or ticking a box opens the editor. */}
                            <td onClick={(e) => e.stopPropagation()}>
                              {mine && (
                                <input
                                  type="checkbox"
                                  aria-label={`${t("sp.select")} ${contactName(c) || c.email}`}
                                  checked={coSel.includes(c.id)}
                                  onChange={(e) =>
                                    setCoSel(e.target.checked ? [...coSel, c.id] : coSel.filter((x) => x !== c.id))
                                  }
                                />
                              )}
                            </td>
                            <td>
                              <strong>{contactName(c) || <span className="gr-muted">{t("c.noname")}</span>}</strong>
                            </td>
                            <td>{sp.companyName}</td>
                            <td>
                              <MailLink email={c.email} />
                            </td>
                            <td>
                              <PhoneLink phone={c.phone} />
                            </td>
                            <td>{(c.language || "nl").toUpperCase()}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {c.portalAccess ? (
                                <>
                                  <Tag tone="green">{t("c.active")}</Tag>{" "}
                                  {mine && (
                                    <button
                                      className="gr-mini"
                                      title={t("tt.resendlink")}
                                      onClick={() => resendPortalLink(c)}
                                    >
                                      {t("ct.resendlink")}
                                    </button>
                                  )}
                                </>
                              ) : !c.email ? (
                                <span className="gr-muted">{t("c.noemail")}</span>
                              ) : mine ? (
                                <button
                                  className="gr-mini"
                                  onClick={() => saveContact(sp.id, { ...c, portalAccess: true })}
                                >
                                  {t("c.activate")}
                                </button>
                              ) : (
                                <Tag>{t("c.inactive")}</Tag>
                              )}
                            </td>
                            <td>
                              <div className="gr-commtags">
                                {(Object.keys(COMM_LABELS) as CommKey[])
                                  .filter((k) => c.prefs?.[k])
                                  .map((k) => (
                                    <Tag key={k}>{label(COMM_LABELS, k, uiLang)}</Tag>
                                  ))}
                              </div>
                            </td>
                            <td>{responsibleName(sp, users) || "—"}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="gr-muted" style={{ marginTop: 10 }}>{t("ct.tip")}</p>
              </section>
            );
          })()}

        {/* ---------- AGREEMENTS ---------- */}
        {tab === "agreements" &&
          (() => {
            const q = agQuery.trim().toLowerCase();
            const rows = deals
              .map((d) => ({
                deal: d,
                sponsor: sponsors.find((s) => s.id === d.sponsorId),
                edition: editions.find((e) => e.id === d.editionId),
              }))
              .filter(({ sponsor, edition, deal: d }) => {
                if (agEdition && d.editionId !== agEdition) return false;
                if (agResponsible === "me" && sponsor?.responsibleId !== userId) return false;
                else if (agResponsible === "none" && sponsor?.responsibleId) return false;
                else if (
                  agResponsible &&
                  agResponsible !== "me" &&
                  agResponsible !== "none" &&
                  sponsor?.responsibleId !== agResponsible
                )
                  return false;
                if (agStatus === "accepted" && !isAccepted(d)) return false;
                if (agStatus === "toaccept" && isAccepted(d)) return false;
                if (agStatus === "requested" && !(d.requestedAt && !d.confirmedAt)) return false;
                if (agStatus === "invoiced" && !d.invoiceCreated) return false;
                if (agStatus === "toinvoice" && (!needsInvoice(d) || d.invoiceCreated)) return false;
                if (agSettle && (d.settlement || "invoice") !== agSettle) return false;
                if (
                  q &&
                  ![sponsor?.companyName, edition?.name, d.formulaName, responsibleName(sponsor, users)].some((f) =>
                    (f || "").toLowerCase().includes(q),
                  )
                )
                  return false;
                return true;
              })
              .sort(
                (a, b) =>
                  (b.edition?.startDate || "").localeCompare(a.edition?.startDate || "") ||
                  (a.sponsor?.companyName || "").localeCompare(b.sponsor?.companyName || ""),
              );

            const totalCost = rows.reduce((s, r) => s + dealTotalCost(r.deal), 0);
            const toInvoice = rows.reduce((s, r) => s + (r.deal.invoiceCreated ? 0 : invoiceAmount(r.deal)), 0);

            const exportAgreements = () => {
              if (rows.length === 0) {
                notify(t("ex.emptymsg"), t("ex.empty"));
                return;
              }
              const data2 = rows.map(({ deal: d, sponsor, edition }) => ({
                [t("c.edition")]: edition?.name || "",
                [t("sp.company")]: sponsor?.companyName || "",
                [t("c.formula")]: d.formulaName || t("th.custom"),
                [t("c.cost")]: dealTotalCost(d),
                [t("inv.toinvoice")]: invoiceAmount(d),
                [t("ag.settlement")]: t("set." + (d.settlement || "invoice")),
                [t("xl.vipfrsagu")]: `${d.vipFriday || 0}/${d.vipSaturday || 0}/${d.vipGuests || 0}`,
                [t("th.drinks")]: Number(d.drinkValue) || 0,
                [t("th.fooddrink")]: Number(d.foodDrinkValue) || 0,
                [t("c.accepted")]: isAccepted(d) ? fmtDateTime(d.acceptance!.acceptedAt) : "",
                [t("th.invoice")]: d.invoiceCreated ? d.invoiceNumber || t("xl.yes") : "",
                [t("sp.responsible")]: responsibleName(sponsor, users),
              }));
              const ws = XLSX.utils.json_to_sheet(data2);
              ws["!cols"] = [
                { wch: 16 },
                { wch: 26 },
                { wch: 14 },
                { wch: 11 },
                { wch: 11 },
                { wch: 12 },
                { wch: 12 },
                { wch: 8 },
                { wch: 11 },
                { wch: 16 },
                { wch: 14 },
                { wch: 18 },
              ];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Agreements");
              XLSX.writeFile(wb, "grensrock-agreements.xlsx");
            };

            return (
              <section>
                <div className="gr-toolbar">
                  <h2 className="gr-h2" style={{ margin: 0 }}>
                    {t("nav.agreements")}
                  </h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="gr-btn-ghost" onClick={exportAgreements}>
                      {t("common.export")}
                    </button>
                    {/* Start on the edition the list is narrowed to, as long as it still takes agreements. */}
                    <button
                      className="gr-btn"
                      onClick={() =>
                        setModal({
                          type: "deal",
                          payload: editions.some((e) => e.id === agEdition && e.active)
                            ? { editionId: agEdition }
                            : undefined,
                        })
                      }
                    >
                      {t("ov.newagreement")}
                    </button>
                  </div>
                </div>

                <div className="gr-toolbar">
                  <input
                    className="gr-search"
                    placeholder={t("common.search")}
                    value={agQuery}
                    onChange={(e) => setAgQuery(e.target.value)}
                  />
                  <select
                    className="gr-search"
                    style={{ maxWidth: 200 }}
                    value={agEdition}
                    onChange={(e) => setAgEdition(e.target.value)}
                  >
                    <option value="">{t("sp.alleditions")}</option>
                    {sortedEditions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="gr-search"
                    style={{ maxWidth: 200 }}
                    value={agResponsible}
                    onChange={(e) => setAgResponsible(e.target.value)}
                  >
                    {me && <option value="me">{t("sp.myspon")}</option>}
                    <option value="">{t("sp.allresp")}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {userName(u)}
                      </option>
                    ))}
                    <option value="none">{t("sp.notassigned")}</option>
                  </select>
                  <select
                    className="gr-search"
                    style={{ maxWidth: 190 }}
                    value={agStatus}
                    onChange={(e) => setAgStatus(e.target.value)}
                  >
                    <option value="">{t("ag.allstatus")}</option>
                    <option value="accepted">{t("ag.accepted")}</option>
                    <option value="toaccept">{t("ag.toaccept")}</option>
                    <option value="requested">{t("ag.requested")}</option>
                    <option value="toinvoice">{t("ag.toinvoice")}</option>
                    <option value="invoiced">{t("ag.invoiced")}</option>
                  </select>
                  <select
                    className="gr-search"
                    style={{ maxWidth: 170 }}
                    value={agSettle}
                    onChange={(e) => setAgSettle(e.target.value)}
                  >
                    <option value="">{t("ag.allsettle")}</option>
                    <option value="invoice">{t("set.invoice")}</option>
                    <option value="inkind">{t("set.inkind")}</option>
                    <option value="mixed">{t("set.mixed")}</option>
                  </select>
                  {(agQuery || agEdition || agResponsible || agStatus || agSettle) && (
                    <button
                      className="gr-mini"
                      onClick={() => {
                        setAgQuery("");
                        setAgEdition("");
                        setAgResponsible("");
                        setAgStatus("");
                        setAgSettle("");
                      }}
                    >
                      {t("common.clear")}
                    </button>
                  )}
                </div>

                <div className="gr-statrow">
                  <div className="gr-stat">
                    <span>{rows.length}</span>
                    {t("nav.agreements").toLowerCase()}
                  </div>
                  <div className="gr-stat">
                    <span>{eur(totalCost)}</span>
                    {t("ag.totalvalue")}
                  </div>
                  <div className="gr-stat">
                    <span>{eur(toInvoice)}</span>
                    {t("ag.stilltoinvoice")}
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="gr-empty">{deals.length === 0 ? t("ag.none") : t("ag.nomatch")}</p>
                ) : (
                  <div className="gr-tablewrap">
                    <table className="gr-table gr-clickable">
                      <thead>
                        <tr>
                          {/* Company first: on a phone the first column is the one that
                              stays put while the rest scrolls, and it should name the row. */}
                          <th>{t("sp.company")}</th>
                          <th>{t("c.edition")}</th>
                          <th>{t("c.formula")}</th>
                          <th className="gr-r">{t("c.cost")}</th>
                          <th>{t("ag.settlement")}</th>
                          <th>{t("c.accepted")}</th>
                          <th>{t("th.invoice")}</th>
                          <th>{t("sp.responsible")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ deal: d, sponsor, edition }) => (
                          /* Someone else's agreement stays readable here and on
                             the sponsor page; it just doesn't open the editor. */
                          <tr
                            key={d.id}
                            className={canManage(sponsor) ? undefined : "gr-readonly"}
                            title={canManage(sponsor) ? t("sd.clicktoedit") : undefined}
                            onClick={() => canManage(sponsor) && setModal({ type: "deal", payload: d })}
                          >
                            <td>
                              {/* The row opens the agreement; the name is the way to the sponsor. */}
                              {sponsor ? (
                                <button
                                  className="gr-celllink"
                                  title={t("tt.opensponsor")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTab("sponsors");
                                    setOpenSponsorId(sponsor.id);
                                  }}
                                >
                                  {sponsor.companyName}
                                </button>
                              ) : (
                                <strong>?</strong>
                              )}
                            </td>
                            <td>
                              {edition?.name || "?"}
                              {edition && !edition.active && (
                                <>
                                  {" "}
                                  <Tag>{t("th.archived")}</Tag>
                                </>
                              )}
                            </td>
                            <td>
                              {d.formulaName || <span className="gr-muted">{t("th.custom")}</span>}
                              {d.requestedAt && !d.confirmedAt && (
                                <>
                                  {" "}
                                  <Tag tone="amber">{t("sd.reqbysponsor")}</Tag>
                                </>
                              )}
                            </td>
                            <td className="gr-r">
                              <strong>{eur(dealTotalCost(d))}</strong>
                              {foodDrinkExtra(d) > 0 && (
                                <div style={{ fontSize: 11, color: "var(--orange-deep)" }}>
                                  +{eur(foodDrinkExtra(d))}
                                </div>
                              )}
                            </td>
                            <td>{t("set." + (d.settlement || "invoice"))}</td>
                            <td>
                              {isAccepted(d) ? (
                                changedSinceAcceptance(d) ? (
                                  <Tag tone="amber">{t("sd.changed")}</Tag>
                                ) : (
                                  <Tag tone="green">{t("c.accepted")}</Tag>
                                )
                              ) : (
                                <>
                                  <Tag tone="amber">{t("sd.notyet")}</Tag>
                                  {admin && (
                                    <button
                                      className="gr-mini"
                                      style={{ marginLeft: 6 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        acceptForSponsor(d);
                                      }}
                                    >
                                      {t("sd.acceptforsponsor")}
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              {!needsInvoice(d) ? (
                                <Tag tone="grey">{t("sd.inkind")}</Tag>
                              ) : d.invoiceCreated ? (
                                <Tag tone="green">{d.invoiceNumber || t("sd.created")}</Tag>
                              ) : (
                                <Tag tone="amber">{t("sd.pending")}</Tag>
                              )}
                            </td>
                            <td>{responsibleName(sponsor, users) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })()}

        {/* ---------- ANALYTICS ---------- */}
        {tab === "analytics" &&
          (() => {
            // Editions oldest → newest, so "previous edition" is well-defined
            const chrono = [...editions].sort((a, b) =>
              (a.startDate || a.name || "").localeCompare(b.startDate || b.name || ""),
            );
            const dealsForEdition = (eid: string) => deals.filter((d) => d.editionId === eid);
            const sponsorIdsForEdition = (eid: string) => new Set(dealsForEdition(eid).map((d) => d.sponsorId));

            // 1) Active sponsors per edition
            const perEdition = chrono.map((e) => ({
              edition: e,
              sponsors: sponsorIdsForEdition(e.id).size,
              agreements: dealsForEdition(e.id).length,
            }));
            const maxSponsors = Math.max(1, ...perEdition.map((x) => x.sponsors));

            // 2) Agreements by type (formula name; custom grouped)
            const typeCounts: Record<string, number> = {};
            deals.forEach((d) => {
              const key = d.formulaName || t("th.custom");
              typeCounts[key] = (typeCounts[key] || 0) + 1;
            });
            const typeRows = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
            const maxType = Math.max(1, ...typeRows.map(([, n]) => n));
            const typePalette = [
              "var(--pink)",
              "var(--blue)",
              "var(--orange)",
              "var(--yellow)",
              "var(--green)",
              "var(--blue-deep)",
              "var(--orange-deep)",
            ];

            // 3) Per responsible: sponsors allocated, agreements, amount
            const respRows = [
              ...users.map((u) => ({ ...u, _none: false })),
              { id: "", firstName: t("sp.notassigned"), lastName: "", _none: true },
            ]
              .map((u) => {
                const mySponsors = sponsors.filter((s) => (s.responsibleId || "") === u.id);
                const myDeals = deals.filter((d) => mySponsors.some((s) => s.id === d.sponsorId));
                return {
                  user: u,
                  sponsors: mySponsors.length,
                  agreements: myDeals.length,
                  amount: myDeals.reduce((sum, d) => sum + dealTotalCost(d), 0),
                };
              })
              .filter((r) => r.sponsors > 0 || r.agreements > 0);

            // 4) New sponsors per edition (no agreement in the immediately previous edition)
            const newRows = chrono.map((e, i) => {
              const prev = i > 0 ? chrono[i - 1] : null;
              const nowIds = sponsorIdsForEdition(e.id);
              const prevIds = prev ? sponsorIdsForEdition(prev.id) : new Set<string>();
              let fresh = 0;
              nowIds.forEach((id) => {
                if (!prevIds.has(id)) fresh++;
              });
              return {
                edition: e,
                total: nowIds.size,
                fresh: prev ? fresh : nowIds.size,
                returning: prev ? nowIds.size - fresh : 0,
                hasPrev: !!prev,
              };
            });

            const Bar = ({
              value,
              max,
              color,
              label,
              right,
            }: {
              value: number;
              max: number;
              color?: string;
              label: ReactNode;
              right?: ReactNode;
            }) => (
              <div className="gr-anbar">
                <span className="gr-anbar-label">{label}</span>
                <div className="gr-anbar-track">
                  <div
                    className="gr-anbar-fill"
                    style={{ width: `${(value / max) * 100}%`, background: color || "var(--pink)" }}
                  />
                </div>
                <span className="gr-anbar-val">{right ?? value}</span>
              </div>
            );

            if (editions.length === 0) return <p className="gr-empty">{t("an.noeditions")}</p>;

            return (
              <section>
                <div className="gr-toolbar">
                  <h2 className="gr-h2" style={{ margin: 0 }}>
                    {t("nav.analytics")}
                  </h2>
                </div>

                {/* 1. Active sponsors per edition */}
                <div className="gr-card">
                  <h3 className="gr-h3">{t("an.activeper")}</h3>
                  <p className="gr-muted" style={{ marginTop: 0 }}>
                    {t("an.activeperhint")}
                  </p>
                  {perEdition.length === 0 ? (
                    <p className="gr-muted">{t("ag.none")}</p>
                  ) : (
                    perEdition.map(({ edition: e, sponsors: n, agreements: a }) => (
                      <Bar
                        key={e.id}
                        value={n}
                        max={maxSponsors}
                        color={e.active ? "var(--pink)" : "var(--line)"}
                        label={
                          <>
                            {e.name}
                            {!e.active && (
                              <>
                                {" "}
                                <Tag>{t("th.archived")}</Tag>
                              </>
                            )}
                          </>
                        }
                        right={
                          <>
                            {n}{" "}
                            <span className="gr-muted" style={{ fontWeight: 400 }}>
                              · {a} {t("nav.agreements").toLowerCase()}
                            </span>
                          </>
                        }
                      />
                    ))
                  )}
                </div>

                {/* 2. Agreements by type */}
                <div className="gr-card">
                  <h3 className="gr-h3">{t("an.bytype")}</h3>
                  {typeRows.length === 0 ? (
                    <p className="gr-muted">{t("ag.none")}</p>
                  ) : (
                    typeRows.map(([name, n], i) => (
                      <Bar key={name} value={n} max={maxType} color={typePalette[i % typePalette.length]} label={name} />
                    ))
                  )}
                </div>

                {/* 3. Per responsible */}
                <div className="gr-card">
                  <h3 className="gr-h3">{t("an.byresp")}</h3>
                  {respRows.length === 0 ? (
                    <p className="gr-muted">{t("an.noresp")}</p>
                  ) : (
                    <div className="gr-tablewrap">
                      <table className="gr-table">
                        <thead>
                          <tr>
                            <th>{t("sp.responsible")}</th>
                            <th className="gr-r">{t("nav.sponsors")}</th>
                            <th className="gr-r">{t("nav.agreements")}</th>
                            <th className="gr-r">{t("ag.totalvalue")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {respRows
                            .sort((a, b) => b.amount - a.amount)
                            .map((r) => (
                              <tr key={r.user.id || "none"}>
                                <td>
                                  {r.user._none ? (
                                    <span className="gr-muted">{r.user.firstName}</span>
                                  ) : (
                                    userName(r.user as User)
                                  )}
                                </td>
                                <td className="gr-r">{r.sponsors}</td>
                                <td className="gr-r">{r.agreements}</td>
                                <td className="gr-r">
                                  <strong>{eur(r.amount)}</strong>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>
                              <strong>{t("common.done") === "Klaar" ? "Totaal" : "Total"}</strong>
                            </td>
                            <td className="gr-r">
                              <strong>{respRows.reduce((s, r) => s + r.sponsors, 0)}</strong>
                            </td>
                            <td className="gr-r">
                              <strong>{respRows.reduce((s, r) => s + r.agreements, 0)}</strong>
                            </td>
                            <td className="gr-r">
                              <strong>{eur(respRows.reduce((s, r) => s + r.amount, 0))}</strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. New vs returning sponsors */}
                <div className="gr-card">
                  <h3 className="gr-h3">{t("an.newspon")}</h3>
                  <p className="gr-muted" style={{ marginTop: 0 }}>
                    {t("an.newsponhint")}
                  </p>
                  <div className="gr-tablewrap">
                    <table className="gr-table">
                      <thead>
                        <tr>
                          <th>{t("c.edition")}</th>
                          <th className="gr-r">{t("an.newcol")}</th>
                          <th className="gr-r">{t("an.returning")}</th>
                          <th className="gr-r">{t("an.totalcol")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newRows.map(({ edition: e, fresh, returning, total, hasPrev }) => (
                          <tr key={e.id}>
                            <td>
                              {e.name}
                              {!e.active && (
                                <>
                                  {" "}
                                  <Tag>{t("th.archived")}</Tag>
                                </>
                              )}
                            </td>
                            <td className="gr-r">
                              <strong style={{ color: "var(--green)" }}>{fresh}</strong>
                            </td>
                            <td className="gr-r">{hasPrev ? returning : <span className="gr-muted">—</span>}</td>
                            <td className="gr-r">{total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="gr-muted" style={{ fontSize: 12, marginBottom: 0 }}>
                    {t("an.newnote")}
                  </p>
                </div>
              </section>
            );
          })()}

        {/* ---------- AUDIT LOG ---------- */}
        {tab === "audit" &&
          admin &&
          (() => {
            const log = data.audit || [];
            const q = auQuery.trim().toLowerCase();
            const rows = log
              .filter((e) => (auEntity ? e.entity === auEntity : true))
              .filter(
                (e) =>
                  !q ||
                  [e.entityName, e.action, e.detail, auditActorLabel(e.actor)].some((f) =>
                    (f || "").toLowerCase().includes(q),
                  ),
              );

            const ENTITY_LABEL = (e: AuditEntity | string) => t(`au.e.${e}`);

            const exportLog = () => {
              const out = rows.map((e) => ({
                [t("xl.datetime")]: fmtDateTime(e.at),
                [t("au.by")]: auditActorLabel(e.actor),
                [t("au.type")]: ENTITY_LABEL(e.entity),
                [t("au.item")]: e.entityName,
                [t("au.action")]: e.action,
                [t("au.details")]: e.detail,
              }));
              if (out.length === 0) {
                notify(t("dlg.nothingexportlog"), t("dlg.emptylog"));
                return;
              }
              const ws = XLSX.utils.json_to_sheet(out);
              ws["!cols"] = [{ wch: 18 }, { wch: 26 }, { wch: 12 }, { wch: 34 }, { wch: 20 }, { wch: 40 }];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Audit");
              XLSX.writeFile(wb, "grensrock-audit-log.xlsx");
            };

            return (
              <section>
                <div className="gr-toolbar">
                  <h2 className="gr-h2" style={{ margin: 0 }}>
                    {t("au.title")}
                  </h2>
                  <button className="gr-btn" onClick={exportLog} disabled={rows.length === 0}>
                    {t("common.export")}
                  </button>
                </div>
                <div className="gr-toolbar">
                  <input
                    className="gr-search"
                    placeholder={t("common.search")}
                    value={auQuery}
                    onChange={(e) => setAuQuery(e.target.value)}
                  />
                  <select
                    className="gr-search"
                    style={{ maxWidth: 200 }}
                    value={auEntity}
                    onChange={(e) => setAuEntity(e.target.value)}
                  >
                    <option value="">{t("c.alltypes")}</option>
                    {AUDIT_ENTITIES.map((k) => (
                      <option key={k} value={k}>
                        {ENTITY_LABEL(k)}
                      </option>
                    ))}
                  </select>
                  {(auQuery || auEntity) && (
                    <button
                      className="gr-mini"
                      onClick={() => {
                        setAuQuery("");
                        setAuEntity("");
                      }}
                    >
                      {t("common.clear")}
                    </button>
                  )}
                  <span className="gr-muted">{t("au.count", { n: rows.length, total: log.length })}</span>
                </div>

                {rows.length === 0 ? (
                  <p className="gr-empty">
                    {t(log.length === 0 ? "em.nolog" : "em.nologmatch")}
                  </p>
                ) : (
                  <div className="gr-tablewrap">
                    <table className="gr-table gr-compact">
                      <thead>
                        <tr>
                          <th>{t("au.when")}</th>
                          <th>{t("au.by")}</th>
                          <th>{t("au.type")}</th>
                          <th>{t("au.item")}</th>
                          <th>{t("au.action")}</th>
                          <th>{t("au.details")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((e) => (
                          <tr key={e.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.at)}</td>
                            <td>{auditActorLabel(e.actor)}</td>
                            <td>
                              <Tag tone={e.actor?.type === "sponsor" ? "blue" : "grey"}>
                                {ENTITY_LABEL(e.entity)}
                              </Tag>
                            </td>
                            <td>{e.entityName}</td>
                            <td>{e.action}</td>
                            <td className="gr-muted">{e.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="gr-muted" style={{ marginTop: 10 }}>{t("au.note")}</p>
              </section>
            );
          })()}

        {/* ---------- FOLDER PRODUCTION ---------- */}
        {tab === "folder" && admin && (
          <section>
            <div className="gr-toolbar">
              <h2 className="gr-h2" style={{ margin: 0 }}>
                {t("nav.folder")}
              </h2>
              <select
                className="gr-search"
                style={{ maxWidth: 260 }}
                value={folEdition || overviewEdition?.id || ""}
                onChange={(e) => setFolEdition(e.target.value)}
              >
                {sortedEditions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <FolderOverview
              logos={data.logos || []}
              edition={editions.find((e) => e.id === (folEdition || overviewEdition?.id))}
              deals={deals}
              sponsors={sponsors}
              users={users}
              notify={notify}
              t={t}
              lang={uiLang}
            />
          </section>
        )}

        {/* ---------- TEAM ---------- */}
        {tab === "team" && admin && (
          <section>
            <div className="gr-toolbar">
              <h2 className="gr-h2" style={{ margin: 0 }}>
                {t("tm.title")}
              </h2>
              <button className="gr-btn" onClick={() => setModal({ type: "user" })}>
                {t("tm.new")}
              </button>
            </div>
            {(data.pendingUsers || []).length > 0 && (
              <div className="gr-card" style={{ borderLeft: "4px solid var(--orange)", marginBottom: 16 }}>
                <h3 className="gr-h3" style={{ marginTop: 0 }}>
                  {t("tm.requests")} ({(data.pendingUsers || []).length})
                </h3>
                <p className="gr-muted" style={{ marginTop: 0 }}>
                  {t("tm.requestshint")}
                </p>
                <div className="gr-tablewrap">
                  <table className="gr-table">
                    <tbody>
                      {(data.pendingUsers || []).map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{userName(u)}</strong>
                          </td>
                          <td>{u.email}</td>
                          <td className="gr-rowbtns">
                            <button className="gr-mini" onClick={() => approveUser(u.id, "user")}>
                              {t("tm.grantuser")}
                            </button>
                            <button className="gr-mini" onClick={() => approveUser(u.id, "admin")}>
                              {t("tm.grantadmin")}
                            </button>
                            <button className="gr-mini gr-danger" onClick={() => declineUser(u.id)}>
                              {t("tm.decline")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {users.length === 0 ? (
              <p className="gr-empty">{t("tm.none")}</p>
            ) : (
              <div className="gr-tablewrap">
                <table className="gr-table gr-clickable">
                  <thead>
                    <tr>
                      <th>{t("c.name")}</th>
                      <th>{t("uf.emaillogin")}</th>
                      <th>{t("c.role")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} title={t("tt.editaccount")} onClick={() => setModal({ type: "user", payload: u })}>
                        <td>
                          <strong>{userName(u)}</strong>
                          {u.id === userId && <span className="gr-muted"> · {t("tm.you")}</span>}
                        </td>
                        <td>
                          {u.email ? u.email : <span style={{ color: "var(--red)" }}>{t("tm.noemail")}</span>}
                        </td>
                        <td>{isAdmin(u) ? <Tag tone="green">{t("tm.admin")}</Tag> : <Tag>{t("tm.user")}</Tag>}</td>
                        <td className="gr-rowbtns" onClick={(e) => e.stopPropagation()}>
                          <CopyUserInvite user={u} t={t} />
                          <button className="gr-mini gr-danger" onClick={() => deleteUser(u.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="gr-muted" style={{ marginTop: 12 }}>
              <strong>{t("tm.admin")}</strong> {t("tm.roleadmin")}
              <br />
              <strong>{t("tm.user")}</strong> {t("tm.roleuser")}
            </p>
            <div className="gr-portalbox" style={{ marginTop: 14 }}>
              {t("tm.signin")}
              <p className="gr-muted" style={{ margin: "6px 0 0" }}>
                {t("tm.signin2")}
              </p>
            </div>
          </section>
        )}

        {/* ---------- INVOICING ---------- */}
        {tab === "invoicing" && admin && (
          <section>
            <div className="gr-toolbar">
              <h2 className="gr-h2" style={{ margin: 0 }}>
                {t("inv.titlefull")}
              </h2>
              <select
                value={invEdition || overviewEdition?.id || ""}
                onChange={(e) => setInvEdition(e.target.value)}
                className="gr-search"
                style={{ maxWidth: 260 }}
              >
                {sortedEditions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            {!invEd ? (
              <p className="gr-empty">{t("fo.createfirst2")}</p>
            ) : invDeals.length === 0 ? (
              <p className="gr-empty">
                {t("inv.noagr")} {invEd.name}.
              </p>
            ) : (
              (() => {
                const billable = invDeals.filter(needsInvoice);
                const inKind = invDeals.filter((d) => !needsInvoice(d));
                const blockedCount = billable.filter((d) =>
                  refMissing(d, sponsors.find((x) => x.id === d.sponsorId)),
                ).length;
                return (
                  <>
                    {blockedCount > 0 && (
                      <p className="gr-blockbanner">
                        {blockedCount} {t("inv.blocked")}
                      </p>
                    )}
                    {billable.length > 0 && (
                      <div className="gr-tablewrap">
                        <table className="gr-table">
                          <thead>
                            <tr>
                              <th>{t("c.company")}</th>
                              <th>{t("c.vat")}</th>
                              <th className="gr-r">{t("inv.toinvoice")}</th>
                              <th>{t("c.reference")}</th>
                              <th>{t("inv.created")}</th>
                              <th>{t("inv.number")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billable.map((d) => {
                              const s = sponsors.find((x) => x.id === d.sponsorId);
                              const blocked = refMissing(d, s);
                              return (
                                <tr key={d.id} className={blocked ? "gr-blocked" : undefined}>
                                  <td>
                                    <strong>{s ? s.companyName : "?"}</strong>
                                    {d.settlement === "mixed" && (
                                      <>
                                        {" "}
                                        <Tag tone="amber">{t("inv.partlyinkind")}</Tag>
                                      </>
                                    )}
                                  </td>
                                  <td>{s?.vatNumber || "—"}</td>
                                  <td className="gr-r">
                                    {eur(invoiceAmount(d))}
                                    {d.settlement === "mixed" && (
                                      <div className="gr-muted" style={{ fontSize: 11 }}>
                                        {t("inv.oftotal")} {eur(d.cost)}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    {refRequiredFor(d, s) ? (
                                      <>
                                        {/* Saved when the field is left. "Invoice created"
                                            reads the saved reference, so the box unlocks once
                                            this save is back, not while the field is typed in. */}
                                        <input
                                          key={`${d.id}|${d.invoiceReference || ""}`}
                                          className="gr-inline-input"
                                          placeholder={t("inv.reqref")}
                                          defaultValue={d.invoiceReference || ""}
                                          style={blocked ? { borderColor: "var(--red)" } : undefined}
                                          autoCapitalize="off"
                                          autoCorrect="off"
                                          spellCheck={false}
                                          enterKeyHint="done"
                                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                          onBlur={(e) => {
                                            const next = e.target.value.trim();
                                            if (next !== (d.invoiceReference || ""))
                                              setInvoice(d.id, { invoiceReference: next });
                                          }}
                                        />
                                        {blocked && (
                                          <div className="gr-muted" style={{ color: "var(--red)", fontSize: 11 }}>
                                            {t("inv.reqbefore")}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <span className="gr-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={!!d.invoiceCreated}
                                      disabled={blocked}
                                      title={blocked ? t("inv.fillref") : undefined}
                                      onChange={(e) => setInvoice(d.id, { invoiceCreated: e.target.checked })}
                                    />
                                  </td>
                                  <td>
                                    {/* Saved when the field is left, like the reference. */}
                                    <input
                                      key={`${d.id}|${d.invoiceNumber || ""}`}
                                      className="gr-inline-input"
                                      placeholder="e.g. 2026-014"
                                      defaultValue={d.invoiceNumber || ""}
                                      autoCapitalize="off"
                                      autoCorrect="off"
                                      spellCheck={false}
                                      enterKeyHint="done"
                                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                      onBlur={(e) => {
                                        const next = e.target.value.trim();
                                        if (next !== (d.invoiceNumber || "")) setInvoice(d.id, { invoiceNumber: next });
                                      }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {inKind.length > 0 && (
                      <>
                        <h4 className="gr-subhead">{t("inv.notinvoiced")}</h4>
                        <div className="gr-tablewrap">
                          <table className="gr-table gr-compact">
                            <thead>
                              <tr>
                                <th>{t("c.company")}</th>
                                <th className="gr-r">{t("c.value")}</th>
                                <th>{t("inv.provides")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inKind.map((d) => {
                                const s = sponsors.find((x) => x.id === d.sponsorId);
                                return (
                                  <tr key={d.id}>
                                    <td>
                                      <strong>{s ? s.companyName : "?"}</strong>
                                    </td>
                                    <td className="gr-r">{eur(d.cost)}</td>
                                    <td>{d.inKindDescription || <span className="gr-muted">—</span>}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                );
              })()
            )}
          </section>
        )}

        {/* ---------- FAQ ---------- */}
        {tab === "faq" && (
          <Faq
            sections={teamFaq(uiLang, admin)}
            labels={{
              title: t("faq.title"),
              intro: t("faq.intro"),
              search: t("faq.search"),
              noResults: t("faq.noresults"),
            }}
          />
        )}
      </main>

      {/* ---------- modals ---------- */}
      {modal?.type === "sponsor" && (
        <Modal title={t(modal.payload ? "md.editsponsor" : "md.newsponsor")} onClose={() => setModal(null)} lang={uiLang}>
          <SponsorForm
            initial={modal.payload}
            defaultResponsibleId={me?.id}
            teamMembers={users}
            vatCfg={data.settings?.vatLookup || defaultVatLookup}
            existingSponsors={sponsors}
            t={t}
            lang={uiLang}
            onSave={saveSponsor}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "contact" && (
        <Modal
          title={t(modal.payload.contact ? "md.editcontact" : "md.newcontact")}
          onClose={() => setModal(null)}
          lang={uiLang}
        >
          <ContactForm
            initial={modal.payload.contact}
            lang={uiLang}
            onSave={(c) => saveContact(modal.payload.sponsorId, c)}
            onDelete={(cid) => deleteContact(modal.payload.sponsorId, cid)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "newContact" && (
        <NewContactModal
          sponsors={sponsors}
          pickableSponsors={manageableSponsors}
          t={t}
          lang={uiLang}
          onClose={() => setModal(null)}
          onSave={(sponsorId, contact) => saveContact(sponsorId, contact)}
        />
      )}
      {modal?.type === "importContacts" && admin && (
        <ContactImportModal
          sponsors={sponsors}
          onImport={importContacts}
          onClose={() => setModal(null)}
          t={t}
          lang={uiLang}
        />
      )}
      {modal?.type === "acceptance" &&
        (() => {
          const d = deals.find((x) => x.id === modal.payload.id) || modal.payload;
          const a = d.acceptance;
          if (!a) return null;
          const snap = a.snapshot || {};
          const changed = changedSinceAcceptance(d);
          return (
            <Modal title={t("md.acceptance")} onClose={() => setModal(null)} wide lang={uiLang}>
              <dl className="gr-dl">
                <dt>{t("ac.acceptedby")}</dt>
                <dd>
                  <strong>{a.name || "—"}</strong>
                  {a.email ? ` · ${a.email}` : ""}
                  {a.byTeam && <div className="gr-muted">{t("ac.byteam")}</div>}
                </dd>
                <dt>{t("xl.datetime")}</dt>
                <dd>{fmtDateTime(a.acceptedAt)}</dd>
                <dt>{t("c.formula")}</dt>
                <dd>{snap.formulaName || "—"}</dd>
                <dt>{t("c.contribution")}</dt>
                <dd>{eur(snap.cost)}</dd>
              </dl>
              <h4 className="gr-subhead">{t("ac.termsaccepted")}</h4>
              <ul className="gr-benefitlist">
                {[...ticketLines(snap, uiLang), ...visibilityLines(snap, uiLang)].map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {(snap.notes || "").trim() && <p className="gr-muted">{t("c.notes")}: {snap.notes}</p>}
              {changed && (
                <>
                  <p className="gr-blockbanner">{t("ac.changedbanner")}</p>
                  <h4 className="gr-subhead">{t("ac.currentterms")}</h4>
                  <ul className="gr-benefitlist">
                    {[...ticketLines(d, uiLang), ...visibilityLines(d, uiLang)].map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  <p className="gr-muted">{t("ac.currentcontribution")}: {eur(d.cost)}</p>
                  {canManage(sponsors.find((s) => s.id === d.sponsorId)) && (
                    <div className="gr-actions">
                      <button
                        className="gr-btn-ghost gr-danger"
                        onClick={() =>
                          ask(
                            t("dlg.resetacceptask"),
                            async () => {
                              try {
                                const saved = await dealsApi.updateDeal(d.id, { acceptance: null });
                                setData((prev) => ({
                                  ...prev,
                                  deals: prev.deals.map((x) => (x.id === d.id ? saved : x)),
                                }));
                                setSaveErr(false);
                                setModal(null);
                              } catch (e) {
                                failWith(e);
                              }
                            },
                            { title: t("dlg.resetaccepttitle"), confirmLabel: t("dlg.reset") },
                          )
                        }
                      >
                        {t("ac.reqnew")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </Modal>
          );
        })()}
      {modal?.type === "examples" && (
        <Modal title={t("md.examples")} onClose={() => setModal(null)} wide lang={uiLang}>
          <ExampleImagesManager onClose={() => setModal(null)} t={t} lang={uiLang} />
        </Modal>
      )}
      {modal?.type === "vatlookup" && (
        <Modal title={t("md.vatlookup")} onClose={() => setModal(null)} lang={uiLang}>
          <VatLookupSettings
            value={data.settings?.vatLookup || defaultVatLookup}
            onSave={(cfg) => saveSettings({ vatLookup: cfg })}
            onCancel={() => setModal(null)}
            t={t}
          />
        </Modal>
      )}
      {modal?.type === "tickoweb" && (
        <Modal title={t("md.tickoweb")} onClose={() => setModal(null)} wide lang={uiLang}>
          <TickowebSettings
            t={t}
            lang={uiLang}
            value={data.settings?.tickoweb || defaultTickoweb}
            onSave={(cfg) => saveSettings({ tickoweb: cfg })}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "user" && (
        <Modal title={t(modal.payload ? "md.editaccount" : "md.newaccount")} onClose={() => setModal(null)} lang={uiLang}>
          <UserForm
            t={t}
            lang={uiLang}
            initial={modal.payload}
            existing={users}
            isOnlyAdmin={
              !!modal.payload && isAdmin(modal.payload as User) && users.filter(isAdmin).length <= 1
            }
            onSave={saveUser}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "import" && admin && (
        <ImportModal
          sponsors={sponsors}
          onImport={importSponsors}
          onClose={() => setModal(null)}
          t={t}
          lang={uiLang}
        />
      )}
      {modal?.type === "edition" && (
        <Modal title={t(modal.payload ? "md.editedition" : "md.newedition")} onClose={() => setModal(null)} lang={uiLang}>
          <EditionForm initial={modal.payload} onSave={saveEdition} onCancel={() => setModal(null)} t={t} />
        </Modal>
      )}
      {modal?.type === "formula" && (
        <Modal title={t(modal.payload.formula ? "md.editformula" : "md.newformula")} onClose={() => setModal(null)} wide lang={uiLang}>
          <FormulaForm
            t={t}
            lang={uiLang}
            initial={modal.payload.formula}
            onSave={(f) => saveFormula(modal.payload.editionId, f, modal.payload.formula?.name)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "deal" && (
        <Modal title={modal.payload?.id ? t("df.edittitle") : t("df.newtitle")} onClose={() => setModal(null)} wide>
          <DealForm
            key={modal.payload?.id || "new"}
            initial={modal.payload}
            sponsors={sponsors}
            pickableSponsors={manageableSponsors}
            editions={editions}
            deals={deals}
            teamMembers={users}
            defaultResponsibleId={me?.id}
            onSave={saveDeal}
            onCancel={() => setModal(null)}
            onAddSponsor={addSponsorInline}
            onOpenDeal={(d) => setModal({ type: "deal", payload: d })}
            vatCfg={data.settings?.vatLookup || defaultVatLookup}
            t={t}
            lang={uiLang}
            onDelete={admin ? deleteDeal : undefined}
          />
        </Modal>
      )}
      {modal?.type === "decline" && (
        <Modal title={t("dc.title")} onClose={() => setModal(null)} lang={uiLang}>
          <DeclineForm
            sponsor={sponsors.find((x) => x.id === modal.payload.sponsorId)}
            editions={sortedEditions.filter(
              (e) =>
                !deals.some((d) => d.sponsorId === modal.payload.sponsorId && d.editionId === e.id) &&
                !declines.some((x) => x.sponsorId === modal.payload.sponsorId && x.editionId === e.id),
            )}
            t={t}
            onSave={(editionId, reason) => saveDecline(modal.payload.sponsorId, editionId, reason)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "email" &&
        (() => {
          const d = deals.find((x) => x.id === modal.payload.id) || modal.payload;
          const s = sponsors.find((x) => x.id === d.sponsorId);
          const e = editions.find((x) => x.id === d.editionId);
          if (!s || !e) return null;
          return (
            <EmailModal
              t={t}
              deal={d}
              sponsor={s}
              edition={e}
              onClose={() => setModal(null)}
              onMarkSent={(edited) =>
                edited
                  ? ask(t("dlg.marksentask"), () => markEmailSent(d.id), {
                      title: t("dlg.marksenttitle"),
                      confirmLabel: t("vo.marksent"),
                      danger: false,
                    })
                  : markEmailSent(d.id)
              }
              onSent={(sentAt) => noteEmailSent(d.id, sentAt)}
              onAddContact={commitContact}
            />
          );
        })()}
      {/* Last, so a failed save shows on top of the modal it came from rather
         than behind it — every .gr-overlay shares one z-index. */}
      <ConfirmDialog dialog={dialog} onClose={() => setDialog(null)} t={t} lang={uiLang} />
    </div>
  );
}
