import { supabase } from "@/lib/supabase/client";
import { orEmpty, unwrap, type Row } from "@/lib/api/util";
import type { Role, TeamLanguage, User } from "@/types";

/* ============================================================
   team accounts (profiles)
   ============================================================
   profiles.id is a FK to auth.users(id), so rows can only be created by
   something that can create an auth user:
     - ensure_team_profile() — runs in app/auth/callback on every sign-in
       and provisions a profile for any verified @grensrock.be Google
       account (first one through the door becomes admin);
     - POST /api/team/invite — for anyone who needs a role assigned up
       front, or whose account isn't on the grensrock.be domain. Admin-only,
       server-side, using the Auth admin API + the secret key.
   Updates and deletes are ordinary table calls under the RLS policies.
   ============================================================ */

const COLUMNS = "id, first_name, last_name, email, role, language";

export function rowToUser(row: Row): User {
  return {
    id: String(row.id),
    firstName: orEmpty(row.first_name),
    lastName: orEmpty(row.last_name),
    email: orEmpty(row.email),
    role: (row.role || "user") as Role,
    language: (row.language || "nl") as TeamLanguage,
  };
}

export function userToRow(u: Partial<User>): Row {
  const r: Row = {};
  if (u.firstName !== undefined) r.first_name = u.firstName || "";
  if (u.lastName !== undefined) r.last_name = u.lastName || "";
  if (u.email !== undefined) r.email = u.email || "";
  if (u.role !== undefined) r.role = u.role || "user";
  if (u.language !== undefined) r.language = u.language || "nl";
  return r;
}

export async function listUsers(): Promise<User[]> {
  const rows = unwrap<Row[]>(await supabase.from("profiles").select(COLUMNS).order("first_name"));
  return (rows as Row[]).map(rowToUser);
}

/** The profiles row of the current session, or null if this isn't a team member. */
export async function getMyProfile(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const row = unwrap<Row | null>(await supabase.from("profiles").select(COLUMNS).eq("id", user.id).maybeSingle());
  return row ? rowToUser(row as Row) : null;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User> {
  const row = unwrap<Row | null>(await supabase.from("profiles").update(userToRow(patch)).eq("id", id).select(COLUMNS).single());
  return rowToUser(row as Row);
}

/** Removes the team account. The auth user itself stays (that needs the Auth admin API). */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Admin-only server route: creates the auth user, e-mails the invite, adds the profile. */
export async function inviteUser(u: Partial<User>): Promise<User> {
  const res = await fetch("/api/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      language: u.language,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Could not invite this team member.");
  return body.user as User;
}
