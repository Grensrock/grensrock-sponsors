import { NextResponse, type NextRequest } from "next/server";
import { buildAccessGranted } from "@/lib/email-templates";
import { MailNotConfiguredError, mailConfigured, sendMail } from "@/lib/email/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/types";

/* ============================================================
   POST /api/team/access-granted  { userId }
   ============================================================
   Tells someone an admin has turned their registration into access
   (0011_team_access_approval.sql). Server-side because the Workspace App
   Password must never reach a browser — same reasoning as the CBE key.

   The recipient's address is read from the database, never taken from
   the request body: the body carries an id and nothing else, so a caller
   cannot use this route to mail an arbitrary address. Everything else in
   the message is read back from the row too, which also means the email
   describes the access that actually exists rather than what the client
   believed it was granting.

   Only admins may call it, and only for a profile that is genuinely
   approved — sending "you have access" to someone who does not would be
   worse than sending nothing.
   ============================================================ */

export const runtime = "nodejs"; // nodemailer opens a TCP connection; not available on edge

export async function POST(request: NextRequest) {
  let body: { userId?: string };
  try {
    body = (await request.json()) as { userId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const userId = String(body.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "A user id is required." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  /* RLS applies to this client, so this only reads what the caller may read. */
  const { data: caller } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, approved, language")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller || caller.role !== "admin" || !caller.approved) {
    return NextResponse.json({ error: "Only admins can do this." }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, approved, language")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "No such team member." }, { status: 404 });
  if (!target.approved) {
    return NextResponse.json({ error: "That account hasn't been granted access." }, { status: 409 });
  }
  if (!target.email) return NextResponse.json({ error: "That account has no email address." }, { status: 409 });

  if (!mailConfigured()) {
    return NextResponse.json({ error: "Sending email is not configured on the server." }, { status: 503 });
  }

  const toUser = (r: typeof target): User => ({
    id: String(r.id),
    firstName: r.first_name || "",
    lastName: r.last_name || "",
    email: r.email || "",
    role: r.role,
    approved: !!r.approved,
    language: r.language,
  });

  const { subject, body: text } = buildAccessGranted(toUser(target), toUser(caller), request.nextUrl.origin);

  try {
    await sendMail({ to: target.email, subject, text });
  } catch (ex) {
    const status = ex instanceof MailNotConfiguredError ? 503 : 502;
    return NextResponse.json(
      { error: ex instanceof Error ? ex.message : "Could not send the email." },
      { status },
    );
  }

  return NextResponse.json({ sent: true, to: target.email });
}
