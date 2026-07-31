"use client";

import { validateVat, vatMessage } from "@/lib/vat";
import type { Language } from "@/types";

/* Shared VAT input with live validation feedback */
export default function VatInput({
  value,
  onChange,
  lang = "en",
  placeholder,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  lang?: Language;
  placeholder?: string;
}) {
  const res = validateVat(value);
  return (
    <>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder || "BE 0123.456.789"}
        style={res && !res.valid ? { borderColor: "var(--red)" } : undefined}
      />
      {res && !res.valid && (
        <span className="gr-hint" style={{ color: "var(--red)" }}>
          {vatMessage(res.code, lang)}
        </span>
      )}
      {res && res.valid && (
        <span className="gr-hint" style={{ color: "var(--green)" }}>
          ✓ {res.formatted}
        </span>
      )}
    </>
  );
}
