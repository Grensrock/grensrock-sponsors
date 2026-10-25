"use client";

import { useState, useSyncExternalStore } from "react";
import EmailInput from "@/components/ui/EmailInput";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import Tag from "@/components/ui/Tag";
import { fmtDateTime } from "@/lib/acceptance";
import { sendAgreementEmail } from "@/lib/api/deals";
import { awaitsApproval } from "@/lib/benefits";
import { ACCEPT_PATH, LANGS, emptyContact, uid } from "@/lib/constants";
import { contactName, contactsFor, sponsorContacts } from "@/lib/contacts";
import { buildEmail, renderAgreementHtml } from "@/lib/email-templates";
import { emailToStore, sameEmail, validateEmail } from "@/lib/email-validate";
import { userName } from "@/lib/users";
import type { Contact, Deal, Edition, Language, PendingMail, Sponsor, TranslateFn, User } from "@/types";

/* ---------- Sending the confirmation email / contract ----------
   The team picks who it goes to, reads it, edits it if they want, and
   sends it from here. Everything below is about those three things.

   The message carries the link the sponsor accepts through, so the
   recipients are not incidental: a contact with no portal access can
   read the mail but cannot act on it. The route fixes that at send time
   (see app/api/deals/send-agreement) — this modal only says so, rather
   than making the team go and activate people first.

   While the agreement's benefits wait for an admin (0026), a team member's
   Send prepares the mail instead: the route holds it, and it goes out when
   an admin approves. An admin's Send is that approval, and sends. */

const canMail = (c: Contact) => !!validateEmail(c.email)?.valid;

/* The page's own origin never changes while the modal is open, so there is
   nothing to subscribe to; these exist only to give useSyncExternalStore its
   three arguments. */
const subscribeNever = () => () => {};
const readOrigin = () => window.location.origin;
const readNoOrigin = () => "";

export default function EmailModal({
  deal,
  sponsor,
  edition,
  responsible,
  onClose,
  onMarkSent,
  onSent,
  onHeld,
  onAddContact,
  admin,
  prepared,
  t = (k) => k,
}: {
  deal: Deal;
  sponsor: Sponsor;
  edition: Edition;
  /** The sponsor's responsible, who is put in Cc. */
  responsible?: User | null;
  onClose: () => void;
  /** Records the mail as sent without sending it. `edited` says the text was
      changed here, which is worth a question first: closing on it drops the edit. */
  onMarkSent: (edited: boolean) => void;
  /** The send succeeded; the agreement is already marked sent server-side. */
  onSent: (sentAt: string) => void;
  /** The mail was held until the benefits are approved, not sent. */
  onHeld?: () => void;
  admin?: boolean;
  /** A mail written before, to start from: the one held on the agreement, or
      one that was held but could not go out on approval. */
  prepared?: Partial<PendingMail> | null;
  /** Saves a brand-new contact on this sponsor and hands it back with its real id. */
  onAddContact: (sponsorId: string, contact: Contact) => Promise<Contact | null>;
  t?: TranslateFn;
}) {
  const all = sponsorContacts(sponsor).filter(canMail);
  const waiting = awaitsApproval(deal);
  const holds = waiting && !admin;
  const start = prepared || (waiting ? deal.pendingMail : null);

  /* The contract is invoicing-related, so it starts aimed at the invoicing
     contacts, falling back to whoever receives general information. It is only
     a starting point now — the team can tick anyone. A mail written before
     starts where it was left. */
  const [picked, setPicked] = useState<string[]>(() => {
    const before = (start?.contactIds || []).filter((id) => all.some((c) => c.id === id));
    if (before.length) return before;
    const invoice = contactsFor(sponsor, "invoice").filter(canMail);
    const info = contactsFor(sponsor, "info").filter(canMail);
    return (invoice.length ? invoice : info).map((c) => c.id);
  });
  const recipients = all.filter((c) => picked.includes(c.id));

  /* Mirrors the route: no Cc without a usable address, nor for someone who is
     already one of the recipients. */
  const cc =
    responsible &&
    validateEmail(responsible.email)?.valid &&
    !recipients.some((c) => sameEmail(c.email, responsible.email))
      ? responsible
      : null;

  /* Where the sponsor lands to accept. Shown bare here: on sending, each
     recipient's copy gets their own token on it, which signs them in and opens
     the portal on "Sponsoring" with the acceptance box (app/auth/accept).

     Read through useSyncExternalStore rather than inline: window.location has
     no server-side counterpart, so reading it during render makes the first
     client pass disagree with the server's and React throws the tree away.
     This gives the server "" and the client the real origin, which is exactly
     what the hook is for. It never changes, hence the no-op subscribe. */
  const origin = useSyncExternalStore(subscribeNever, readOrigin, readNoOrigin);
  const acceptUrl = origin ? origin + ACCEPT_PATH : undefined;

  /* The contact being added below is ticked the moment it is saved, so the
     preview already counts them in: picking their language rewrites the mail
     while the form is still open, instead of it staying in Dutch until then. */
  const [pending, setPending] = useState<Contact | null>(null);

  /* Rebuilt every render rather than memoised: it is string concatenation over
     a handful of fields, and the cache key would have to be the recipient list,
     which is a fresh array each time anyway. */
  const built = buildEmail(
    deal,
    sponsor,
    edition,
    pending ? [...recipients, pending] : recipients,
    acceptUrl,
  );

  /* null means "still following the agreement". Once the team types, their
     text stands — silently regenerating over an edit would be the modal
     throwing away work while they are looking at it. The draft keeps the
     language it was written in, which the button in the mail is worded in,
     even if the recipients change under it. */
  const [draft, setDraft] = useState<{ subject: string; body: string; lang: Language } | null>(() =>
    start?.subject && start?.body ? { subject: start.subject, body: start.body, lang: start.language || "nl" } : null,
  );
  const subject = draft ? draft.subject : built.subject;
  const body = draft ? draft.body : built.body;
  const lang = draft ? draft.lang : built.lang;
  const edit = (patch: Partial<{ subject: string; body: string }>) =>
    setDraft({ subject, body, lang, ...patch });
  const [editing, setEditing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ to: string[]; cc: string | null; warnings: string[]; held: boolean } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(all.length === 0);

  const to = recipients.map((c) => c.email).join(",");
  const ccParam = cc ? `cc=${encodeURIComponent(cc.email)}&` : "";
  const mailto = `mailto:${encodeURIComponent(to)}?${ccParam}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${to}\n${cc ? `Cc: ${cc.email}\n` : ""}Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const mixedLangs = new Set(recipients.map((c) => c.language || "nl")).size > 1;
  const needInvite = recipients.filter((c) => !c.portalAccess);

  const send = async () => {
    if (busy || recipients.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      const res = await sendAgreementEmail(deal.id, recipients.map((c) => c.id), subject, body, lang);
      setDone({ to: res.to, cc: res.cc, warnings: res.warnings, held: res.held });
      if (res.held) onHeld?.();
      else onSent(res.sentAt);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("em.title")} onClose={onClose} wide>
      {done ? (
        /* Sent. The agreement is already marked, so there is nothing left to
           do here but say what happened. */
        <>
          <p className="gr-blockbanner" style={{ background: "#E7F4EC", color: "var(--green)" }}>
            {done.held
              ? t("em.heldto", { to: done.to.join(", ") })
              : done.cc
                ? t("em.senttocc", { to: done.to.join(", "), cc: done.cc })
                : t("em.sentto", { to: done.to.join(", ") })}
          </p>
          {done.warnings.map((w, i) => (
            <p key={i} className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
              {w}
            </p>
          ))}
          <div className="gr-actions">
            <button className="gr-btn" onClick={onClose}>
              {t("common.done")}
            </button>
          </div>
        </>
      ) : (
        <>
          {waiting && (
            <p className="gr-blockbanner" style={{ background: "#FBEBDD", color: "var(--orange-deep)" }}>
              {holds ? t("em.holdintro") : t("em.adminapproves")}
              {holds && deal.pendingMail && (
                <>
                  {" "}
                  {t("em.alreadyheld", {
                    by: deal.pendingMail.heldBy || "?",
                    when: fmtDateTime(deal.pendingMail.heldAt),
                  })}
                </>
              )}
            </p>
          )}
          {all.length === 0 && <p className="gr-blockbanner">{t("em.nocontactsyet")}</p>}

          {all.length > 0 && (
            <Field
              group
              label={t("em.recipients")}
              hint={mixedLangs ? t("em.mixedlangs", { lang: LANGS[recipients[0]?.language || "nl"] }) : undefined}
            >
              <div className="gr-checkrow" style={{ paddingTop: 4 }}>
                {all.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <label key={c.id} className={"gr-check gr-check-sm gr-check-recipient" + (on ? " on" : "")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))
                        }
                      />
                      <span className="gr-check-who">
                        {contactName(c) || c.email} ({(c.language || "nl").toUpperCase()})
                      </span>
                      {!c.portalAccess && <Tag>{t("em.noportal")}</Tag>}
                    </label>
                  );
                })}
              </div>
            </Field>
          )}

          {!adding && (
            <button className="gr-mini" onClick={() => setAdding(true)} style={{ marginBottom: 10 }}>
              {t("em.addcontact")}
            </button>
          )}
          {adding && (
            <NewContactInline
              sponsor={sponsor}
              t={t}
              onChange={setPending}
              onCancel={
                all.length === 0
                  ? undefined
                  : () => {
                      setAdding(false);
                      setPending(null);
                    }
              }
              onSave={async (c) => {
                const saved = await onAddContact(sponsor.id, c);
                if (!saved) return false;
                setPicked((p) => [...p, saved.id]);
                setAdding(false);
                setPending(null);
                return true;
              }}
            />
          )}

          {recipients.length > 0 && (
            <p className="gr-muted">
              {t("em.personal")}
              {needInvite.length > 0 && <> {t("em.willinvite")}</>}
            </p>
          )}
          {recipients.length > 0 && cc && (
            <p className="gr-muted">{t("em.cc", { name: userName(cc) || cc.email })}</p>
          )}
          {recipients.length === 0 && all.length > 0 && (
            <p className="gr-muted" style={{ color: "var(--red)" }}>
              {t("em.pickone")}
            </p>
          )}

          {/* The text is what gets edited, but the sponsor sees it laid out,
              with the link as a button — so that is what the modal shows until
              the team asks for the text. The preview is laid out from the same
              text by the same function as the mail that goes out. */}
          <Field label={t("em.subject")}>
            <input value={subject} onChange={(e) => edit({ subject: e.target.value })} />
          </Field>
          <Field label={t("em.body")} hint={draft ? t("em.edited") : undefined}>
            {editing ? (
              <textarea
                className="gr-emailedit"
                rows={16}
                value={body}
                onChange={(e) => edit({ body: e.target.value })}
              />
            ) : (
              <MailPreview html={renderAgreementHtml(body, subject, lang, acceptUrl)} title={subject} />
            )}
          </Field>
          <div className="gr-sendalt-row">
            <button className="gr-mini" onClick={() => setEditing((on) => !on)}>
              {editing ? t("em.preview") : t("em.edit")}
            </button>
            {draft && (
              <button className="gr-mini" onClick={() => setDraft(null)}>
                {t("em.rebuild")}
              </button>
            )}
          </div>

          {err && <p className="gr-blockbanner">{t("em.sendfailed")}: {err}</p>}

          {/* Sending it some other way, kept apart from Send. In one row with it,
              a phone stacked "Mark as sent" directly above Send, and what it
              meant was only a tooltip, which a phone never shows — so it read
              as a second send button that sends nothing. Not offered while the
              benefits wait: each would be a way round the approval. */}
          {!waiting && (
            <div className="gr-sendalt">
              <div className="gr-sendalt-row">
                <button className="gr-mini" onClick={copy}>
                  {copied ? t("em.copied") : t("em.copy")}
                </button>
                {recipients.length > 0 && (
                  <a className="gr-mini gr-btn-link" href={mailto}>
                    {t("vo.openmail")}
                  </a>
                )}
              </div>
              <div className="gr-sendalt-row">
                <button className="gr-mini" onClick={() => onMarkSent(!!draft)}>
                  {t("vo.marksent")}
                </button>
                <span className="gr-muted">{t("em.marksenthint")}</span>
              </div>
            </div>
          )}

          <div className="gr-actions">
            <button className="gr-btn" onClick={send} disabled={busy || recipients.length === 0}>
              {busy ? t(holds ? "em.holding" : "em.sending") : t(holds ? "em.hold" : "em.send")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- the mail as the sponsor sees it ----------
   In a frame, so the mail's own styles neither leak into the app nor pick
   up the app's. Sandboxed without scripts — there are none — and grown to
   the mail's height rather than scrolling inside a modal that scrolls. The
   frame has to share the page's origin for its height to be readable; with
   no scripts allowed in it, that gives the mail nothing. Its links open
   nothing: in the preview the accept link is the bare one, without a token. */
function MailPreview({ html, title }: { html: string; title: string }) {
  const [height, setHeight] = useState(520);
  const measure = (frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    if (!doc) return;
    setHeight(doc.documentElement.scrollHeight);
    /* The web fonts arrive after the first layout and change line breaks. */
    doc.fonts?.ready.then(() => setHeight(doc.documentElement.scrollHeight));
  };
  return (
    <iframe
      className="gr-mailpreview"
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin"
      style={{ height }}
      onLoad={(e) => measure(e.currentTarget)}
    />
  );
}

/* ---------- adding a contact without leaving the send ----------
   Deliberately smaller than NewContactModal: the sponsor is already known,
   and portal access is left off because sending is what grants it. Asking
   for it here would be a second way to do the same thing, one of which
   sends an extra email. */
function NewContactInline({
  sponsor,
  onSave,
  onChange,
  onCancel,
  t,
}: {
  sponsor: Sponsor;
  onSave: (c: Contact) => Promise<boolean>;
  /** Every edit, so the mail preview can follow the contact before it is saved. */
  onChange: (c: Contact) => void;
  onCancel?: () => void;
  t: TranslateFn;
}) {
  const [c, setC] = useState<Contact>({ id: "", ...emptyContact, prefs: { info: true, invoice: true } });
  const [busy, setBusy] = useState(false);
  const set =
    (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const next = { ...c, [k]: e.target.value } as Contact;
      setC(next);
      onChange(next);
    };

  const mail = validateEmail(c.email);
  const emailOk = !!c.email && !!mail && mail.valid;
  const dupe = emailOk ? sponsorContacts(sponsor).find((x) => x.email && sameEmail(x.email, c.email)) : null;
  const valid = (c.firstName.trim() || c.lastName.trim()) && emailOk && !dupe;

  return (
    <div className="gr-inlineform">
      <div className="gr-grid2">
        <Field label={t("uf.firstname").replace(" *", "")}>
          <input value={c.firstName} onChange={set("firstName")} placeholder="Jan" autoFocus />
        </Field>
        <Field label={t("uf.lastname")}>
          <input value={c.lastName} onChange={set("lastName")} placeholder="Peeters" />
        </Field>
      </div>
      <div className="gr-grid2">
        <Field label={t("c.email")}>
          <EmailInput value={c.email} onChange={set("email")} />
        </Field>
        <Field label={t("c.language")}>
          <select value={c.language} onChange={set("language")}>
            {Object.entries(LANGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {dupe && (
        <p className="gr-blockbanner">
          {sponsor.companyName} {t("nc.dupehas")} {c.email} ({contactName(dupe) || "?"}). {t("nc.dupeblock")}
        </p>
      )}
      <div className="gr-actions">
        {onCancel && (
          <button className="gr-btn-ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
        <button
          className="gr-btn"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave({ ...c, id: uid(), email: emailToStore(c.email), portalAccess: false });
            if (!ok) setBusy(false);
          }}
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
