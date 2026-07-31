"use client";

import { createBrowserClient } from "@supabase/ssr";

/* ============================================================
   Browser Supabase client
   ============================================================
   Uses the publishable (client-safe) key — every request is still
   subject to RLS, so this key can ship in the browser bundle.

   createBrowserClient is a singleton by default: importing this module
   anywhere in the client bundle hands back the same instance, so the
   auth session (stored in cookies) stays consistent across components.
   ============================================================ */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createBrowserClient(url, key);

export default supabase;
