/* ============================================================
   vCard — a contact person as a card a phone can add
   ============================================================
   Version 3.0 rather than 4.0: it is the one both the iPhone and
   Android contact apps read without complaint, and it needs nothing
   4.0 adds. The charset travels in the HTTP Content-Type, as 3.0 has
   it; the CHARSET= parameter belongs to 2.1. See RFC 2426 (3.0) and,
   for the escaping and folding it shares with 4.0, RFC 6350 §3.
   ============================================================ */

export interface VCardPerson {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
}

/* In a text value a backslash, comma and semicolon are escaped, and a line
   break becomes a literal \n — a ; would otherwise split N or ORG into parts. */
const esc = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n|\r|\n/g, "\\n");

const utf8Bytes = (ch: string) => {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
};

/* A line longer than 75 octets is folded: CRLF plus one space, which the
   reader drops. Counted in UTF-8 bytes and never inside a character, so a
   long name with accents still comes back whole. */
function fold(line: string): string {
  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = utf8Bytes(ch);
    const room = parts.length ? 74 : 75; // the leading space counts on a continuation
    if (bytes + n > room) {
      parts.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

const fullName = (p: VCardPerson) => [p.firstName, p.lastName].map((s) => (s || "").trim()).filter(Boolean).join(" ");

export function contactVCard(p: VCardPerson): string {
  const first = (p.firstName || "").trim();
  const last = (p.lastName || "").trim();
  const company = (p.company || "").trim();
  const email = (p.email || "").trim();
  const phone = (p.phone || "").trim();
  /* FN is the one required property. A contact can't be saved without a
     first or last name, so the fallbacks are only a guard. */
  const fn = fullName(p) || company || email || "Contact";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(fn)}`,
    company && `ORG:${esc(company)}`,
    email && `EMAIL;TYPE=INTERNET,WORK:${email}`,
    /* Kept as typed, spaces and slashes included: it is how the number reads
       in the portal, and the phone dials the digits. Like PhoneLink, a value
       with no digit at all is not a number to dial. */
    /\d/.test(phone) && `TEL;TYPE=WORK,VOICE:${esc(phone)}`,
    "END:VCARD",
  ].filter((l): l is string => !!l);

  return lines.map(fold).join("\r\n") + "\r\n";
}

/* "Jan Peeters.vcf": what the phone or the downloads folder shows. The plain
   name is for browsers that only read filename=; filename* keeps accents. */
export function vCardDisposition(p: VCardPerson): string {
  const name = (fullName(p) || "contact").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim() || "contact";
  const ascii =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7e]/g, "")
      .trim() || "contact";
  /* encodeURIComponent leaves ' ( ) * alone, which RFC 5987 does not allow bare. */
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `inline; filename="${ascii}.vcf"; filename*=UTF-8''${encoded}.vcf`;
}
