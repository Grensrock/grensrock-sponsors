import { NextResponse, type NextRequest } from "next/server";
import { rowToFormulaFields } from "@/lib/api/util";
import { buildAgreementCreated, buildBenefitsChanged } from "@/lib/email-templates";
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

   Also called after a team member changes the benefits of an agreement
   that already existed, when that leaves it waiting for an admin's
   approval (0026). Then the mail asks for that approval. A new agreement
   that waits says so too, before anything else.

   Like the access-granted mail, only an id crosses the wire: the
   recipients are the admins as the database has them, and everything the
   message says is read back from the rows. Two checks keep this from
   being a "mail the admins" button:
   - the agreement must be one the caller can see (RLS, via their own
     session), and
   - it must have been created, or put up for approval, moments ago. The
     caller is the one who just did that, so there is no legitimate reason
     to ask later.
   A sponsor may only announce an agreement that request_formula() made
   (requested_at is set), never one the team made for them.

   Whoever created it is not mailed about their own work: an admin making
   an agreement doesn't need to be told about it.
   ============================================================ */

export const runtime = "nodejs"; // nodemailer opens a TCP connection; not available on edge

/* The browser calls this straight after the save; the margin only absorbs a
   slow connection and clock drift between the server and the database. */
const FRESH_FOR_MS = 10 * 60 * 1000;
const fresh = (at: unknown) => Date.now() - Date.parse(String(at || "")) < FRESH_FOR_MS;

/* What the admins are told about besides the formula, cost and settlement:
   the benefits, to list what differs from the formula. */
const BENEFIT_COLUMNS =
  "vip_friday, vip_saturday, vip_guests, drink_value, food_drink_value, base_food_drink, folder_mention, website_mention, poster_mention, ledboarding, fence_covers";

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
    .select(
      `id, sponsor_id, edition_id, formula_name, cost, settlement, created_at, requested_at, requested_by, benefits_changed_at, benefits_approved_at, ${BENEFIT_COLUMNS}`,
    )
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "No such agreement." }, { status: 404 });

  const waiting = !!deal.benefits_changed_at && !deal.benefits_approved_at;
  const isNew = fresh(deal.created_at);
  if (!isNew && !(waiting && fresh(deal.benefits_changed_at))) {
    return NextResponse.json(
      { error: "Only a newly created agreement, or one newly waiting for approval, can be announced." },
      { status: 409 },
    );
  }

  /* A sponsor portal session has no profiles row, so no approved profile
     means the request came from the portal. */
  const { data: caller } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, approved")
    .eq("id", user.id)
    .maybeSingle();
  const viaPortal = !caller?.approved;
  if (viaPortal && !(isNew && deal.requested_at)) {
    return NextResponse.json({ error: "This agreement wasn't requested through the portal." }, { status: 403 });
  }
  const actor = viaPortal
    ? String(deal.requested_by || "").trim()
    : [caller?.first_name, caller?.last_name].filter(Boolean).join(" ");

  if (!mailConfigured()) {
    return NextResponse.json({ error: "Sending email is not configured on the server." }, { status: 503 });
  }

  /* The admin client, because a sponsor may not read profiles at all, and a
     team member reads them only as far as RLS lets them. */
  const admin = createSupabaseAdminClient();
  const [{ data: sponsor }, { data: edition }, { data: formulaRow }, { data: admins, error: adminsError }] =
    await Promise.all([
      admin.from("sponsors").select("company_name").eq("id", deal.sponsor_id).maybeSingle(),
      admin.from("editions").select("name").eq("id", deal.edition_id).maybeSingle(),
      admin
        .from("formulas")
        .select(BENEFIT_COLUMNS)
        .eq("edition_id", deal.edition_id)
        .eq("name", deal.formula_name)
        .maybeSingle(),
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
    ...rowToFormulaFields(deal),
    formulaName: String(deal.formula_name || ""),
    cost: Number(deal.cost) || 0,
    settlement: (deal.settlement || "invoice") as Settlement,
  };
  const formula = formulaRow ? rowToFormulaFields(formulaRow) : null;

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
    const sponsorName = sponsor?.company_name || "";
    const editionName = edition?.name || "";
    const appUrl = request.nextUrl.origin;
    const { subject, body: text } = isNew
      ? buildAgreementCreated(
          to,
          terms,
          sponsorName,
          editionName,
          { name: actor, viaPortal },
          appUrl,
          waiting ? { formula } : null,
        )
      : buildBenefitsChanged(to, terms, sponsorName, editionName, actor, formula, appUrl);
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
