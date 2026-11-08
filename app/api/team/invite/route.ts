import { NextResponse, type NextRequest } from "next/server";
import { buildTeamAccountAdded } from "@/lib/email-templates";
import { sendMail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/types";

/* ============================================================
   Add a team member (admin only)
   ============================================================
   profiles.id is a FK to auth.users(id), so a team account can't be
   created client-side: someone has to create the auth user. This route
   does it in four steps:

     1. Authenticate the caller from their own session cookies and
        confirm they have an approved profiles row with role = 'admin'
        (RLS applies to this client, so it can only read what it may read).
     2. Create the auth user with the admin client (Auth admin API needs
        the secret key). It is created with its address already confirmed
        and without sending anything: the person signs in with Google, and
        Auth links that Google identity to this user by the shared, verified
        address — so they land on the profile made in step 3.
     3. Insert the matching profiles row with the admin client —
        profiles has no INSERT policy by design (0003_rls.sql), the
        only two writers are ensure_team_profile() and this route.
     4. Mail them through Workspace (lib/email/send.ts), in their own
        language and in the same layout as the sponsor mails.

   Why not Supabase's own invite (inviteUserByEmail), which this used to
   be: that mail comes from Auth's dashboard template and mailer rather
   than ours, in one language, and its link leads to /auth/callback, which
   since the move to Google sign-in only takes a Google code or a sponsor
   sign-in link — so the link it carried ended on "link broken".

   The account stands whether or not the mail goes out: a failed send
   comes back as `mailError` next to the user, for the Team tab to say out
   loud, and "Copy invite" there sends the same text by hand.
   ============================================================ */

export const runtime = "nodejs"; // nodemailer opens a TCP connection; not available on edge

interface InviteBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  language?: string;
}

const COLUMNS = "id, first_name, last_name, email, role, approved, language";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: User["role"];
  approved: boolean | null;
  language: User["language"] | null;
};

const toUser = (r: ProfileRow): User => ({
  id: String(r.id),
  firstName: r.first_name || "",
  lastName: r.last_name || "",
  email: r.email || "",
  role: r.role,
  approved: !!r.approved,
  language: r.language === "en" ? "en" : "nl",
});

export async function POST(request: NextRequest) {
  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const role = body.role === "admin" ? "admin" : "user";
  const language = body.language === "en" ? "en" : "nl";

  if (!email) return NextResponse.json({ error: "An e-mail address is required." }, { status: 400 });

  /* ----- 1. caller must be an approved admin ----- */
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select(COLUMNS).eq("id", user.id).maybeSingle<ProfileRow>();
  if (!caller || caller.role !== "admin" || !caller.approved) {
    return NextResponse.json({ error: "Only admins can add team members." }, { status: 403 });
  }

  /* ----- 2. the auth user, confirmed, nothing sent ----- */
  const admin = createSupabaseAdminClient();
  const { data: authData, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (createError || !authData?.user) {
    return NextResponse.json({ error: createError?.message || "Could not create the account." }, { status: 400 });
  }

  /* ----- 3. matching profiles row ----- */
  /* approved: an admin adding someone by hand *is* the granting of access
     (0011). Only self-registration through ensure_team_profile() has to wait. */
  const { data: created, error: profileError } = await admin
    .from("profiles")
    .insert({ id: authData.user.id, first_name: firstName, last_name: lastName, email, role, language, approved: true })
    .select(COLUMNS)
    .single<ProfileRow>();

  if (profileError || !created) {
    /* Nothing has been sent yet, so undoing the auth user leaves no trace —
       and leaving it would make every retry fail on "already registered". */
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError?.message || "Could not create the account." }, { status: 400 });
  }

  /* ----- 4. tell them ----- */
  const added = toUser(created);
  let mailError: string | null = null;
  try {
    const { subject, body: text, html } = buildTeamAccountAdded(added, toUser(caller), request.nextUrl.origin);
    await sendMail({ to: email, subject, text, html });
  } catch (ex) {
    mailError = ex instanceof Error ? ex.message : "Could not send the email.";
  }

  return NextResponse.json({ user: added, mailError });
}
