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
   rights to, so GOOGLE_SMTP_FROM must be either the sending account
   itself or an alias / delegated address it owns. Get that wrong and the
   send fails outright rather than being silently rewritten.
   ============================================================ */

export class MailNotConfiguredError extends Error {}

let cached: Transporter | null = null;

export const mailConfigured = () => !!(process.env.GOOGLE_SMTP_USER && process.env.GOOGLE_SMTP_PASSWORD);

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

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const from = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER || "";
  await transport().sendMail({ from, to, subject, text });
}
