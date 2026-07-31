"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import { VOUCHER_TYPES } from "@/lib/constants";
import { defaultTickoweb } from "@/lib/integrations/tickoweb";
import type { TickowebConfig, TickowebMode, TranslateFn, VoucherType } from "@/types";

/* ---------- Tickoweb settings ---------- */

export default function TickowebSettings({
  value,
  onSave,
  onCancel,
  t = (k) => k,
}: {
  value?: TickowebConfig | null;
  onSave: (cfg: TickowebConfig) => void;
  onCancel: () => void;
  t?: TranslateFn;
}) {
  const [c, setC] = useState<TickowebConfig>({ ...defaultTickoweb, ...value });
  const set = (k: keyof TickowebConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setC({ ...c, [k]: e.target.value } as TickowebConfig);
  return (
    <div>
      <Field label="Mode">
        <select value={c.mode} onChange={(e) => setC({ ...c, mode: e.target.value as TickowebMode })}>
          <option value="manual">Manual — create vouchers in Tickoweb yourself, paste the codes here</option>
          <option value="live">Live — call the Tickoweb API from this tool</option>
        </select>
      </Field>
      {c.mode === "live" && (
        <>
          <p className="gr-blockbanner">
            An API key in a browser app is readable by anyone using it, and Tickoweb will likely block direct browser
            calls (CORS). Point &quot;Proxy URL&quot; at a small server of your own that holds the key and forwards
            the calls — leave the API key here empty in that case.
          </p>
          <Field
            label="Proxy URL (recommended)"
            hint="Your own endpoint that forwards to Tickoweb with the key attached"
          >
            <input value={c.proxyUrl} onChange={set("proxyUrl")} placeholder="https://api.grensrock.be/tickoweb" />
          </Field>
          <div className="gr-grid2">
            <Field label="Tickoweb base URL">
              <input value={c.baseUrl} onChange={set("baseUrl")} />
            </Field>
            <Field label="API key (only without proxy)">
              <input type="password" value={c.apiKey} onChange={set("apiKey")} />
            </Field>
          </div>
          <Field label="Event ID in Tickoweb">
            <input value={c.eventId} onChange={set("eventId")} placeholder="e.g. grensrock-2026" />
          </Field>
          <h4 className="gr-subhead">{t("tw.prodmap") || "Product mapping"}</h4>
          <p className="gr-muted">{t("tw.prodmap2")}</p>
          <div className="gr-grid2">
            {(Object.entries(VOUCHER_TYPES) as Array<[VoucherType, { label: string; kind: string }]>).map(
              ([k, vt]) => (
                <Field key={k} label={vt.label}>
                  <input
                    value={c.productIds?.[k] || ""}
                    onChange={(e) => setC({ ...c, productIds: { ...(c.productIds || {}), [k]: e.target.value } })}
                    placeholder="Tickoweb product id"
                  />
                </Field>
              ),
            )}
          </div>
        </>
      )}
      <p className="gr-muted">
        The endpoint paths used ( POST /vouchers, POST /vouchers/&#123;code&#125;/send, DELETE
        /vouchers/&#123;code&#125; ) are assumptions — verify them against the Tickoweb reference and adjust the{" "}
        <code>tickoweb</code> module in the code.
      </p>
      <div className="gr-actions">
        <button className="gr-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="gr-btn" onClick={() => onSave(c)}>
          Save
        </button>
      </div>
    </div>
  );
}
