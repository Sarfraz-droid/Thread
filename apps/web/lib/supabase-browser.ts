import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@mailer/core/database";
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configure Supabase before signing in.");
  return createBrowserClient<Database>(url, key);
}
