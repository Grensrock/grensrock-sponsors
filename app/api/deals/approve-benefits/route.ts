import { NextResponse, type NextRequest } from "next/server";
import { LANGS } from "@/lib/constants";
import { deliverAgreement } from "@/lib/email/agreement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Language, PendingMail } from "@/types";

/* ============================================================
   POST /api/deals/approve-benefits  { dealId }
   ============================================================
   An admin approves benefits a team member set apart from the formula
   (0026), or an agreement they made Op maat (0028), and the agreement mail
   held for that approval goes out — to the
   sponsor's contacts, with the responsible in Cc, exactly as it would have
   gone without the wait (lib/email/agreement.ts).

   A route rather than a plain update from the browser because of that
   mail: the Workspace App Password must never reach a browser.

   The approval comes first and stands on its own. The held mail is the
   team member's, and a mail that can't go out right now is no reason to
   take the admin's decision back: the answer says what happened to it,
   and the app then offers the mail to send by hand.

   Only an id comes in. Both writes go through the admin's own session,
   so the audit trail records them, and the database (0026) only takes an
   approval from an admin anyway.
   ============================================================ */

export const runtime = "nodejs"; // nodemailer opens a TCP connection; not available on edge

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

  const { data: caller } = await supabase
    .from("profiles")
    .select("id, role, approved, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller?.approved || caller.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can approve changed benefits." }, { status: 403 });
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, sponsor_id, benefits_changed_at, benefits_approved_at, pending_mail")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "No such agreement." }, { status: 404 });
  if (!deal.benefits_changed_at || deal.benefits_approved_at) {
    return NextResponse.json({ error: "This agreement isn't waiting for approval." }, { status: 409 });
  }

  /* Read before the approval: approving is what drops it from the row. */
  const held = deal.pending_mail as PendingMail | null;

  const { error } = await supabase
    .from("deals")
    .update({
      benefits_approved_at: new Date().toISOString(),
      benefits_approved_by: [caller.first_name, caller.last_name].filter(Boolean).join(" "),
    })
    .eq("id", dealId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!held) return NextResponse.json({ approved: true, sent: null, mailError: null });

  const result = await deliverAgreement(
    supabase,
    deal,
    {
      contactIds: Array.isArray(held.contactIds) ? held.contactIds.map(String) : [],
      subject: String(held.subject || ""),
      body: String(held.body || ""),
      language: (Object.hasOwn(LANGS, held.language) ? held.language : "nl") as Language,
    },
    request.nextUrl.origin,
  );
  if (!result.ok) return NextResponse.json({ approved: true, sent: null, mailError: result.error });
  return NextResponse.json({
    approved: true,
    sent: { sentAt: result.sentAt, to: result.to, cc: result.cc, warnings: result.warnings },
    mailError: null,
  });
}
