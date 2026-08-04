"use client";

import { useState } from "react";
import CopyInviteButton from "@/components/views/CopyInviteButton";
import LogoManager from "@/components/ui/LogoManager";
import Tag from "@/components/ui/Tag";
import { changedSinceAcceptance, isAccepted } from "@/lib/acceptance";
import { formatAddress } from "@/lib/address";
import {
  COMM_LABELS,
  FOLDER_OPTS,
  POSTER_OPTS,
  VOUCHER_STATUS,
  VOUCHER_TYPES,
  WEBSITE_OPTS,
  label,
  voucherLabel,
  type CommKey,
} from "@/lib/constants";
import { contactName, sponsorContacts, voucherContact } from "@/lib/contacts";
import { dealTotalCost, eur, foodDrinkExtra, invoiceAmount, needsInvoice, refMissing } from "@/lib/money";
import { ledLabel, normFolder, normLed } from "@/lib/normalize";
import { responsibleName } from "@/lib/users";
import { voucherText } from "@/lib/vouchers";
import type { Contact, Deal, Edition, Language, Sponsor, SponsorLogo, TranslateFn, User, Voucher } from "@/types";

/* ---------- Sponsor detail (history) ---------- */

type DealWithEdition = Deal & { edition?: Edition };

export default function SponsorDetail({
  sponsor,
  deals,
  editions,
  users = [],
  vouchers = [],
  canDelete,
  t = (k) => k,
  lang = "nl",
  onBack,
  onEdit,
  onDelete,
  onAddDeal,
  onEditDeal,
  onDeleteDeal,
  onEditContact,
  onShowAcceptance,
  onActivateContact,
  logos = [],
  onLogosChange,
  onEmail,
}: {
  sponsor: Sponsor;
  deals: Deal[];
  editions: Edition[];
  users?: User[];
  vouchers?: Voucher[];
  canDelete?: boolean;
  t?: TranslateFn;
  lang?: Language;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddDeal: () => void;
  onEditDeal: (d: Deal) => void;
  onDeleteDeal: (id: string) => void;
  onEditContact: (c: Contact | null) => void;
  onShowAcceptance: (d: Deal) => void;
  onActivateContact: (c: Contact) => void;
  onEmail: (d: Deal) => void;
  logos?: SponsorLogo[];
  onLogosChange?: (logos: SponsorLogo[]) => void;
}) {
  const [sub, setSub] = useState("info");
  const history: DealWithEdition[] = deals
    .filter((d) => d.sponsorId === sponsor.id)
    .map((d) => ({ ...d, edition: editions.find((e) => e.id === d.editionId) }))
    .sort((a, b) => (b.edition?.startDate || "").localeCompare(a.edition?.startDate || ""));
  const totalCost = history.reduce((s, d) => s + dealTotalCost(d), 0);
  const myVouchers = vouchers.filter((v) => v.sponsorId === sponsor.id);
  const contacts = sponsorContacts(sponsor);

  const TABS: Array<[string, string]> = [
    ["info", t("sd.info")],
    ["logos", `${t("sd.logos")} (${logos.length})`],
    ["contacts", `${t("sd.contacts")} (${contacts.length})`],
    ["sponsoring", `${t("sd.sponsoring")} (${history.length})`],
    ["vouchers", `${t("sd.vouchers")} (${myVouchers.filter((v) => v.status !== "cancelled").length})`],
  ];

  return (
    <div>
      <button className="gr-back" onClick={onBack}>
        {t("sp.back")}
      </button>
      <div className="gr-detail-head">
        <div>
          <h2 className="gr-h2">{sponsor.companyName}</h2>
          <p className="gr-muted">
            {sponsor.entityType === "legal" ? t("c.legal") : t("c.person")}
            {sponsor.vatNumber && <> · VAT {sponsor.vatNumber}</>}
            {responsibleName(sponsor, users) && <> · Managed by {responsibleName(sponsor, users)}</>}
          </p>
          {sponsor.refRequired && <Tag tone="amber">reference required on contract &amp; invoice</Tag>}
        </div>
        <div className="gr-detail-btns">
          <button className="gr-btn-ghost" onClick={onEdit}>
            {t("common.edit")}
          </button>
          {canDelete && (
            <button className="gr-btn-ghost gr-danger" onClick={onDelete}>
              {t("common.delete")}
            </button>
          )}
          <button className="gr-btn" onClick={onAddDeal}>
            {t("sd.addagr")}
          </button>
        </div>
      </div>

      <nav className="gr-subnav">
        {TABS.map(([k, l]) => (
          <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}>
            {l}
          </button>
        ))}
      </nav>

      {/* ---- Information ---- */}
      {sub === "info" && (
        <div className="gr-grid2" style={{ gap: "0 20px", alignItems: "start" }}>
          <div>
            <h4 className="gr-subhead" style={{ borderTop: "none", paddingTop: 0 }}>
              {t("sd.companydetails")}
            </h4>
            <div className="gr-portalbox">
              <dl className="gr-dl">
                <dt>{t("c.company")}</dt>
                <dd>{sponsor.companyName}</dd>
                <dt>{t("c.type")}</dt>
                <dd>{sponsor.entityType === "legal" ? t("c.legal") : t("c.person")}</dd>
                <dt>{t("c.vatnr")}</dt>
                <dd>{sponsor.vatNumber || "—"}</dd>
                <dt>{t("c.address")}</dt>
                <dd>{formatAddress(sponsor) || "—"}</dd>
                <dt>{t("c.responsible")}</dt>
                <dd>{responsibleName(sponsor, users) || "— not assigned —"}</dd>
                <dt>{t("vc.receiver")}</dt>
                <dd>
                  {(() => {
                    const c = voucherContact(sponsor);
                    return c ? `${contactName(c) || "?"} · ${c.email}` : "—";
                  })()}
                </dd>
                <dt>{t("inv.reference")}</dt>
                <dd>{t(sponsor.refRequired ? "sd.refrequired" : "sd.refnotrequired")}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* ---- Logos ---- */}
      {sub === "logos" && (
        <LogoManager sponsorId={sponsor.id} logos={logos} onChange={(next) => onLogosChange?.(next)} lang={lang} />
      )}

      {/* ---- Contact persons ---- */}
      {sub === "contacts" && (
        <>
          <div className="gr-toolbar">
            <span className="gr-muted">
              {contacts.length} {t("sd.contactcount")}
            </span>
            <button className="gr-btn" onClick={() => onEditContact(null)}>
              {t("sd.addcontact")}
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="gr-empty">{t("sd.nocontacts")}</p>
          ) : (
            <div className="gr-tablewrap">
              <table className="gr-table gr-clickable">
                <thead>
                  <tr>
                    <th>{t("c.name")}</th>
                    <th>{t("c.email")}</th>
                    <th>{t("c.phone")}</th>
                    <th>{t("c.language")}</th>
                    <th>{t("c.portal")}</th>
                    <th>{t("c.receives")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={c.id || i} title={t("tt.editcontact")} onClick={() => onEditContact(c)}>
                      <td>
                        <strong>{contactName(c) || <span className="gr-muted">no name</span>}</strong>
                      </td>
                      <td>{c.email || <span className="gr-muted">—</span>}</td>
                      <td>{c.phone || <span className="gr-muted">—</span>}</td>
                      <td>{(c.language || "nl").toUpperCase()}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {c.portalAccess ? (
                          <Tag tone="green">active</Tag>
                        ) : c.email ? (
                          <button className="gr-mini" onClick={() => onActivateContact(c)}>
                            {t("c.activate")}
                          </button>
                        ) : (
                          <span className="gr-muted">no email</span>
                        )}
                      </td>
                      <td>
                        <div className="gr-commtags">
                          {(Object.keys(COMM_LABELS) as CommKey[])
                            .filter((k) => c.prefs?.[k])
                            .map((k) => (
                              <Tag key={k}>{label(COMM_LABELS, k, lang)}</Tag>
                            ))}
                        </div>
                      </td>
                      <td className="gr-rowbtns" onClick={(e) => e.stopPropagation()}>
                        {c.email && (
                          <CopyInviteButton
                            sponsor={sponsor}
                            contact={c}
                            responsible={responsibleName(sponsor, users)}
                            t={t}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---- Sponsoring ---- */}
      {sub === "sponsoring" && (
        <>
          <div className="gr-statrow">
            <div className="gr-stat">
              <span>{history.length}</span>
              {t("sd.editionssponsored")}
            </div>
            <div className="gr-stat">
              <span>{eur(totalCost)}</span>
              {t("sd.totalcontributed")}
            </div>
          </div>
          {history.length === 0 ? (
            <p className="gr-empty">{t("sd.noagreements")}</p>
          ) : (
            <div className="gr-tablewrap">
              <table className="gr-table gr-clickable">
                <thead>
                  <tr>
                    <th>{t("c.edition")}</th>
                    <th>{t("c.formula")}</th>
                    <th className="gr-r">{t("c.cost")}</th>
                    <th className="gr-r">{t("th.vipfsg")}</th>
                    <th className="gr-r">{t("th.drinks")}</th>
                    <th className="gr-r">{t("th.fooddrink")}</th>
                    <th>{t("th.folder")}</th>
                    <th>{t("th.website")}</th>
                    <th>{t("th.poster")}</th>
                    <th>{t("th.led")}</th>
                    <th className="gr-r">
                      {t("th.covers")}
                      <br />
                      nadar/heras
                    </th>
                    <th>{t("c.accepted")}</th>
                    <th>{t("th.invoice")}</th>
                    <th>{t("sd.email")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((d) => (
                    <tr key={d.id} title={t("sd.clicktoedit")} onClick={() => onEditDeal(d)}>
                      <td>
                        {d.edition ? d.edition.name : "?"}{" "}
                        {d.edition && !d.edition.active && <Tag>{t("th.archived")}</Tag>}
                        {d.requestedAt && !d.confirmedAt && (
                          <>
                            {" "}
                            <Tag tone="amber">{t("sd.reqbysponsor")}</Tag>
                          </>
                        )}
                      </td>
                      <td>{d.formulaName || <span className="gr-muted">{t("th.custom")}</span>}</td>
                      <td className="gr-r">
                        <strong>{eur(d.cost)}</strong>
                        {d.settlement === "inkind" && (
                          <div className="gr-muted" style={{ fontSize: 11 }}>
                            in kind
                          </div>
                        )}
                        {d.settlement === "mixed" && (
                          <div className="gr-muted" style={{ fontSize: 11 }}>
                            {eur(invoiceAmount(d))} billed
                          </div>
                        )}
                        {foodDrinkExtra(d) > 0 && (
                          <div style={{ fontSize: 11, color: "var(--orange-deep)" }}>
                            + {eur(foodDrinkExtra(d))} extra F&amp;D
                          </div>
                        )}
                      </td>
                      <td className="gr-r">
                        {d.vipFriday || 0} / {d.vipSaturday || 0} / {d.vipGuests || 0}
                      </td>
                      <td className="gr-r">
                        {d.drinkTickets || 0}
                        {voucherText(d.drinkVouchers) && (
                          <div className="gr-muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                            {voucherText(d.drinkVouchers)}
                          </div>
                        )}
                      </td>
                      <td className="gr-r">
                        {Number(d.foodDrinkValue) > 0 ? (
                          <>
                            {eur(d.foodDrinkValue)}
                            {voucherText(d.foodDrinkVouchers) && (
                              <div className="gr-muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                                {voucherText(d.foodDrinkVouchers)}
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{normFolder(d.folderMention) !== "none" ? label(FOLDER_OPTS, normFolder(d.folderMention), lang) : "—"}</td>
                      <td>{d.websiteMention !== "none" ? label(WEBSITE_OPTS, d.websiteMention, lang) : "—"}</td>
                      <td>{d.posterMention && d.posterMention !== "none" ? label(POSTER_OPTS, d.posterMention, lang) : "—"}</td>
                      <td>{normLed(d.ledboarding).length > 0 ? ledLabel(d.ledboarding, lang) : "—"}</td>
                      <td className="gr-r">
                        {(Number(d.barrierCovers) || 0) + (Number(d.herasCovers) || 0) > 0
                          ? `${Number(d.barrierCovers) || 0} / ${Number(d.herasCovers) || 0}`
                          : "—"}
                      </td>
                      <td>
                        {isAccepted(d) ? (
                          <button
                            className="gr-mini"
                            title={t("tt.showaccepted")}
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowAcceptance(d);
                            }}
                          >
                            {changedSinceAcceptance(d) ? (
                              <span style={{ color: "var(--red)" }}>{t("sd.changed")}</span>
                            ) : (
                              <span style={{ color: "var(--green)" }}>{t("sd.accepted")}</span>
                            )}
                          </button>
                        ) : (
                          <Tag tone="amber">{t("sd.notyet")}</Tag>
                        )}
                      </td>
                      <td>
                        {!needsInvoice(d) ? (
                          <Tag tone="grey">{t("sd.inkind")}</Tag>
                        ) : refMissing(d, sponsor) ? (
                          <Tag tone="amber">{t("sd.refmissing")}</Tag>
                        ) : d.invoiceCreated ? (
                          <Tag tone="green">{d.invoiceNumber || t("sd.created")}</Tag>
                        ) : (
                          <Tag tone="amber">{t("sd.pending")}</Tag>
                        )}
                      </td>
                      <td>{d.emailSentAt ? <Tag tone="green">{t("sd.sent")}</Tag> : <Tag>{t("sd.notsent")}</Tag>}</td>
                      <td className="gr-rowbtns">
                        <button
                          className="gr-mini"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEmail(d);
                          }}
                        >
                          {t("sd.email")}
                        </button>
                        {canDelete && (
                          <button
                            className="gr-mini gr-danger"
                            title={t("tt.deldeal")}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDeal(d.id);
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
        </>
      )}

      {/* ---- Vouchers ---- */}
      {sub === "vouchers" &&
        (myVouchers.length === 0 ? (
          <p className="gr-empty">{t("sd.novouchers")}</p>
        ) : (
          <div className="gr-tablewrap">
            <table className="gr-table gr-compact">
              <thead>
                <tr>
                  <th>{t("c.edition")}</th>
                  <th>{t("c.type")}</th>
                  <th className="gr-r">{t("c.value")}</th>
                  <th>{t("c.status")}</th>
                  <th>{t("vo.code")}</th>
                  <th>{t("c.assignedto")}</th>
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
                      <td>{voucherLabel(VOUCHER_TYPES[v.type], lang, v.type)}</td>
                      <td className="gr-r">{v.value > 0 ? eur(v.value) : "—"}</td>
                      <td>
                        <Tag tone={st.tone}>{voucherLabel(st, lang, v.status)}</Tag>
                      </td>
                      <td>{v.code || <span className="gr-muted">—</span>}</td>
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
        ))}
    </div>
  );
}
