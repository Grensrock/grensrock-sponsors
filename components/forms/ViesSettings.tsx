"use client";

import { useState } from "react";
import Field from "@/components/ui/Field";
import { defaultVies } from "@/lib/integrations/vies";
import type { ViesConfig, ViesMode } from "@/types";

/* ---------- VAT lookup settings ---------- */

export default function ViesSettings({
  value,
  onSave,
  onCancel,
}: {
  value?: ViesConfig | null;
  onSave: (cfg: ViesConfig) => void;
  onCancel: () => void;
}) {
  const [c, setC] = useState<ViesConfig>({ ...defaultVies, ...value });
  return (
    <div>
      <Field label="Mode">
        <select value={c.mode} onChange={(e) => setC({ ...c, mode: e.target.value as ViesMode })}>
          <option value="manual">Off — enter company details by hand</option>
          <option value="test">Test — VIES public test service (only test VAT numbers return data)</option>
          <option value="proxy">Live — through your own proxy server</option>
        </select>
      </Field>
      {c.mode === "test" && (
        <p className="gr-blockbanner">
          The test service only returns data for VIES&apos;s own sample VAT numbers, so real sponsors won&apos;t
          resolve. Use it to see how the button behaves; switch to Live for real lookups.
        </p>
      )}
      {c.mode === "proxy" && (
        <>
          <p className="gr-blockbanner">
            VIES API needs a private key and a signed Authorization header that a browser can&apos;t send. Point this
            at a small server of your own that holds the key, calls viesapi.eu, and returns the JSON. It should accept
            the VAT number appended to the URL: <code>{"{proxyUrl}/BE0123456789"}</code>.
          </p>
          <Field label="Proxy URL">
            <input
              value={c.proxyUrl}
              onChange={(e) => setC({ ...c, proxyUrl: e.target.value })}
              placeholder="https://api.grensrock.be/vies"
            />
          </Field>
        </>
      )}
      <p className="gr-muted">
        Lookups fill in company name and address; you can still edit everything afterwards. The VAT number itself is
        always validated locally regardless of this setting.
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
