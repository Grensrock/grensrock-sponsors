"use client";

import VoucherEditor from "@/components/forms/VoucherEditor";
import Field from "@/components/ui/Field";
import { FOLDER_OPTS, LED_ZONES, POSTER_OPTS, WEBSITE_OPTS, label } from "@/lib/constants";
import { normFolder, normLed } from "@/lib/normalize";
import type { FormulaFields, Language, LedZone, TranslateFn } from "@/types";

export type BenefitSetter = (k: string, val: unknown) => void;

/* ---------- Benefit fields (shared by formula + deal forms) ---------- */

export default function BenefitFields({
  v,
  set,
  showVouchers,
  t = (k) => k,
  lang = "nl",
}: {
  v: FormulaFields;
  set: BenefitSetter;
  showVouchers?: boolean;
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
      {showVouchers && Number(v.drinkValue) > 0 && (
        <VoucherEditor
          amount={v.drinkValue}
          rows={v.drinkVouchers || []}
          lang={lang}
          title="drink"
          onChange={(rows) => set("drinkVouchers", rows)}
        />
      )}
      <Field label={t("bf.food")}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={v.foodDrinkValue}
          onChange={(e) => {
            const val = e.target.value === "" ? "" : Math.max(0, Number(e.target.value));
            set("foodDrinkValue", val);
            set("baseFoodDrink", Number(val) || 0);
          }}
        />
      </Field>
      {showVouchers && Number(v.foodDrinkValue) > 0 && (
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
