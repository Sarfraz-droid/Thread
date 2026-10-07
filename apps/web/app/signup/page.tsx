import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { SignupForm } from "@/components/signup-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import { isConfigured, requireUser } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
const errors: Record<string, string> = {
  configuration:
    "Account creation is not configured yet. Configure Supabase, OWNER_EMAIL, and APP_URL to continue.",
  origin: "Open sign-up from your configured application URL and try again.",
  validation:
    "Enter a valid email and a password of at least 8 characters. Both passwords must match.",
  unconfirmed: "Confirm your email address, then sign in.",
  rate_limit: "Too many attempts. Wait a moment before trying again.",
  disabled:
    "Sign-up is disabled in Supabase. Enable new user sign-ups in Authentication settings.",
  weak_password:
    "Choose a stronger password that meets your Supabase project’s password requirements.",
  existing:
    "Unable to create this account. If you already have an account, sign in instead.",
  provider: "Account creation is temporarily unavailable. Please try again.",
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const configured = isConfigured() && Boolean(process.env.APP_URL);
  if (configured) {
    let authenticated = false;
    try {
      await requireUser();
      authenticated = true;
    } catch {
      /* Public sign-up remains available. */
    }
    if (authenticated) redirect("/");
  }
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="signup-title">
        <div className="login-topbar">
          <a href="/" className="login-brand">
            thread.
          </a>
          <ThemeToggle />
        </div>
        <div className="login-heading">
          <h1 id="signup-title">Create your account</h1>
          <p>
            A quiet place for your story, opportunities, and next conversations.
          </p>
        </div>
        {params.error && errors[params.error] && (
          <Alert variant="destructive">
            <AlertTitle>Unable to create account</AlertTitle>
            <AlertDescription>{errors[params.error]}</AlertDescription>
          </Alert>
        )}
        {params.sent === "1" ? (
          <Alert>
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              If your account needs confirmation, you’ll receive an email with
              the next step. Open the link in this browser, then sign in. If you
              already have an account, you can sign in now.
            </AlertDescription>
          </Alert>
        ) : (
          <SignupForm configured={configured} />
        )}
        {!configured && (
          <Alert>
            <AlertTitle>Finish authentication setup</AlertTitle>
            <AlertDescription>
              Configure your Supabase credentials, OWNER_EMAIL, and APP_URL to
              enable account creation. <a href="/login">View setup details</a>.
            </AlertDescription>
          </Alert>
        )}
        <p className="login-private">
          <LockKeyhole aria-hidden="true" />
          Your workspace is private to your account.
        </p>
        <p className="auth-alternative">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </section>
    </main>
  );
}
