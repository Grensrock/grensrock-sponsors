/* ============================================================
   The benefits: what a sponsor gets for their contribution
   ============================================================
   An agreement's benefits are held against the formula it names. When a
   team member sets them apart from it, the agreement waits for an admin
   before it can reach the sponsor. The database makes that call
   (0026_benefits_approval.sql) and its answer is the one that counts —
   it arrives on the agreement as benefitsChangedAt / benefitsApprovedAt.
   This side lists what differs, for the form, the approval dialog and the
   admins' mail, comparing exactly what the trigger compares:
     - not the cost, nor how a voucher value is split into vouchers;
     - not food & drink vouchers: those always come on top of the formula,
       paid for by the sponsor, so anyone may add them (0027);
     - LED zones as a set;
     - no formula of the edition (Op maat, none picked) as no benefits.
   ============================================================ */

import { FOLDER_OPTS, LED_ZONES, POSTER_OPTS, WEBSITE_OPTS, label, type LabelMap } from "@/lib/constants";
import { teamT } from "@/lib/i18n";
import { eur } from "@/lib/money";
import { ledLabel, normLed } from "@/lib/normalize";
import type { Deal, Edition, Formula, FormulaFields, LedZone, TeamLanguage } from "@/types";

export interface BenefitChange {
  label: string;
  /** As the formula has it; "" when the agreement names no formula. */
  formula: string;
  deal: string;
}

const n = (v: unknown) => Number(v) || 0;
/* In the order the form lists them, so "before" and "after" read alike. */
const zones = (v: unknown) => Object.keys(LED_ZONES).filter((z) => normLed(v).includes(z as LedZone));

export function benefitChanges(
  deal: Partial<Deal>,
  formula: FormulaFields | null | undefined,
  lang: TeamLanguage = "nl",
): BenefitChange[] {
  const out: BenefitChange[] = [];
  const f: Partial<FormulaFields> = formula || {};
  const add = (key: string, from: string, to: string) =>
    out.push({ label: teamT(key, lang), formula: formula ? from : "", deal: to });
  const count = (key: string, a: unknown, b: unknown) => {
    if (n(a) !== n(b)) add(key, String(n(a)), String(n(b)));
  };
  const money = (key: string, a: unknown, b: unknown) => {
    if (n(a) !== n(b)) add(key, eur(n(a)), eur(n(b)));
  };
  const mention = <K extends string>(key: string, opts: LabelMap<K>, a?: string, b?: string) => {
    if ((a || "none") !== (b || "none")) add(key, label(opts, a || "none", lang), label(opts, b || "none", lang));
  };

  count("bf.vipfri", f.vipFriday, deal.vipFriday);
  count("bf.vipsat", f.vipSaturday, deal.vipSaturday);
  count("bf.vipguest", f.vipGuests, deal.vipGuests);
  money("bn.drink", f.drinkValue, deal.drinkValue);
  mention("bf.folder", FOLDER_OPTS, f.folderMention, deal.folderMention);
  mention("bf.poster", POSTER_OPTS, f.posterMention, deal.posterMention);
  mention("bf.website", WEBSITE_OPTS, f.websiteMention, deal.websiteMention);
  if (zones(f.ledboarding).join() !== zones(deal.ledboarding).join()) {
    add("bn.led", ledLabel(zones(f.ledboarding), lang) || "—", ledLabel(zones(deal.ledboarding), lang) || "—");
  }
  count("bf.fence", f.fenceCovers, deal.fenceCovers);
  return out;
}

/** "VIP tickets Friday: 4 → 6", or just "VIP tickets Friday: 6" when there is no formula to hold it against. */
export const changeLines = (changes: BenefitChange[]) =>
  changes.map((c) => (c.formula ? `${c.label}: ${c.formula} → ${c.deal}` : `${c.label}: ${c.deal}`));

/** Whether two versions of one agreement give the same benefits: what decides
    whether the database looks at them again on a save. */
export const sameBenefits = (a: Partial<Deal>, b: Partial<Deal>) =>
  benefitChanges(a, b as FormulaFields).length === 0;

/** The formula an agreement names, as its edition has it now; null for Op maat or none. */
export const formulaOf = (deal: Partial<Pick<Deal, "editionId" | "formulaName">>, editions: Edition[]): Formula | null =>
  editions.find((e) => e.id === deal.editionId)?.formulas?.find((f) => f.name === deal.formulaName) || null;

/** Waiting for an admin to approve benefits a team member set apart from the formula. */
export const awaitsApproval = (d?: Partial<Deal> | null) => !!d?.benefitsChangedAt && !d?.benefitsApprovedAt;
