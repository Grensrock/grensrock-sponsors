import { NextResponse, type NextRequest } from "next/server";
import { buildAgreementCreated } from "@/lib/email-templates";
import { MailNotConfiguredError, mailConfigured, sendMail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Settlement, User } from "@/types";

/* ============================================================
   POST /api/deals/notify-created  { dealId }
   ============================================================
   Tells the admins a new agreement exists. Called by the browser right
   after it creates one — the team through the agreement form, a sponsor
   through request_formula() in the portal — because the Workspace App
   Password must never reach a browser.

   Like the access-granted mail, only an id crosses the wire: the
   recipients are the admins as the database has them, and everything the
   message says is read back from the rows. Two checks keep this from
   being a "mail the admins" button:
   - the agreement must be one the caller can see (RLS, via their own
     session), and
   - it must have been created moments ago. The caller is the one who just
     created it, so there is no legitimate reason to ask later.
   A sponsor may only announce an agreement that request_formula() made
   (requested_at is set), never one the team made for them.

   Whoever created it is not mailed about their own work: an admin making
   an agreement doesn't need to be told about it.
   ============================================================ */

export const runtime = "nodejs"; // nodemailer opens a TCP connection; not available on edge

/* The browser calls this straight after the insert; the margin only absorbs a
   slow connection and clock drift between the server and the database. */
const FRESH_FOR_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  let body: { dealId?: string };
  try {
    body = (await request.json()) as { dealId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const dealId = String(body.dealId || "").trim();
  if (!dealId) return NextResponse.json({ error: "An agreement id is required." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  /* Through the caller's session, so RLS decides whether they may see it. */
  const { data: deal } = await supabase
    .from("deals")
    .select("id, sponsor_id, edition_id, formula_name, cost, settlement, created_at, requested_at, requested_by")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "No such agreement." }, { status: 404 });

  const createdAt = Date.parse(String(deal.created_at || ""));
  if (!(Date.now() - createdAt < FRESH_FOR_MS)) {
    return NextResponse.json({ error: "Only a newly created agreement can be announced." }, { status: 409 });
  }

  /* A sponsor portal session has no profiles row, so no approved profile
     means the request came from the portal. */
  const { data: caller } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, approved")
    .eq("id", user.id)
    .maybeSingle();
  const viaPortal = !caller?.approved;
  if (viaPortal && !deal.requested_at) {
    return NextResponse.json({ error: "This agreement wasn't requested through the portal." }, { status: 403 });
  }
  const createdBy = viaPortal
    ? String(deal.requested_by || "").trim()
    : [caller?.first_name, caller?.last_name].filter(Boolean).join(" ");

  if (!mailConfigured()) {
    return NextResponse.json({ error: "Sending email is not configured on the server." }, { status: 503 });
  }

  /* The admin client, because a sponsor may not read profiles at all, and a
     team member reads them only as far as RLS lets them. */
  const admin = createSupabaseAdminClient();
  const [{ data: sponsor }, { data: edition }, { data: admins, error: adminsError }] = await Promise.all([
    admin.from("sponsors").select("company_name").eq("id", deal.sponsor_id).maybeSingle(),
    admin.from("editions").select("name").eq("id", deal.edition_id).maybeSingle(),
    admin
      .from("profiles")
      .select("id, first_name, last_name, email, role, approved, language")
      .eq("role", "admin")
      .eq("approved", true),
  ]);
  if (adminsError) return NextResponse.json({ error: adminsError.message }, { status: 500 });

  const recipients = (admins || []).filter((a) => a.id !== user.id && String(a.email || "").trim());
  if (recipients.length === 0) return NextResponse.json({ sent: false, to: [], warnings: [] });

  const terms = {
    formulaName: String(deal.formula_name || ""),
    cost: Number(deal.cost) || 0,
    settlement: (deal.settlement || "invoice") as Settlement,
  };

  /* One mail per admin, each in their own language. A failure for one is
     reported and the others still go — same as the agreement mail itself. */
  const warnings: string[] = [];
  const sentTo: string[] = [];
  for (const row of recipients) {
    const to: User = {
      id: String(row.id),
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: row.email || "",
      role: row.role,
      approved: !!row.approved,
      language: row.language,
    };
    const { subject, body: text } = buildAgreementCreated(
      to,
      terms,
      sponsor?.company_name || "",
      edition?.name || "",
      { name: createdBy, viaPortal },
      request.nextUrl.origin,
    );
    try {
      await sendMail({ to: to.email, subject, text });
      sentTo.push(to.email);
    } catch (ex) {
      if (ex instanceof MailNotConfiguredError) {
        return NextResponse.json({ error: ex.message }, { status: 503 });
      }
      warnings.push(`The mail to ${to.email} could not be sent: ${ex instanceof Error ? ex.message : "unknown error"}`);
    }
  }

  if (sentTo.length === 0) {
    return NextResponse.json({ error: warnings.join("\n") || "Could not send the email." }, { status: 502 });
  }
  return NextResponse.json({ sent: true, to: sentTo, warnings });
}
