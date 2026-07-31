import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ============================================================
   Invite a new team member (admin only)
   ============================================================
   profiles.id is a FK to auth.users(id), so a team account can't be
   created client-side: someone has to create the auth user. This route
   does it in three steps:

     1. Authenticate the caller from their own session cookies and
        confirm they have a profiles row with role = 'admin' (RLS
        applies to this client, so it can only read what it may read).
     2. Create the auth user + send the invite e-mail with the admin
        client (Auth admin API needs the secret key).
     3. Insert the matching profiles row with the admin client —
        profiles has no INSERT policy by design (0003_rls.sql), the
        only two writers are ensure_team_profile() and this route.
   ============================================================ */

interface InviteBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  language?: string;
}

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

  /* ----- 1. caller must be an admin ----- */
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only admins can invite team members." }, { status: 403 });
  }

  /* ----- 2. create the auth user + send the invite ----- */
  const admin = createSupabaseAdminClient();
  const origin = request.nextUrl.origin;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });
  if (inviteError || !invited?.user) {
    return NextResponse.json({ error: inviteError?.message || "Could not send the invite." }, { status: 400 });
  }

  /* ----- 3. matching profiles row ----- */
  const { data: created, error: profileError } = await admin
    .from("profiles")
    .insert({ id: invited.user.id, first_name: firstName, last_name: lastName, email, role, language })
    .select("id, first_name, last_name, email, role, language")
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      id: created.id,
      firstName: created.first_name,
      lastName: created.last_name,
      email: created.email,
      role: created.role,
      language: created.language,
    },
  });
}
