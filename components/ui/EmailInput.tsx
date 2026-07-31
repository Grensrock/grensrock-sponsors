"use client";

import { mailMessage, validateEmail } from "@/lib/email-validate";
import type { Language } from "@/types";

/* Shared email input with live validation feedback */
export default function EmailInput({
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
  const res = validateEmail(value);
  return (
    <>
      <input
        type="email"
        value={value}
        onChange={onChange}
        placeholder={placeholder || "naam@bedrijf.be"}
        style={res && !res.valid ? { borderColor: "var(--red)" } : undefined}
      />
      {res && !res.valid && (
        <span className="gr-hint" style={{ color: "var(--red)" }}>
          {mailMessage(res.code, lang)}
        </span>
      )}
    </>
  );
}
