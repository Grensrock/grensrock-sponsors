import type { Language } from "@/types";

/* ============================================================
   The look of a mail to a sponsor
   ============================================================
   Every sponsor mail is written as plain text first, and that text stays
   the source: it is what the team edits in the agreement preview, and it
   goes out as the text/plain part beside this. The HTML is derived from
   it, never written separately, so the two parts can't drift apart — and
   an edited agreement looks as finished as a generated one.

   What the text already says decides the markup, by the shapes the
   templates in lib/email-templates.ts write:
     - a link alone on its line becomes a button, when the caller gives it
       a label (a label is a sentence in the mail's language, which only
       the caller knows); without one it stays a link
     - lines starting with • or - become a list
     - a block of "Label: value" lines becomes a summary card
     - a short line ending in ":" over more lines becomes a section heading
   Anything else is a paragraph, so text that fits none of these still
   reads as written.

   Mail clients are not browsers: Gmail drops <style> rules it doesn't
   like and Outlook renders with Word. So the layout is tables with inline
   styles, the web fonts are a bonus with a system fallback, and nothing
   depends on images, which many clients block until asked.
   ============================================================ */

/* The app's palette (styles/grensrock.css). */
const STAGE = "#0A0A0A";
const PAPER = "#FCFBF8";
const BACKDROP = "#F1EEE8";
const INK = "#1C1A1C";
const LINE = "#E4E1DA";
const MUT = "#6E6A73";
const SUB = "#B9B4C0";
const PINK = "#C9518D";
const PINK_DEEP = "#A0356C";
/* The --rainbow stripe, as five bands: CSS gradients don't survive Outlook. */
const RAINBOW = ["#4A90C4", "#4FA05F", "#C9C463", "#DE8140", "#C9518D"];

const HEAD = "'Montserrat','Arial Black',Arial,sans-serif";
const BODY = "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
const FONTS =
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&family=IBM+Plex+Sans:wght@400;600&display=swap";

const URL_ONLY = /^https?:\/\/\S+$/;
const URL_ANY = /https?:\/\/[^\s<>"]+/g;
const BULLET = /^\s*[•\-*]\s+(.*)$/;
const PAIR = /^([^:]+?)\s?:\s+(\S.*)$/;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* A label is a few words and no sentence: "BTW-nummer" or "Numéro de TVA",
   not "Te factureren bedrag: … De facturatie volgt" cut at its colon. */
const isLabel = (s: string) => s.trim().split(/\s+/).length <= 4 && !/[.,;!?]/.test(s) && !/https?:/.test(s);
const isHeading = (line: string) => /:\s*$/.test(line) && isLabel(line.replace(/\s*:\s*$/, ""));
const isPair = (line: string) => {
  const m = PAIR.exec(line.trim());
  return !!m && isLabel(m[1]);
};

/* Escapes the text and makes any link in it clickable. A sentence's full
   stop or a closing bracket after a link is the sentence's, not the link's.
   French spaces off its : ; ! ? and « », and a narrow column would otherwise
   wrap them onto a line of their own. */
function inline(text: string) {
  text = text.replace(/ ([:;!?»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
  let out = "";
  let last = 0;
  for (const m of text.matchAll(URL_ANY)) {
    const url = m[0].replace(/[.,;:!?)]+$/, "");
    const at = m.index ?? 0;
    out += esc(text.slice(last, at));
    out += `<a href="${esc(url)}" target="_blank" style="color:${PINK_DEEP};text-decoration:underline;">${esc(url)}</a>`;
    last = at + url.length;
  }
  return out + esc(text.slice(last));
}

const P = `margin:0 0 16px;font-family:${BODY};font-size:15px;line-height:24px;color:${INK};`;

const paragraph = (lines: string[]) => `<p style="${P}">${lines.map((l) => inline(l.trim())).join("<br>")}</p>`;

const heading = (line: string) =>
  `<p style="margin:26px 0 10px;font-family:${BODY};font-size:12px;line-height:16px;font-weight:600;` +
  `letter-spacing:1.5px;text-transform:uppercase;color:${MUT};">${esc(line.replace(/\s*:\s*$/, ""))}</p>`;

/* Outlook ignores padding on a link, so the cell carries the colour and,
   through mso-padding-alt, the size; everywhere else the whole padded
   link is the target, not just its words. */
const button = (url: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">` +
  `<tr><td bgcolor="${PINK_DEEP}" style="background:${PINK_DEEP};border-radius:8px;mso-padding-alt:14px 28px;">` +
  `<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${BODY};` +
  `font-size:16px;line-height:20px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">` +
  `${esc(label)}</a></td></tr></table>`;

/* Bullets in the rainbow's colours, in turn — the stripe at the top, picked up
   again down the list. A cell rather than a list item, which Outlook indents
   however it likes. */
const list = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">` +
  items
    .map(
      (item, i) =>
        `<tr><td width="22" valign="top" style="padding:8px 0 0;">` +
        `<div style="width:8px;height:8px;border-radius:4px;background:${RAINBOW[i % RAINBOW.length]};` +
        `font-size:0;line-height:0;">&nbsp;</div></td>` +
        `<td style="padding:0 0 8px;font-family:${BODY};font-size:15px;line-height:24px;color:${INK};">` +
        `${inline(item.trim())}</td></tr>`,
    )
    .join("") +
  `</table>`;

const card = (lines: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
  `style="margin:0 0 24px;background:${PAPER};border:1px solid ${LINE};border-left:4px solid ${PINK};border-radius:8px;">` +
  `<tr><td style="padding:12px 18px;">` +
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
  lines
    .map((line) => {
      const [, k, v] = PAIR.exec(line.trim()) as RegExpExecArray;
      return (
        `<tr><td valign="top" style="padding:5px 16px 5px 0;width:38%;font-family:${BODY};font-size:14px;` +
        `line-height:22px;color:${MUT};">${esc(k)}</td>` +
        `<td valign="top" style="padding:5px 0;font-family:${BODY};font-size:15px;line-height:22px;` +
        `font-weight:600;color:${INK};">${inline(v)}</td></tr>`
      );
    })
    .join("") +
  `</table></td></tr></table>`;

function block(lines: string[], buttons: Record<string, string>) {
  let out = "";
  if (lines.length > 1 && isHeading(lines[0]) && !URL_ONLY.test(lines[1].trim())) {
    out += heading(lines[0]);
    lines = lines.slice(1);
  }
  if (lines.length > 1 && lines.every(isPair)) return out + card(lines);

  let para: string[] = [];
  let items: string[] = [];
  const flush = () => {
    if (para.length) out += paragraph(para);
    if (items.length) out += list(items);
    para = [];
    items = [];
  };
  for (const line of lines) {
    const t = line.trim();
    const bullet = BULLET.exec(line);
    if (URL_ONLY.test(t)) {
      flush();
      out += buttons[t] ? button(t, buttons[t]) : paragraph([t]);
    } else if (bullet) {
      if (para.length) flush();
      items.push(bullet[1]);
    } else {
      if (items.length) flush();
      para.push(line);
    }
  }
  flush();
  return out;
}

const WORDS: Record<Language, { portal: string; reply: string }> = {
  nl: { portal: "Sponsorportaal", reply: "Vragen? Beantwoord gewoon deze e-mail." },
  fr: { portal: "Portail sponsors", reply: "Des questions ? Répondez simplement à cet e-mail." },
  en: { portal: "Sponsor portal", reply: "Questions? Just reply to this email." },
};

export interface EmailLayout {
  /** The plain-text message, exactly as it goes out as the text part. */
  text: string;
  lang: Language;
  /** The big line above the message. */
  heading: string;
  /** Links that become buttons, mapped to the button's words. A link must be
      alone on its line for this; any other stays a link in the text. */
  buttons?: Record<string, string>;
}

export function renderEmailHtml({ text, lang, heading: title, buttons = {} }: EmailLayout) {
  const words = WORDS[lang] || WORDS.nl;
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((b) => b.split("\n").filter((l) => l.trim()))
    .filter((b) => b.length);

  /* The inbox shows the start of the mail beside the subject. Without this it
     would be the header's "GRENS ROCK SPONSORPORTAAL"; the line after the
     greeting says what the mail is about. */
  const preview = (blocks[1] || blocks[0] || [])
    .join(" ")
    .replace(URL_ANY, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  const stripe = RAINBOW.map(
    (c) => `<td width="20%" height="5" bgcolor="${c}" style="background:${c};height:5px;font-size:0;line-height:0;">&nbsp;</td>`,
  ).join("");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<link href="${FONTS}" rel="stylesheet">
<style>
  body { margin:0; padding:0; }
  @media (max-width:620px) {
    .gr-pad { padding-left:22px !important; padding-right:22px !important; }
    .gr-h1 { font-size:22px !important; line-height:28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BACKDROP};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BACKDROP}" style="background:${BACKDROP};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td align="center" bgcolor="${STAGE}" class="gr-pad" style="background:${STAGE};padding:30px 36px 24px;border-radius:12px 12px 0 0;">
<div style="font-family:${HEAD};font-size:34px;line-height:31px;font-weight:900;color:#FFFFFF;">GRENS<br>ROCK</div>
<div style="margin-top:12px;font-family:${BODY};font-size:11px;line-height:14px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:${SUB};">${esc(words.portal)}</div>
</td></tr>
<tr><td style="font-size:0;line-height:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${stripe}</tr></table></td></tr>
<tr><td bgcolor="#FFFFFF" class="gr-pad" style="background:#FFFFFF;padding:34px 36px 18px;border-radius:0 0 12px 12px;">
<h1 class="gr-h1" style="margin:0 0 22px;font-family:${HEAD};font-size:24px;line-height:30px;font-weight:800;color:${INK};">${esc(title)}</h1>
${blocks.map((b) => block(b, buttons)).join("\n")}
</td></tr>
<tr><td align="center" class="gr-pad" style="padding:22px 36px 8px;font-family:${BODY};font-size:12px;line-height:19px;color:${MUT};">
${esc(words.reply)}<br>
<a href="https://grensrock.be" target="_blank" style="color:${MUT};text-decoration:underline;">grensrock.be</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
