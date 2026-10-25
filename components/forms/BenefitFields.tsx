"use client";

import VoucherEditor from "@/components/forms/VoucherEditor";
import Field from "@/components/ui/Field";
import { FOLDER_OPTS, LED_ZONES, POSTER_OPTS, WEBSITE_OPTS, label } from "@/lib/constants";
import { eur } from "@/lib/money";
import { normFolder, normLed } from "@/lib/normalize";
import type { FormulaFields, Language, LedZone, TranslateFn } from "@/types";

export type BenefitSetter = (k: string, val: unknown) => void;

/* ---------- Benefit fields (shared by formula + deal forms) ---------- */

export default function BenefitFields({
  v,
  set,
  showVouchers,
  locked,
  noFood,
  t = (k) => k,
  lang = "nl",
}: {
  v: FormulaFields;
  set: BenefitSetter;
  showVouchers?: boolean;
  /** Shown but not editable: the agreement form keeps a formula's benefits so
      until someone chooses to change them. How a value is split into vouchers
      stays open — that isn't a benefit of its own. */
  locked?: boolean;
  /** For a formula: food & drink vouchers always come on top of one (0027). */
  noFood?: boolean;
  t?: TranslateFn;
  /** For the option labels and the voucher editor, which are shared with the sponsor portal. */
  lang?: Language;
}) {
  const num = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, e.target.value === "" ? "" : Math.max(0, Number(e.target.value)));
  return (
    <>
      <div className="gr-grid3">
        <Field label={t("bf.vipfri")}>
          <input type="number" min="0" value={v.vipFriday} onChange={num("vipFriday")} disabled={locked} />
        </Field>
        <Field label={t("bf.vipsat")}>
          <input type="number" min="0" value={v.vipSaturday} onChange={num("vipSaturday")} disabled={locked} />
        </Field>
        <Field label={t("bf.vipguest")}>
          <input type="number" min="0" value={v.vipGuests} onChange={num("vipGuests")} disabled={locked} />
        </Field>
      </div>
      <Field label={t("bf.drinkvalue")}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={v.drinkValue}
          onChange={num("drinkValue")}
          disabled={locked}
        />
      </Field>
      {showVouchers && Number(v.drinkValue) > 0 && (
        <VoucherEditor
          amount={v.drinkValue}
          rows={v.drinkVouchers || []}
          lang={lang}
          title="drink"
          onChange={(rows) => set("drinkVouchers", rows)}
        />
      )}
      {/* Never locked: food & drink isn't a benefit of the formula but something
          the sponsor buys on top, billed through foodDrinkExtra — so what an
          older agreement still had included (baseFoodDrink) stays as it was. */}
      {!noFood && (
        <Field
          label={t("bf.food")}
          hint={
            Number(v.baseFoodDrink) > 0
              ? t("bf.foodincl", { amount: eur(v.baseFoodDrink) })
              : t("bf.foodextra")
          }
        >
          <input type="number" min="0" step="0.01" value={v.foodDrinkValue} onChange={num("foodDrinkValue")} />
        </Field>
      )}
      {!noFood && showVouchers && Number(v.foodDrinkValue) > 0 && (
        <VoucherEditor
          amount={v.foodDrinkValue}
          rows={v.foodDrinkVouchers || []}
          lang={lang}
          title="food"
          onChange={(rows) => set("foodDrinkVouchers", rows)}
        />
      )}
      <div className="gr-grid3">
        <Field label={t("bf.folder")}>
          <select
            value={normFolder(v.folderMention)}
            onChange={(e) => set("folderMention", e.target.value)}
            disabled={locked}
          >
            {Object.keys(FOLDER_OPTS).map((k) => (
              <option key={k} value={k}>
                {label(FOLDER_OPTS, k, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("bf.poster")}>
          <select
            value={v.posterMention || "none"}
            onChange={(e) => set("posterMention", e.target.value)}
            disabled={locked}
          >
            {Object.keys(POSTER_OPTS).map((k) => (
              <option key={k} value={k}>
                {label(POSTER_OPTS, k, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("bf.website")}>
          <select value={v.websiteMention} onChange={(e) => set("websiteMention", e.target.value)} disabled={locked}>
            {Object.keys(WEBSITE_OPTS).map((k) => (
              <option key={k} value={k}>
                {label(WEBSITE_OPTS, k, lang)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t("bf.fence")}>
        <input type="number" min="0" value={v.fenceCovers || 0} onChange={num("fenceCovers")} disabled={locked} />
      </Field>
      <Field group label={t("bf.led")}>
        <div className="gr-checkrow">
          {(Object.keys(LED_ZONES) as LedZone[]).map((k) => {
            const zones = normLed(v.ledboarding);
            const on = zones.includes(k);
            return (
              <label key={k} className={"gr-check" + (on ? " on" : "") + (locked ? " gr-check-disabled" : "")}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
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
