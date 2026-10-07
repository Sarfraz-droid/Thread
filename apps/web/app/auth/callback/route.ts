import { NextResponse } from "next/server";
import { isConfirmedAccount } from "@/lib/owner";
import { isConfigured, sessionClient } from "@/lib/server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  if (!isConfigured() || !process.env.APP_URL)
    return redirectTo("/login?error=configuration");
  try {
    if (url.origin !== new URL(process.env.APP_URL).origin)
      return redirectTo("/login?error=origin");
    const code = url.searchParams.get("code");
    if (!code) return redirectTo("/login?error=confirmation");
    const client = await sessionClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) return redirectTo("/login?error=confirmation");
    const { data, error: userError } = await client.auth.getUser();
    if (
      userError ||
      !data.user ||
      !isConfirmedAccount(data.user)
    ) {
      await client.auth.signOut();
      return redirectTo("/login?error=unconfirmed");
    }
    return redirectTo("/");
  } catch {
    return redirectTo("/login?error=confirmation");
  }
}
