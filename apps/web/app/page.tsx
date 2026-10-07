import { LandingPage } from "@/components/landing-page";
import { Workspace } from "@/components/workspace";
import { isConfigured, requireUser } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  let authenticated = false;
  if (isConfigured()) {
    try {
      await requireUser();
      authenticated = true;
    } catch {
      /* Public shell never loads account data. */
    }
  }
  if (!authenticated) return <LandingPage />;
  const providers = {
    supabase: isConfigured(),
    akash: Boolean(process.env.AKASH_API_KEY),
    gateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    together: Boolean(process.env.TOGETHER_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.ENCRYPTION_KEY,
    ),
    encryption: Boolean(process.env.ENCRYPTION_KEY),
  };
  return (
    <Workspace
      authenticated={authenticated}
      providers={providers}
      initialView={params.view ?? (params.gmail ? "settings" : "dashboard")}
      initialError={params.gmail_error ?? ""}
    />
  );
}
