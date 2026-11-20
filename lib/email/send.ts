import nodemailer, { type Transporter } from "nodemailer";

/* ============================================================
   Sending mail through Google Workspace — SERVER ONLY
   ============================================================
   grensrock.be already sends its mail through Google (MX smtp.google.com,
   SPF include:_spf.google.com), so going out via Workspace inherits the
   domain's existing SPF and DKIM and needs no new DNS. That is the main
   reason for this over a transactional provider: the SPF record ends in
   `-all`, so adding a third party would have meant editing it and
   getting that exactly right, with silent spam-foldering as the failure.

   Auth is an App Password, not the account's real password — generate it
   at myaccount.google.com/apppasswords for the sending account (needs
   2-Step Verification on). It is a credential, so it lives in the
   environment and never in the repo, same as SUPABASE_SECRET_KEY.

   Gmail refuses to send as an address the authenticated account has no
   rights to, so the From must be either the sending account itself or an
   alias / delegated address it owns. Get that wrong and the send fails
   outright rather than being silently rewritten.
   ============================================================ */

export class MailNotConfiguredError extends Error {}

let cached: Transporter | null = null;

export const mailConfigured = () => !!(process.env.GOOGLE_SMTP_USER && process.env.GOOGLE_SMTP_PASSWORD);

/* ---------- who the sponsor sees it from ----------
   Everything this app sends is sponsor correspondence, so it goes out as
   sponsors@grensrock.be rather than as whichever personal account happens
   to hold the App Password — a sponsor replying to a contract should reach
   the sponsor mailbox, not one person's inbox.

   That address must therefore be a send-as alias (or delegated mailbox) of
   GOOGLE_SMTP_USER in Workspace. GOOGLE_SMTP_FROM overrides it, which is
   what a deployment whose account owns a different address sets. */
export const SPONSORS_FROM = "Grensrock <sponsors@grensrock.be>";

const fromAddress = () => process.env.GOOGLE_SMTP_FROM || SPONSORS_FROM;

/* ---------- staging must never reach a real sponsor ----------
   Staging runs against its own database, but that database is seeded from
   real-looking data and the addresses in it are real people's. A contract
   mail sent from a preview deployment is not a cosmetic mistake — it is a
   sponsor being told their agreement is ready when it isn't.

   So the redirect is opt-OUT, not opt-in: only VERCEL_ENV === "production"
   mails the actual recipients. A preview deployment, a local dev server and
   anything that forgot to set VERCEL_ENV all funnel to one address. The
   failure mode of getting this wrong is then "the test mail went to Wout"
   rather than "a sponsor got a contract from staging".

   MAIL_REDIRECT_TO overrides the address; the default is deliberately a
   literal here rather than a required setting, because a missing setting
   must not be what re-enables sending to sponsors. */
export const MAIL_REDIRECT_FALLBACK = "wout@grensrock.be";

/** The address every message is diverted to, or null on production. */
export function mailRedirectTo(): string | null {
  if (process.env.VERCEL_ENV === "production") return null;
  return (process.env.MAIL_REDIRECT_TO || MAIL_REDIRECT_FALLBACK).trim() || null;
}

function transport(): Transporter {
  const user = process.env.GOOGLE_SMTP_USER;
  const pass = process.env.GOOGLE_SMTP_PASSWORD;
  if (!user || !pass) {
    throw new MailNotConfiguredError("Sending email is not configured on the server.");
  }
  /* Reused across invocations of a warm serverless instance: the TLS
     handshake to Gmail is the slow part, and it is pure waste to repeat
     it for every approval. */
  if (!cached) {
    cached = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // STARTTLS upgrades the connection; 587 must not start wrapped
      auth: { user, pass },
    });
  }
  return cached;
}

export interface Message {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  /** The same message laid out (lib/email/layout.ts). Optional: a client that
      shows no HTML, and a message without one, fall back to the text. */
  html?: string;
}

const addresses = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []).map((a) => a.trim()).filter(Boolean);

/**
 * Turns an intended message into the one actually handed to SMTP, applying
 * the staging redirect. Separate from the sending so the rule can be read —
 * and tested — without a mail server.
 */
export function composeForDelivery({ to, cc, subject, text, html }: Message) {
  const intended = addresses(to);
  if (intended.length === 0) throw new Error("No recipient address.");
  const copied = addresses(cc);

  const redirect = mailRedirectTo();
  if (!redirect) {
    return {
      to: intended,
      cc: copied,
      subject,
      text,
      html,
      redirected: false as const,
    };
  }

  /* Rewritten rather than added as a Bcc: a redirected message that still
     carries the sponsor's address in To: is one careless "reply all" away
     from doing the exact damage the redirect exists to prevent. The Cc goes
     the same way. The real recipients are written into the subject and the
     body instead, which is what makes a diverted mail readable as a test
     rather than confusing. */
  const reaches = [...intended, ...copied];
  const headers = intended.join(", ") + (copied.length ? `, cc ${copied.join(", ")}` : "");
  const note = `Not production. This message was addressed to ${headers} and diverted here.`;
  /* The laid-out part says it too, first thing: it is the part a mail app
     shows, so a note only in the text would go unseen. */
  const banner =
    `<div style="background:#FBEBDD;color:#AD5A1D;padding:10px 16px;font:13px/1.4 Arial,sans-serif;">` +
    `${note.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  return {
    to: [redirect],
    cc: [],
    subject: `[STAGING → ${reaches.join(", ")}] ${subject}`,
    text: `--- ${note} ---\n\n${text}`,
    html: html?.replace(/<body\b[^>]*>/i, (body) => body + banner),
    redirected: true as const,
  };
}

export async function sendMail(message: Message) {
  const out = composeForDelivery(message);
  await transport().sendMail({
    from: fromAddress(),
    to: out.to.join(", "),
    cc: out.cc.length ? out.cc.join(", ") : undefined,
    subject: out.subject,
    text: out.text,
    html: out.html,
  });
}
