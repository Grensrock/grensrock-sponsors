"use client";

import { useState } from "react";
import VoucherEditor from "@/components/forms/VoucherEditor";
import Field from "@/components/ui/Field";
import { FOLDER_OPTS, LED_ZONES, POSTER_OPTS, WEBSITE_OPTS, label } from "@/lib/constants";
import { eur } from "@/lib/money";
import { normFolder, normLed } from "@/lib/normalize";
import { voucherText, voucherTotal } from "@/lib/vouchers";
import type { FormulaFields, Language, LedZone, NumLike, TranslateFn, VoucherRow } from "@/types";

export type BenefitSetter = (k: string, val: unknown) => void;

const numSetter = (set: BenefitSetter) => (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
  set(k, e.target.value === "" ? "" : Math.max(0, Number(e.target.value)));

/* ---------- Benefit fields (shared by formula + deal forms) ---------- */

export default function BenefitFields({
  v,
  set,
  t = (k) => k,
  lang = "nl",
}: {
  v: FormulaFields;
  set: BenefitSetter;
  t?: TranslateFn;
  /** For the option labels, which are shared with the sponsor portal. */
  lang?: Language;
}) {
  const num = numSetter(set);
  return (
    <>
      <div className="gr-grid3">
        <Field label={t("bf.vipfri")}>
          <input type="number" min="0" value={v.vipFriday} onChange={num("vipFriday")} />
        </Field>
        <Field label={t("bf.vipsat")}>
          <input type="number" min="0" value={v.vipSaturday} onChange={num("vipSaturday")} />
        </Field>
        <Field label={t("bf.vipguest")}>
          <input type="number" min="0" value={v.vipGuests} onChange={num("vipGuests")} />
        </Field>
      </div>
      <Field label={t("bf.drinkvalue")}>
        <input type="number" min="0" step="0.01" value={v.drinkValue} onChange={num("drinkValue")} />
      </Field>
      <div className="gr-grid3">
        <Field label={t("bf.folder")}>
          <select value={normFolder(v.folderMention)} onChange={(e) => set("folderMention", e.target.value)}>
            {Object.keys(FOLDER_OPTS).map((k) => (
              <option key={k} value={k}>
                {label(FOLDER_OPTS, k, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("bf.poster")}>
          <select value={v.posterMention || "none"} onChange={(e) => set("posterMention", e.target.value)}>
            {Object.keys(POSTER_OPTS).map((k) => (
              <option key={k} value={k}>
                {label(POSTER_OPTS, k, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("bf.website")}>
          <select value={v.websiteMention} onChange={(e) => set("websiteMention", e.target.value)}>
            {Object.keys(WEBSITE_OPTS).map((k) => (
              <option key={k} value={k}>
                {label(WEBSITE_OPTS, k, lang)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("bf.fence")}>
        <input type="number" min="0" value={v.fenceCovers || 0} onChange={num("fenceCovers")} />
      </Field>
      <Field group label={t("bf.led")}>
        <div className="gr-checkrow">
          {(Object.keys(LED_ZONES) as LedZone[]).map((k) => {
            const zones = normLed(v.ledboarding);
            const on = zones.includes(k);
            return (
              <label key={k} className={"gr-check" + (on ? " on" : "")}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => set("ledboarding", e.target.checked ? [...zones, k] : zones.filter((z) => z !== k))}
                />
                {label(LED_ZONES, k, lang)}
              </label>
            );
          })}
        </div>
      </Field>
    </>
  );
}

/* ---------- An agreement's vouchers ----------
   Apart from the benefits, and open while those are locked: how a voucher
   value is split isn't a benefit of its own, and food & drink isn't part of
   the formula but something the sponsor buys on top, billed through
   foodDrinkExtra — so what an older agreement still had included
   (baseFoodDrink) stays as it was (0027). */

/* A saved split whose vouchers don't add up to their amount. Empty isn't one:
   that is one voucher for the whole amount (expectedVouchers). */
const offSplit = (rows: VoucherRow[] | undefined, amount: NumLike) =>
  (rows || []).length > 0 && Math.abs(voucherTotal(rows) - (Number(amount) || 0)) >= 0.005;

export function VoucherFields({
  v,
  set,
  t = (k) => k,
  lang = "nl",
}: {
  v: FormulaFields;
  set: BenefitSetter;
  t?: TranslateFn;
  /** For the voucher editor, which is shared with the sponsor portal. */
  lang?: Language;
}) {
  const num = numSetter(set);
  const drink = Number(v.drinkValue) > 0;
  const food = Number(v.foodDrinkValue) > 0;
  /* The splits wait behind a button, listed until then: most agreements keep
     the formula's split, or one voucher per value. Closed, the editors are
     only hidden, not gone — they keep a split in step with its amount (a
     default when it is empty, redone when the amount changes), whether anyone
     looks or not. One that doesn't add up starts open, so it isn't missed. */
  const [splitOpen, setSplitOpen] = useState(
    () => offSplit(v.drinkVouchers, v.drinkValue) || offSplit(v.foodDrinkVouchers, v.foodDrinkValue),
  );
  return (
    <>
      <Field
        label={t("bf.food")}
        hint={
          Number(v.baseFoodDrink) > 0 ? t("bf.foodincl", { amount: eur(v.baseFoodDrink) }) : t("bf.foodextra")
        }
      >
        <input type="number" min="0" step="0.01" value={v.foodDrinkValue} onChange={num("foodDrinkValue")} />
      </Field>
      {(drink || food) && !splitOpen && (
        <>
          <ul className="gr-benefitlist gr-benefitread" style={{ marginBottom: 8 }}>
            {drink && (
              <li>
                {t("bn.drink")}: {voucherText(v.drinkVouchers) || `1 × ${eur(v.drinkValue)}`}
              </li>
            )}
            {food && (
              <li>
                {t("df.foodsplit")}: {voucherText(v.foodDrinkVouchers) || `1 × ${eur(v.foodDrinkValue)}`}
              </li>
            )}
          </ul>
          <button type="button" className="gr-mini" style={{ marginBottom: 12 }} onClick={() => setSplitOpen(true)}>
            {t("df.splitvouchers")}
          </button>
        </>
      )}
      <div hidden={!splitOpen}>
        {drink && (
          <Field group label={t("bn.drink")}>
            <VoucherEditor
              amount={v.drinkValue}
              rows={v.drinkVouchers || []}
              lang={lang}
              title="drink"
              onChange={(rows) => set("drinkVouchers", rows)}
            />
          </Field>
        )}
        {food && (
          <Field group label={t("df.foodsplit")}>
            <VoucherEditor
              amount={v.foodDrinkValue}
              rows={v.foodDrinkVouchers || []}
              lang={lang}
              title="food"
              onChange={(rows) => set("foodDrinkVouchers", rows)}
            />
          </Field>
        )}
      </div>
    </>
  );
}
