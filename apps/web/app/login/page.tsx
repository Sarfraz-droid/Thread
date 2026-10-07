import { ThemeToggle } from "@/components/theme-toggle";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button, buttonVariants } from "@mailer/ui/components/button";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import { Input } from "@mailer/ui/components/input";
import { Field, FieldGroup, FieldLabel } from "@mailer/ui/components/field";
import { isConfigured, requireUser } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
const errors: Record<string, string> = {
  confirmation:
    "The confirmation link is missing, expired, or was opened in a different browser. Try signing in if you already confirmed your email, or sign up again to request a new link.",
  configuration:
    "Supabase is not configured yet. Add the environment variables to enable sign-in.",
  provider: "Sign-in is temporarily unavailable. Please try again.",
  credentials:
    "Email or password is incorrect. Check your details and try again.",
  rate_limit: "Too many sign-in attempts. Please wait a moment and try again.",
  unconfirmed: "Confirm your email address, then sign in.",
  origin: "Sign in from your configured application URL.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams,
    configured = isConfigured() && Boolean(process.env.APP_URL);
  let authenticated = false;
  if (configured) {
    try {
      await requireUser();
      authenticated = true;
    } catch {
      /* Login remains available without a valid owner session. */
    }
  }
  if (authenticated) redirect("/");
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-topbar">
          <a href="/" className="login-brand">
            thread.
          </a>
          <ThemeToggle />
        </div>
        <div className="login-heading">
          <h1 id="login-title">Sign in to your workspace</h1>
          <p>Your profile, conversations, and referral emails in one place.</p>
        </div>
        {params.error && errors[params.error] && (
          <Alert variant="destructive">
            <AlertTitle>Unable to sign in</AlertTitle>
            <AlertDescription>{errors[params.error]}</AlertDescription>
          </Alert>
        )}
        <form action="/auth/login" method="post">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={4096}
                required
              />
            </Field>
            <Button type="submit" className="w-full" disabled={!configured}>
              Sign in
              <ArrowRight data-icon="inline-end" />
            </Button>
          </FieldGroup>
        </form>
        {!configured && (
          <details className="login-setup" open>
            <summary>Configure Supabase to enable login</summary>
            <p>
              Set these variables in <code>apps/web/.env.local</code>, then
              restart the server.
            </p>
            <code className="setup-variables">
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              <br />
              SUPABASE_SECRET_KEY
              <br />
              OWNER_EMAIL
              <br />
              APP_URL
            </code>
            <p>
              Enable email authentication in Supabase and create a confirmed user with a password.
            </p>
          </details>
        )}
        <p className="auth-alternative">
          New here? <a href="/signup">Create an account</a>
        </p>
        <p className="login-private">
          <LockKeyhole aria-hidden="true" />
          Your workspace is private to your account.
        </p>
        <a className={buttonVariants({ variant: "link" })} href="/preview">
          Preview the dashboard
        </a>
      </section>
    </main>
  );
}
