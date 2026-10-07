import "server-only";
import { isConfirmedAccount, isOwnerAccount } from "@/lib/owner";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { HttpError, required } from "./errors";
import type { Database } from "@mailer/core/database";
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY &&
    process.env.OWNER_EMAIL,
  );
}
export async function sessionClient() {
  const store = await cookies();
  return createServerClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server components cannot write cookies; proxy refreshes the session. */
          }
        },
      },
    },
  );
}
export function adminClient() {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireUser() {
  if (!isConfigured())
    throw new HttpError(
      503,
      "Set up Supabase and OWNER_EMAIL to start using your workspace.",
    );
  const client = await sessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new HttpError(401, "Sign in to your workspace first.");
  if (!isConfirmedAccount(user))
    throw new HttpError(403, "Confirm your email address to continue.");
  return {
    user,
    db: adminClient(),
    isOwner: isOwnerAccount(user, process.env.OWNER_EMAIL),
  };
}
export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  if (request.headers.get("origin") !== new URL(required("APP_URL")).origin)
    throw new HttpError(403, "This request must come from your workspace.");
}
