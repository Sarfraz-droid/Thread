import { NextResponse } from "next/server";
import { z } from "zod";
import { isConfirmedAccount } from "@/lib/owner";
import { isConfigured, sessionClient } from "@/lib/server/supabase";

const credentials = z
  .object({
    email: z.email().max(254),
    password: z.string().min(8).max(4096),
    confirm_password: z.string().min(8).max(4096),
  })
  .refine((value) => value.password === value.confirm_password);

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, requestOrigin), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const failure = (error: string) => redirectTo(`/signup?error=${error}`);
  if (!isConfigured() || !process.env.APP_URL) return failure("configuration");
  try {
    const origin = new URL(process.env.APP_URL).origin;
    if (request.headers.get("origin") !== origin || requestOrigin !== origin)
      return failure("origin");
    const form = await request.formData();
    const parsed = credentials.safeParse({
      email:
        typeof form.get("email") === "string"
          ? String(form.get("email")).trim()
          : null,
      password: form.get("password"),
      confirm_password: form.get("confirm_password"),
    });
    if (!parsed.success) return failure("validation");
    const client = await sessionClient();
    const { data, error } = await client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: new URL("/auth/callback", origin).toString(),
      },
    });
    if (error) {
      if (error.status === 429) return failure("rate_limit");
      if (error.code === "signup_disabled") return failure("disabled");
      if (error.code === "weak_password") return failure("weak_password");
      if (error.code === "user_already_exists" || error.code === "email_exists")
        return failure("existing");
      return failure("provider");
    }
    if (data.session) {
      const { data: verified, error: verificationError } =
        await client.auth.getUser();
      if (
        verificationError ||
        !verified.user ||
        !isConfirmedAccount(verified.user)
      ) {
        await client.auth.signOut();
        return failure("unconfirmed");
      }
      return redirectTo("/");
    }
    return redirectTo("/signup?sent=1");
  } catch {
    return failure("provider");
  }
}
