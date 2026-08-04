"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import { VOUCHER_TYPES, voucherLabel } from "@/lib/constants";
import { defaultTickoweb } from "@/lib/integrations/tickoweb";
import type { Language, TickowebConfig, TickowebMode, TranslateFn, VoucherType } from "@/types";

/* ---------- Tickoweb settings ---------- */

export default function TickowebSettings({
  value,
  onSave,
  onCancel,
  t = (k) => k,
  lang = "nl",
}: {
  value?: TickowebConfig | null;
  onSave: (cfg: TickowebConfig) => void;
  onCancel: () => void;
  t?: TranslateFn;
  lang?: Language;
}) {
  const [c, setC] = useState<TickowebConfig>({ ...defaultTickoweb, ...value });
  const set = (k: keyof TickowebConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setC({ ...c, [k]: e.target.value } as TickowebConfig);
  return (
    <div>
      <Field label={t("tw.mode")}>
        <select value={c.mode} onChange={(e) => setC({ ...c, mode: e.target.value as TickowebMode })}>
          <option value="manual">{t("tw.manual")}</option>
          <option value="live">{t("tw.live")}</option>
        </select>
      </Field>
      {c.mode === "live" && (
        <>
          <p className="gr-blockbanner">{t("tw.keywarn")}</p>
          <Field
            label={t("tw.proxy")}
            hint={t("tw.proxyhint")}
          >
            <input value={c.proxyUrl} onChange={set("proxyUrl")} placeholder="https://api.grensrock.be/tickoweb" />
          </Field>
          <div className="gr-grid2">
            <Field label={t("tw.baseurl")}>
              <input value={c.baseUrl} onChange={set("baseUrl")} />
            </Field>
            <Field label={t("tw.apikey")}>
              <input type="password" value={c.apiKey} onChange={set("apiKey")} />
            </Field>
          </div>
          <Field label={t("tw.eventid")}>
            <input value={c.eventId} onChange={set("eventId")} placeholder="e.g. grensrock-2026" />
          </Field>
          <h4 className="gr-subhead">{t("tw.prodmap") || "Product mapping"}</h4>
          <p className="gr-muted">{t("tw.prodmap2")}</p>
          <div className="gr-grid2">
            {(Object.keys(VOUCHER_TYPES) as VoucherType[]).map(
              (k) => (
                <Field key={k} label={voucherLabel(VOUCHER_TYPES[k], lang, k)}>
                  <input
                    value={c.productIds?.[k] || ""}
                    onChange={(e) => setC({ ...c, productIds: { ...(c.productIds || {}), [k]: e.target.value } })}
                    placeholder={t("tw.productid")}
                  />
                </Field>
              ),
            )}
          </div>
        </>
      )}
      <p className="gr-muted">{t("tw.paths", { module: "tickoweb" })}</p>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="gr-btn" onClick={() => onSave(c)}>
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
