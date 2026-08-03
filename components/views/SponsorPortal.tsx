"use client";

import { useEffect, useState } from "react";
import ContactForm from "@/components/forms/ContactForm";
import VoucherEditor from "@/components/forms/VoucherEditor";
import ReturnExamples from "@/components/modals/ReturnExamples";
import EmailInput from "@/components/ui/EmailInput";
import Field from "@/components/ui/Field";
import LogoUploader from "@/components/ui/LogoUploader";
import Modal from "@/components/ui/Modal";
import PickLogo from "@/components/ui/PickLogo";
import Tag from "@/components/ui/Tag";
import VatInput from "@/components/ui/VatInput";
import { fmtDateTime, isAccepted } from "@/lib/acceptance";
import { COMMS, COMM_LABELS, DRINK_TICKET_VALUE, VOUCHER_STATUS, VOUCHER_TYPES, uid, type CommKey } from "@/lib/constants";
import { contactName, primaryContact, sponsorContacts } from "@/lib/contacts";
import { emailToStore, validateEmail } from "@/lib/email-validate";
import { defaultVatLookup } from "@/lib/integrations/vat-lookup";
import { eur, foodDrinkExtra, invoiceAmount } from "@/lib/money";
import { validateVat, vatToStore } from "@/lib/vat";
import {
  benefitLines,
  drinkPoolValue,
  returnTypesOf,
  ticketLines,
  visibilityLines,
} from "@/lib/vouchers";
import type {
  Contact,
  Deal,
  Edition,
  Language,
  NumLike,
  Sponsor,
  VatLookupConfig,
  Voucher,
  VoucherRow,
} from "@/types";
import type { ReturnExampleType } from "@/lib/constants";

/* ---------- Sponsor self-service portal ---------- */

type DealWithEdition = Deal & { edition?: Edition };

export default function SponsorPortal({
  sponsor,
  asContact,
  deals,
  editions,
  vouchers = [],
  vatCfg = defaultVatLookup,
  onSaveSponsor,
  onAssignVoucher,
  onRequestFormula,
  onUpdateSplit,
  onUpdateExtra,
  onAcceptAgreement,
  onExit,
}: {
  sponsor: Sponsor;
  asContact?: Contact | null;
  deals: Deal[];
  editions: Edition[];
  vouchers?: Voucher[];
  vatCfg?: VatLookupConfig;
  onSaveSponsor: (id: string, patch: Partial<Sponsor>) => void;
  onAssignVoucher: (id: string, patch: Partial<Voucher>) => void;
  onRequestFormula: (editionId: string, formulaName: string, byName: string) => void;
  onUpdateSplit: (dealId: string, pool: "drink" | "food", rows: VoucherRow[]) => void;
  onUpdateExtra: (dealId: string, patch: Partial<Deal>) => void;
  onAcceptAgreement: (dealId: string) => void;
  onExit: () => void;
}) {
  /* Agreements on active editions still waiting for the sponsor's acceptance.
     Computed before the state so the portal can open straight on them. */
  const toAccept: DealWithEdition[] = deals
    .filter((d) => d.sponsorId === sponsor.id && !isAccepted(d))
    .map((d) => ({ ...d, edition: editions.find((e) => e.id === d.editionId) }))
    .filter((d) => d.edition?.active);

  const [sub, setSub] = useState(toAccept.length > 0 ? "sponsoring" : "info");
  const [chosen, setChosen] = useState<{
    editionId: string;
    name: string;
    edName: string;
    cost: NumLike;
  } | null>(null);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [readTerms, setReadTerms] = useState<Record<string, boolean>>({});
  const [topUpDraft, setTopUpDraft] = useState<Record<string, NumLike>>({});
  const [assigning, setAssigning] = useState<Voucher | null>(null);
  const [assignDraft, setAssignDraft] = useState({ name: "", email: "" });
  /* A sponsor only sees vouchers once they have actually been created and sent.
     Cancelled ones stay visible if they had been sent, so a disappearance is never silent. */
  const myVouchers = vouchers
    .filter((v) => v.sponsorId === sponsor.id)
    .filter((v) => v.status === "sent" || (v.status === "cancelled" && v.sentAt))
    .sort((a, b) => (a.type || "").localeCompare(b.type || ""));
  useEffect(() => {
    if (assigning) setAssignDraft({ name: assigning.recipientName || "", email: assigning.recipientEmail || "" });
  }, [assigning]);

  const [s, setS] = useState<Sponsor>({ ...sponsor });
  /* Contacts come from the prop, not from `s`. They are saved the moment they
     change, so a local copy only goes stale — and a stale copy still carries
     the client-generated id of anything added this session, which the upsert
     RPC reads as "no id" and inserts a second time. `s` keeps only the fields
     behind the Save button. */
  const contacts = sponsorContacts(sponsor);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Sponsor) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setS({ ...s, [k]: e.target.value } as Sponsor);
    setSaved(false);
  };
  /* Portal language follows the contact who logged in */
  const lang: Language = asContact?.language || primaryContact(sponsor)?.language || "nl";
  const T = (nl: string, fr: string, en: string) => ({ nl, fr, en })[lang];

  const history: DealWithEdition[] = deals
    .filter((d) => d.sponsorId === sponsor.id)
    .map((d) => ({ ...d, edition: editions.find((e) => e.id === d.editionId) }))
    .sort((a, b) => (b.edition?.startDate || "").localeCompare(a.edition?.startDate || ""));

  /* Per agreement and per pool: may the sponsor still divide, or were the vouchers already created? */
  const created = (dealId: string, type: string) =>
    vouchers.some((v) => v.dealId === dealId && v.type === type && v.status !== "pending");
  const myActiveDeals: DealWithEdition[] = deals
    .filter((d) => d.sponsorId === sponsor.id)
    .map((d) => ({ ...d, edition: editions.find((e) => e.id === d.editionId) }))
    .filter((d) => d.edition?.active);
  const splittable = myActiveDeals
    .map((d) => ({
      deal: d,
      drink: Number(d.drinkTickets) > 0 && !created(d.id, "drink"),
      food: Number(d.foodDrinkValue) > 0 && !created(d.id, "food"),
      // top-up is possible until the food vouchers are created (it changes the food total)
      canTopUp: !created(d.id, "food"),
    }))
    .filter((x) => x.drink || x.food || x.canTopUp);
  const lockedSplits = myActiveDeals.filter(
    (d) =>
      (Number(d.drinkTickets) > 0 && created(d.id, "drink")) ||
      (Number(d.foodDrinkValue) > 0 && created(d.id, "food")),
  );

  /* Active editions this sponsor has no agreement for yet — they can pick a formula themselves */
  const openEditions = editions.filter(
    (e) =>
      e.active &&
      (e.formulas || []).length > 0 &&
      !deals.some((d) => d.sponsorId === sponsor.id && d.editionId === e.id),
  );

  const vatRes = validateVat(s.vatNumber);
  const contactsOk = contacts.every((c) => {
    const r = validateEmail(c.email);
    return !r || r.valid;
  });
  const save = () => {
    if ((vatRes && !vatRes.valid) || !contactsOk) return; // button is disabled, extra guard
    // Sponsors can edit their own info, never team-side fields
    const { responsible: _responsible, id: _id, ...rest } = s;
    onSaveSponsor(sponsor.id, {
      ...rest,
      vatNumber: vatToStore(s.vatNumber),
      /* Deliberately no contacts: they have their own save path, and sending
         them here re-upserted the whole list on every company-details save. */
    });
    setSaved(true);
  };

  /* Contacts are saved straight away, not via the Save button */
  /* The whole list goes back every time — portalSaveSponsor treats anything
     missing from it as deleted — and it is rebuilt from the prop, so nothing
     carries a client-generated id that the database has already replaced. */
  const saveContact = (c: Contact) => {
    const next = contacts.some((x) => x.id === c.id) ? contacts.map((x) => (x.id === c.id ? c : x)) : [...contacts, c];
    onSaveSponsor(sponsor.id, { contacts: next });
  };
  const removeContact = (cid: string) => {
    onSaveSponsor(sponsor.id, { contacts: contacts.filter((x) => x.id !== cid) });
  };

  const TABS: Array<[string, string]> = [
    ["info", T("Gegevens", "Données", "Information")],
    ["contacts", `${T("Contactpersonen", "Contacts", "Contact persons")} (${contacts.length})`],
    ["sponsoring", `${T("Sponsoring", "Sponsoring", "Sponsorship")} (${history.length})`],
    [
      "vouchers",
      `${T("Tickets & bonnen", "Tickets & bons", "Tickets & vouchers")} (${
        myVouchers.filter((v) => v.status !== "cancelled").length
      })`,
    ],
  ];

  const saveBar = (
    <div className="gr-actions" style={{ justifyContent: "flex-start" }}>
      <button className="gr-btn" disabled={!!(vatRes && !vatRes.valid) || !contactsOk} onClick={save}>
        {T("Gegevens opslaan", "Enregistrer", "Save details")}
      </button>
      {saved && <Tag tone="green">{T("Opgeslagen ✓", "Enregistré ✓", "Saved ✓")}</Tag>}
    </div>
  );

  return (
    <div className="gr-root">
      <header className="gr-header">
        <div className="gr-brand">
          <PickLogo size={54} />
          <span className="gr-brandsub">{T("Sponsorportaal", "Portail sponsors", "Sponsor portal")}</span>
        </div>
        <button className="gr-btn-ghost gr-exit" onClick={onExit}>
          {T("Afsluiten", "Quitter", "Exit")}
        </button>
      </header>
      <div className="gr-borderline" aria-hidden="true" />
      <main className="gr-main" style={{ maxWidth: 820 }}>
        <h2 className="gr-h2">{sponsor.companyName}</h2>
        <p className="gr-muted">
          {T(
            "Kijk uw gegevens na, pas ze aan waar nodig en laad uw logo op. Bedankt voor uw steun aan Grensrock!",
            "Vérifiez vos données, modifiez-les si nécessaire et téléchargez votre logo. Merci pour votre soutien à Grensrock !",
            "Review your details, update them where needed and upload your logo. Thank you for supporting Grensrock!",
          )}
        </p>

        {toAccept.length > 0 && (
          <div className="gr-acceptbanner">
            <div>
              <strong>
                {toAccept.length === 1
                  ? T(
                      "U heeft nog een overeenkomst te bevestigen",
                      "Vous avez un accord à confirmer",
                      "You have an agreement to confirm",
                    )
                  : T(
                      `U heeft nog ${toAccept.length} overeenkomsten te bevestigen`,
                      `Vous avez ${toAccept.length} accords à confirmer`,
                      `You have ${toAccept.length} agreements to confirm`,
                    )}
              </strong>
              <div className="gr-muted">
                {toAccept
                  .map((d) => d.edition?.name)
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button className="gr-btn" onClick={() => setSub("sponsoring")}>
              {T("Nakijken en bevestigen", "Consulter et confirmer", "Review and confirm")}
            </button>
          </div>
        )}

        <nav className="gr-subnav">
          {TABS.map(([k, l]) => (
            <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}>
              {l}
              {k === "sponsoring" && toAccept.length > 0 && (
                <span className="gr-tabdot" title="Action required">
                  ●
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* ---- Information ---- */}
        {sub === "info" && (
          <>
            <h4 className="gr-subhead" style={{ borderTop: "none", paddingTop: 0 }}>
              Logo
            </h4>
            <p className="gr-muted" style={{ marginBottom: 8 }}>
              {T(
                "Uw logo gebruiken we voor de folder, ledboarding, website, ... Laad bij voorkeur een versie met transparante achtergrond op (PNG of SVG).",
                "Votre logo sera utilisé pour le dépliant, le ledboarding, le site web, ... Téléchargez de préférence une version à fond transparent (PNG ou SVG).",
                "Your logo is used for the folder, LED boarding, website, ... Preferably upload a version with a transparent background (PNG or SVG).",
              )}
            </p>
            <LogoUploader sponsorId={sponsor.id} />

            <h4 className="gr-subhead">{T("Bedrijfsgegevens", "Données de l'entreprise", "Company details")}</h4>
            <div className="gr-grid2">
              <Field label={T("Bedrijf / naam", "Société / nom", "Company / name")}>
                <input value={s.companyName} onChange={set("companyName")} />
              </Field>
              <Field label={T("BTW-nummer", "Numéro de TVA", "VAT number")}>
                <VatInput
                  value={s.vatNumber}
                  onChange={set("vatNumber")}
                  lang={lang}
                  cfg={vatCfg}
                  current={s}
                  /* entityType is deliberately left alone: the portal RPC can't
                     write it (see update_sponsor_info in 0004_rpc.sql). */
                  onApply={(patch) => {
                    setS((prev) => ({ ...prev, ...patch }));
                    setSaved(false);
                  }}
                />
              </Field>
            </div>
            <div className="gr-gridaddr">
              <Field label={T("Straat", "Rue", "Street")}>
                <input value={s.street || ""} onChange={set("street")} />
              </Field>
              <Field label={T("Nummer", "Numéro", "Number")}>
                <input value={s.houseNumber || ""} onChange={set("houseNumber")} />
              </Field>
            </div>
            <div className="gr-gridaddr">
              <Field label={T("Postcode", "Code postal", "Postal code")}>
                <input value={s.postalCode || ""} onChange={set("postalCode")} />
              </Field>
              <Field label={T("Gemeente", "Commune", "City")}>
                <input value={s.city || ""} onChange={set("city")} />
              </Field>
            </div>
            <Field
              label={T(
                "Wie ontvangt de tickets & bonnen?",
                "Qui reçoit les tickets & bons ?",
                "Who receives the tickets & vouchers?",
              )}
              hint={T(
                "Eén contactpersoon ontvangt de bonnen voor uw bedrijf.",
                "Une seule personne de contact reçoit les bons pour votre entreprise.",
                "One contact person receives the vouchers for your company.",
              )}
            >
              <select
                value={s.voucherContactId || ""}
                onChange={(e) => {
                  setS({ ...s, voucherContactId: e.target.value });
                  setSaved(false);
                }}
              >
                <option value="">
                  {T("Automatisch (eerste contactpersoon)", "Automatique (premier contact)", "Automatic (first contact)")}
                </option>
                {contacts
                  .filter((c) => c.email)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactName(c) || c.email} · {c.email}
                    </option>
                  ))}
              </select>
            </Field>
            <label className={"gr-check" + (s.refRequired ? " on" : "")} style={{ marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={!!s.refRequired}
                onChange={(e) => {
                  setS({ ...s, refRequired: e.target.checked });
                  setSaved(false);
                }}
              />
              {T(
                "Wij hebben een referentie (bestelbon, PO-nummer, kostenplaats) nodig op de factuur",
                "Nous avons besoin d'une référence (bon de commande, numéro PO, centre de coûts) sur la facture",
                "We need a reference (purchase order, PO number, cost centre) on the invoice",
              )}
            </label>
            {saveBar}
          </>
        )}

        {/* ---- Contact persons ---- */}
        {sub === "contacts" && (
          <>
            <p className="gr-muted" style={{ marginBottom: 8 }}>
              {T(
                "Voeg gerust collega's toe en duid aan welke communicatie ieder van hen wil ontvangen. Klik op een lijn om de gegevens aan te passen. Geef een collega toegang tot dit portaal met 'Uitnodigen'.",
                "N'hésitez pas à ajouter des collègues et à indiquer quelles communications chacun souhaite recevoir. Cliquez sur une ligne pour modifier. Donnez accès à ce portail à un collègue avec « Inviter ».",
                "Feel free to add colleagues and set which communications each wants. Click a row to edit. Give a colleague access to this portal with 'Invite'.",
              )}
            </p>
            <div className="gr-toolbar">
              <span className="gr-muted">
                {contacts.length} {T("contactpersonen", "personnes de contact", "contact persons")}
              </span>
              <button className="gr-btn" onClick={() => setEditingContact({})}>
                + {T("Contactpersoon toevoegen", "Ajouter un contact", "Add contact")}
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="gr-empty">
                {T("Nog geen contactpersonen.", "Aucune personne de contact.", "No contact persons yet.")}
              </p>
            ) : (
              <div className="gr-tablewrap">
                <table className="gr-table gr-clickable">
                  <thead>
                    <tr>
                      <th>{T("Naam", "Nom", "Name")}</th>
                      <th>{T("E-mail", "E-mail", "Email")}</th>
                      <th>{T("Taal", "Langue", "Language")}</th>
                      <th>{T("Toegang", "Accès", "Access")}</th>
                      <th>{T("Ontvangt", "Reçoit", "Receives")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c, i) => (
                      <tr
                        key={c.id || i}
                        onClick={() => setEditingContact(c)}
                        title={T("Klik om aan te passen", "Cliquez pour modifier", "Click to edit")}
                      >
                        <td>
                          <strong>{contactName(c) || <span className="gr-muted">—</span>}</strong>
                          {asContact && c.id === asContact.id && (
                            <span className="gr-muted"> · {T("u", "vous", "you")}</span>
                          )}
                        </td>
                        <td>{c.email || <span className="gr-muted">—</span>}</td>
                        <td>{(c.language || "nl").toUpperCase()}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {c.portalAccess ? (
                            <Tag tone="green">{T("actief", "actif", "active")}</Tag>
                          ) : c.email ? (
                            <button className="gr-mini" onClick={() => saveContact({ ...c, portalAccess: true })}>
                              {T("Uitnodigen", "Inviter", "Invite")}
                            </button>
                          ) : (
                            <span className="gr-muted">{T("geen e-mail", "pas d'e-mail", "no email")}</span>
                          )}
                        </td>
                        <td>
                          <div className="gr-commtags">
                            {(Object.keys(COMMS) as CommKey[])
                              .filter((k) => c.prefs?.[k])
                              .map((k) => (
                                <Tag key={k}>{COMM_LABELS[k][lang] || COMMS[k]}</Tag>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {editingContact && (
          <Modal
            title={
              editingContact.id
                ? T("Contactpersoon aanpassen", "Modifier le contact", "Edit contact person")
                : T("Nieuwe contactpersoon", "Nouveau contact", "New contact person")
            }
            onClose={() => setEditingContact(null)}
          >
            <ContactForm
              initial={editingContact.id ? (editingContact as Contact) : undefined}
              lang={lang}
              onSave={(c) => {
                saveContact(c);
                setEditingContact(null);
              }}
              onDelete={(cid) => {
                removeContact(cid);
                setEditingContact(null);
              }}
              onCancel={() => setEditingContact(null)}
            />
          </Modal>
        )}

        {/* ---- Sponsorship ---- */}
        {sub === "sponsoring" && (
          <>
            {openEditions.map((ed) => (
              <div key={ed.id} className="gr-choosebox">
                <h4 className="gr-h3">
                  {T("Kies uw formule voor", "Choisissez votre formule pour", "Choose your formula for")} {ed.name}
                </h4>
                <p className="gr-muted">
                  {T(
                    "Selecteer de formule die u wenst. Wij bevestigen uw keuze daarna met een contract per e-mail.",
                    "Sélectionnez la formule souhaitée. Nous confirmerons ensuite votre choix par contrat par e-mail.",
                    "Select the formula you want. We'll confirm your choice afterwards with a contract by email.",
                  )}
                </p>
                <div className="gr-formulacards">
                  {(ed.formulas || []).map((f) => (
                    <div
                      key={f.name}
                      className={
                        "gr-formulacard" + (chosen?.editionId === ed.id && chosen?.name === f.name ? " on" : "")
                      }
                    >
                      <h5>{f.name}</h5>
                      <div className="gr-formulaprice">{eur(f.cost)}</div>
                      <ul>
                        {benefitLines(f, lang).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                      <button
                        className="gr-btn"
                        onClick={() => setChosen({ editionId: ed.id, name: f.name, edName: ed.name, cost: f.cost })}
                      >
                        {T("Deze formule kiezen", "Choisir cette formule", "Choose this formula")}
                      </button>
                    </div>
                  ))}
                </div>
                {(() => {
                  const types = [...new Set((ed.formulas || []).flatMap(returnTypesOf))] as ReturnExampleType[];
                  if (types.length === 0) return null;
                  return (
                    <>
                      <h5 className="gr-examplehead">
                        {T(
                          "Zo ziet uw zichtbaarheid eruit",
                          "À quoi ressemble votre visibilité",
                          "What your visibility looks like",
                        )}
                      </h5>
                      <p className="gr-muted" style={{ margin: "0 0 10px" }}>
                        {T(
                          "Voorbeelden van de zichtbaarheid die in deze formules voorkomt.",
                          "Exemples de la visibilité proposée dans ces formules.",
                          "Examples of the visibility included in these formulas.",
                        )}
                      </p>
                      <ReturnExamples types={types} lang={lang} />
                    </>
                  );
                })()}
              </div>
            ))}

            {splittable.map(({ deal: d, drink, food, canTopUp }) => (
              <div key={d.id} className="gr-choosebox">
                <h4 className="gr-h3">
                  {d.formulaName || T("Uw sponsoring", "Votre sponsoring", "Your sponsorship")}
                  {" — "}
                  {d.edition ? d.edition.name : ""}
                </h4>

                {/* FIRST: offer to top up the food & drink value. Goes straight into foodDrinkValue. */}
                {canTopUp && (
                  <div className="gr-topup">
                    <span className="gr-label">
                      {T(
                        "Extra eten- & drankbonnen toevoegen",
                        "Ajouter des bons food & boissons",
                        "Add extra food & drink tickets",
                      )}
                    </span>
                    <p className="gr-muted" style={{ margin: "0 0 10px" }}>
                      {T(
                        `Uw formule bevat ${eur(d.baseFoodDrink || 0)} aan eten- en drankbonnen. Wilt u dit verhogen? Vul hieronder de totale waarde in — het verschil wordt bij uw bijdrage geteld.`,
                        `Votre formule comprend ${eur(d.baseFoodDrink || 0)} de bons food & boissons. Vous souhaitez l'augmenter ? Indiquez la valeur totale ci-dessous — la différence s'ajoute à votre contribution.`,
                        `Your formula includes ${eur(d.baseFoodDrink || 0)} in food & drink tickets. Want to add more? Enter the total value below — the difference is added to your contribution.`,
                      )}
                    </p>
                    <div className="gr-inline-field" style={{ maxWidth: 280 }}>
                      <span className="gr-muted">€</span>
                      <input
                        type="number"
                        min={d.baseFoodDrink || 0}
                        step="0.01"
                        value={topUpDraft[d.id] ?? (d.foodDrinkValue || 0)}
                        onChange={(e) => setTopUpDraft({ ...topUpDraft, [d.id]: e.target.value })}
                        placeholder="0,00"
                      />
                      <button
                        className="gr-btn"
                        disabled={
                          Number(topUpDraft[d.id] ?? d.foodDrinkValue) === Number(d.foodDrinkValue) ||
                          Number(topUpDraft[d.id] ?? d.foodDrinkValue) < Number(d.baseFoodDrink || 0)
                        }
                        onClick={() => {
                          const val = Math.max(
                            Number(d.baseFoodDrink || 0),
                            Number(topUpDraft[d.id] ?? d.foodDrinkValue) || 0,
                          );
                          onUpdateExtra(d.id, { foodDrinkValue: val });
                        }}
                      >
                        {T("Bijwerken", "Mettre à jour", "Update")}
                      </button>
                    </div>
                    {foodDrinkExtra(d) > 0 && (
                      <p style={{ margin: "8px 0 0", color: "var(--orange-deep)", fontWeight: 600, fontSize: 13 }}>
                        {T("Extra bijdrage", "Contribution supplémentaire", "Additional contribution")}:{" "}
                        {eur(foodDrinkExtra(d))}
                      </p>
                    )}
                  </div>
                )}

                {/* THEN: divide the vouchers into portions */}
                {(drink || food) && (
                  <>
                    <p className="gr-muted" style={{ marginTop: canTopUp ? 16 : 0 }}>
                      {T(
                        "U kiest zelf in hoeveel bonnen uw bedrag wordt opgesplitst, zolang de bonnen nog niet aangemaakt zijn. Drankbonnen en bonnen voor eten & drinken blijven apart.",
                        "Vous choisissez vous-même en combien de bons votre montant est réparti, tant que les bons ne sont pas encore créés. Les bons boissons et les bons food & boissons restent séparés.",
                        "You choose how many vouchers your amount is split into, as long as the vouchers haven't been created yet. Drink vouchers and food & drink vouchers stay separate.",
                      )}
                    </p>
                    {drink && (
                      <>
                        <span className="gr-label">{T("Drankbonnen", "Bons boissons", "Drink vouchers")}</span>
                        <VoucherEditor
                          amount={drinkPoolValue(d)}
                          rows={d.drinkVouchers || []}
                          defaultUnit={DRINK_TICKET_VALUE}
                          lang={lang}
                          onChange={(rows) => onUpdateSplit(d.id, "drink", rows)}
                        />
                      </>
                    )}
                    {food && (
                      <>
                        <span className="gr-label">
                          {T("Eten & drinken", "Food & boissons", "Food & drinks")}
                          {foodDrinkExtra(d) > 0 && (
                            <>
                              {" "}
                              <Tag tone="amber">{T("incl. extra", "incl. supplément", "incl. extra")}</Tag>
                            </>
                          )}
                        </span>
                        <VoucherEditor
                          amount={d.foodDrinkValue}
                          rows={d.foodDrinkVouchers || []}
                          lang={lang}
                          onChange={(rows) => onUpdateSplit(d.id, "food", rows)}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            ))}

            {lockedSplits.map((d) => (
              <p key={d.id} className="gr-muted" style={{ marginBottom: 12 }}>
                {T("Een deel van uw bonnen voor", "Une partie de vos bons pour", "Some of your vouchers for")}{" "}
                {d.edition?.name}{" "}
                {T(
                  "is al aangemaakt en kan niet meer verdeeld worden. Contacteer ons als er toch iets moet wijzigen.",
                  "a déjà été créée et ne peut plus être répartie. Contactez-nous si quelque chose doit changer.",
                  "have already been created and can no longer be divided. Contact us if something still needs to change.",
                )}
              </p>
            ))}

            {toAccept.map((d) => (
              <div key={d.id} className="gr-acceptbox">
                <h4 className="gr-h3">
                  {T("Uw overeenkomst voor", "Votre accord pour", "Your agreement for")} {d.edition?.name}
                </h4>
                <p className="gr-muted">
                  {T(
                    "Gelieve onderstaande afspraken na te lezen en te bevestigen. Uw bevestiging geldt als contract.",
                    "Veuillez relire et confirmer les accords ci-dessous. Votre confirmation fait office de contrat.",
                    "Please read and confirm the terms below. Your confirmation serves as the contract.",
                  )}
                </p>

                <dl className="gr-dl" style={{ margin: "10px 0" }}>
                  <dt>{T("Formule", "Formule", "Formula")}</dt>
                  <dd>{d.formulaName || "—"}</dd>
                  <dt>{T("Bijdrage", "Contribution", "Contribution")}</dt>
                  <dd>
                    <strong>{eur(d.cost)}</strong>
                    {d.settlement === "inkind"
                      ? ` — ${T("in natura, geen factuur", "en nature, sans facture", "in kind, no invoice")}`
                      : d.settlement === "mixed"
                        ? ` — ${T("te factureren", "à facturer", "to invoice")}: ${eur(invoiceAmount(d))}`
                        : ""}
                  </dd>
                  {(d.inKindDescription || "").trim() && (
                    <>
                      <dt>{T("In natura", "En nature", "In kind")}</dt>
                      <dd>{d.inKindDescription}</dd>
                    </>
                  )}
                  {ticketLines(d, lang).length > 0 && (
                    <>
                      <dt>{T("Tickets & bonnen", "Tickets & bons", "Tickets & vouchers")}</dt>
                      <dd>
                        <ul className="gr-benefitlist">
                          {ticketLines(d, lang).map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {visibilityLines(d, lang).length > 0 && (
                    <>
                      <dt>{T("Zichtbaarheid", "Visibilité", "Visibility")}</dt>
                      <dd>
                        <ul className="gr-benefitlist">
                          {visibilityLines(d, lang).map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {(d.notes || "").trim() && (
                    <>
                      <dt>{T("Opmerkingen", "Remarques", "Notes")}</dt>
                      <dd>{d.notes}</dd>
                    </>
                  )}
                </dl>

                <label className={"gr-check" + (readTerms[d.id] ? " on" : "")}>
                  <input
                    type="checkbox"
                    checked={!!readTerms[d.id]}
                    onChange={(e) => setReadTerms({ ...readTerms, [d.id]: e.target.checked })}
                  />
                  {T(
                    "Ik heb deze afspraken gelezen en ga akkoord namens",
                    "J'ai lu ces accords et je marque mon accord au nom de",
                    "I have read these terms and agree on behalf of",
                  )}{" "}
                  {sponsor.companyName}
                </label>
                <div className="gr-actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    className="gr-btn"
                    disabled={!readTerms[d.id] || !asContact}
                    onClick={() => onAcceptAgreement(d.id)}
                  >
                    {T("Lezen en aanvaarden", "Lire et accepter", "Read and accept")}
                  </button>
                  {!asContact && (
                    <span className="gr-muted">
                      {T(
                        "Meld u aan met uw eigen e-mailadres om te kunnen aanvaarden.",
                        "Connectez-vous avec votre propre adresse e-mail pour accepter.",
                        "Log in with your own email address to accept.",
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {history.length === 0 && openEditions.length === 0 ? (
              <p className="gr-empty">
                {T("Nog geen sponsoring geregistreerd.", "Aucun sponsoring enregistré.", "No sponsorship registered yet.")}
              </p>
            ) : (
              history.length > 0 && (
                <div className="gr-tablewrap">
                  <table className="gr-table gr-compact">
                    <thead>
                      <tr>
                        <th>{T("Editie", "Édition", "Edition")}</th>
                        <th>{T("Formule", "Formule", "Formula")}</th>
                        <th className="gr-r">{T("Bijdrage", "Contribution", "Contribution")}</th>
                        <th>{T("Tickets & bonnen", "Tickets & bons", "Tickets & vouchers")}</th>
                        <th>{T("Zichtbaarheid", "Visibilité", "Visibility")}</th>
                        <th>{T("Akkoord", "Accord", "Accepted")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((d) => {
                        const tickets = ticketLines(d, lang);
                        const vis = visibilityLines(d, lang);
                        return (
                          <tr key={d.id}>
                            <td>
                              {d.edition ? d.edition.name : "?"}
                              {d.requestedAt && !d.confirmedAt && (
                                <>
                                  {" "}
                                  <Tag tone="amber">
                                    {T("in bevestiging", "en confirmation", "awaiting confirmation")}
                                  </Tag>
                                </>
                              )}
                            </td>
                            <td>{d.formulaName || "—"}</td>
                            <td className="gr-r">
                              <strong>{eur(d.cost)}</strong>
                              {d.settlement === "inkind" && (
                                <div className="gr-muted" style={{ fontSize: 11 }}>
                                  {T("in natura", "en nature", "in kind")}
                                </div>
                              )}
                            </td>
                            <td>
                              {tickets.length === 0 ? (
                                <span className="gr-muted">—</span>
                              ) : (
                                <ul className="gr-benefitlist">
                                  {tickets.map((line, i) => (
                                    <li key={i}>{line}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="gr-muted">{vis.join(" · ") || "—"}</td>
                            <td>
                              {isAccepted(d) ? (
                                <>
                                  <Tag tone="green">{T("aanvaard", "accepté", "accepted")}</Tag>
                                  <div className="gr-muted" style={{ fontSize: 11 }}>
                                    {fmtDateTime(d.acceptance!.acceptedAt)}
                                    <br />
                                    {d.acceptance!.name}
                                  </div>
                                </>
                              ) : (
                                <Tag tone="amber">{T("nog te bevestigen", "à confirmer", "to confirm")}</Tag>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {history[0] && returnTypesOf(history[0]).length > 0 && (
              <>
                <h4 className="gr-subhead">
                  {T("Zo ziet uw zichtbaarheid eruit", "À quoi ressemble votre visibilité", "What your visibility looks like")}
                  {" — "}
                  {history[0].edition?.name}
                  {history[0].formulaName ? ` · ${history[0].formulaName}` : ""}
                </h4>
                <p className="gr-muted" style={{ marginBottom: 10 }}>
                  {T(
                    "Voorbeelden van de zichtbaarheid uit uw meest recente formule.",
                    "Exemples de la visibilité prévue dans votre formule la plus récente.",
                    "Examples of the visibility included in your most recent formula.",
                  )}
                </p>
                <ReturnExamples deal={history[0]} lang={lang} />
              </>
            )}
          </>
        )}

        {chosen && (
          <Modal
            title={T("Formule bevestigen", "Confirmer la formule", "Confirm formula")}
            onClose={() => setChosen(null)}
          >
            <p>
              {T("U kiest de formule", "Vous choisissez la formule", "You are choosing the formula")}{" "}
              <strong>{chosen.name}</strong> {T("voor", "pour", "for")} <strong>{chosen.edName}</strong>{" "}
              {T("aan", "au prix de", "at")} <strong>{eur(chosen.cost)}</strong>.
            </p>
            <p className="gr-muted">
              {T(
                "Wij nemen uw keuze op en sturen u het contract ter bevestiging. U kan dit nog bespreken met uw contactpersoon bij Grensrock.",
                "Nous enregistrons votre choix et vous enverrons le contrat pour confirmation. Vous pouvez encore en discuter avec votre contact chez Grensrock.",
                "We'll record your choice and send you the contract for confirmation. You can still discuss it with your Grensrock contact.",
              )}
            </p>
            <div className="gr-actions">
              <button className="gr-btn-ghost" onClick={() => setChosen(null)}>
                {T("Annuleren", "Annuler", "Cancel")}
              </button>
              <button
                className="gr-btn"
                onClick={() => {
                  onRequestFormula(chosen.editionId, chosen.name, contactName(asContact) || sponsor.companyName);
                  setChosen(null);
                }}
              >
                {T("Bevestig mijn keuze", "Confirmer mon choix", "Confirm my choice")}
              </button>
            </div>
          </Modal>
        )}

        {/* ---- Vouchers ---- */}
        {sub === "vouchers" &&
          (myVouchers.length === 0 ? (
            <p className="gr-empty">
              {T(
                "Uw tickets en bonnen zijn nog niet aangemaakt. Zodra wij ze versturen, verschijnen ze hier.",
                "Vos tickets et bons ne sont pas encore créés. Dès que nous les envoyons, ils apparaîtront ici.",
                "Your tickets and vouchers haven't been created yet. They'll appear here as soon as we send them.",
              )}
            </p>
          ) : (
            <>
              <p className="gr-muted" style={{ marginBottom: 8 }}>
                {T(
                  "Wil u een ticket doorgeven aan een collega of klant? Vul zijn naam en e-mailadres in — wij sturen het rechtstreeks naar hem door.",
                  "Vous souhaitez transmettre un ticket à un collègue ou un client ? Indiquez son nom et son e-mail — nous le lui envoyons directement.",
                  "Want to pass a ticket on to a colleague or client? Fill in their name and email — we'll send it straight to them.",
                )}
              </p>
              <div className="gr-tablewrap">
                <table className="gr-table gr-compact">
                  <thead>
                    <tr>
                      <th>{T("Editie", "Édition", "Edition")}</th>
                      <th>{T("Type", "Type", "Type")}</th>
                      <th className="gr-r">{T("Waarde", "Valeur", "Value")}</th>
                      <th>{T("Status", "Statut", "Status")}</th>
                      <th>{T("Op naam van", "Au nom de", "Assigned to")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myVouchers.map((v) => {
                      const ed = editions.find((e) => e.id === v.editionId);
                      const st = VOUCHER_STATUS[v.status] || VOUCHER_STATUS.pending;
                      return (
                        <tr key={v.id} className={v.status === "cancelled" ? "gr-cancelled" : undefined}>
                          <td>{ed ? ed.name : "—"}</td>
                          <td>{VOUCHER_TYPES[v.type]?.label || v.type}</td>
                          <td className="gr-r">{v.value > 0 ? eur(v.value) : "—"}</td>
                          <td>
                            <Tag tone={st.tone}>{st.label}</Tag>
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
                              <span className="gr-muted">—</span>
                            )}
                          </td>
                          <td className="gr-rowbtns">
                            {v.url && (
                              <a className="gr-mini gr-btn-link" href={v.url} target="_blank" rel="noreferrer">
                                {T("Bekijk", "Voir", "View")}
                              </a>
                            )}
                            {v.status !== "cancelled" && (
                              <button className="gr-mini" onClick={() => setAssigning(v)}>
                                {v.recipientEmail
                                  ? T("Wijzig", "Modifier", "Change")
                                  : T("Doorgeven", "Transmettre", "Pass on")}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ))}

        {assigning && (
          <Modal
            title={T("Ticket doorgeven", "Transmettre le ticket", "Pass on ticket")}
            onClose={() => setAssigning(null)}
          >
            <p className="gr-muted">
              {VOUCHER_TYPES[assigning.type]?.label}
              {assigning.value > 0 ? ` · ${eur(assigning.value)}` : ""}
            </p>
            <Field label={T("Naam", "Nom", "Name")}>
              <input
                value={assignDraft.name}
                onChange={(e) => setAssignDraft({ ...assignDraft, name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <EmailInput
                value={assignDraft.email}
                lang={lang}
                onChange={(e) => setAssignDraft({ ...assignDraft, email: e.target.value })}
              />
            </Field>
            <p className="gr-muted">
              {T(
                "Wij sturen het ticket op naam naar dit adres. U kan dit later nog wijzigen.",
                "Nous enverrons le ticket nominatif à cette adresse. Vous pouvez le modifier plus tard.",
                "We'll send the personalised ticket to this address. You can change this later.",
              )}
            </p>
            <div className="gr-actions">
              {assigning.recipientEmail && (
                <button
                  className="gr-btn-ghost gr-danger"
                  onClick={() => {
                    onAssignVoucher(assigning.id, { recipientName: "", recipientEmail: "" });
                    setAssigning(null);
                  }}
                >
                  {T("Terugnemen", "Reprendre", "Take back")}
                </button>
              )}
              <button className="gr-btn-ghost" onClick={() => setAssigning(null)}>
                {T("Annuleren", "Annuler", "Cancel")}
              </button>
              <button
                className="gr-btn"
                disabled={!validateEmail(assignDraft.email)?.valid || !assignDraft.name.trim()}
                onClick={() => {
                  onAssignVoucher(assigning.id, {
                    recipientName: assignDraft.name.trim(),
                    recipientEmail: emailToStore(assignDraft.email),
                  });
                  setAssigning(null);
                }}
              >
                {T("Doorgeven", "Transmettre", "Pass on")}
              </button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
