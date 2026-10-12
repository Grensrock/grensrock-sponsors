"use client";

import type { MouseEvent } from "react";

/* A contact's address or number as a link that mails or dials it. They sit in
   rows that open the contact's editor when clicked, so the click is kept from
   reaching the row: on a phone, ringing someone is why you looked them up, and
   the edit form instead is the wrong half of the row. */
const stop = (e: MouseEvent) => e.stopPropagation();
const none = <span className="gr-muted">—</span>;

export function MailLink({ email }: { email: string }) {
  if (!email) return none;
  return (
    <a className="gr-contactlink" href={`mailto:${email}`} onClick={stop}>
      {email}
    </a>
  );
}

export function PhoneLink({ phone }: { phone: string }) {
  /* tel: wants the digits and a leading +; the spaces, dots and slashes people
     type are for reading. A number with no digits at all stays plain text. */
  const dial = (phone || "").replace(/[^\d+]/g, "");
  if (!phone) return none;
  if (!/\d/.test(dial)) return <>{phone}</>;
  return (
    <a className="gr-contactlink gr-phonelink" href={`tel:${dial}`} onClick={stop}>
      {phone}
    </a>
  );
}
