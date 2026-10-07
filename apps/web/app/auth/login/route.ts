import { NextResponse } from "next/server";
import { z } from "zod";
import { isOwnerAccount } from "@/lib/owner";
import { isConfigured, sessionClient } from "@/lib/server/supabase";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(4096),
});

export async function POST(request: Request) {
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const failure = (error: string) => redirectTo(`/login?error=${error}`);
  if (!isConfigured() || !process.env.APP_URL) return failure("configuration");
  if (request.headers.get("origin") !== origin) return failure("origin");
  try {
    const form = await request.formData();
    const parsed = credentials.safeParse({
      email:
        typeof form.get("email") === "string"
          ? String(form.get("email")).trim()
          : null,
      password: form.get("password"),
    });
    if (!parsed.success) return failure("credentials");
    const client = await sessionClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error)
      return failure(error.status === 429 ? "rate_limit" : "credentials");
    const { data, error: userError } = await client.auth.getUser();
    if (
      userError ||
      !data.user ||
      !isOwnerAccount(data.user, process.env.OWNER_EMAIL)
    ) {
      await client.auth.signOut();
      return failure("not_owner");
    }
    return redirectTo("/");
  } catch {
    return failure("provider");
  }
}
