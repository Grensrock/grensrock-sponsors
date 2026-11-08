import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/api/util";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactVCard, vCardDisposition } from "@/lib/vcard";

/* ============================================================
   GET /api/contacts/{id}/vcard — a contact person as a .vcf
   ============================================================
   The "Add to my contacts" button in the contact form links here.
   It is a real URL, not a file built in the browser, because that is
   what an iPhone wants: Safari opens a text/vcard response straight
   into the "Create New Contact" sheet, where a downloaded blob ends up
   in the Files app first. Android and desktop browsers download it and
   hand it to the contacts app.

   The session client reads the row, so RLS decides who gets which
   card exactly as it decides who sees the contact list: the team sees
   every contact, a portal contact only their own sponsor's. Anything
   the caller may not read is a plain 404.
   ============================================================ */

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/contacts/[id]/vcard">) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await ctx.params;
  /* The column is a uuid: anything else would come back as a cast error, not as "no such contact". */
  if (!isUuid(id)) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  /* Two keys join these tables (sponsors.voucher_contact_id points back), so
     the embed names the one it follows: the contact's own sponsor_id. */
  const { data, error } = await supabase
    .from("contacts")
    .select("first_name, last_name, email, phone, sponsors!sponsor_id(company_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const sponsor = (Array.isArray(data.sponsors) ? data.sponsors[0] : data.sponsors) as
    | { company_name?: string | null }
    | null
    | undefined;
  const person = {
    firstName: data.first_name || "",
    lastName: data.last_name || "",
    email: data.email || "",
    phone: data.phone || "",
    company: sponsor?.company_name || "",
  };

  return new NextResponse(contactVCard(person), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": vCardDisposition(person),
      /* Someone's phone number: nothing in between keeps a copy. */
      "Cache-Control": "private, no-store",
    },
  });
}
