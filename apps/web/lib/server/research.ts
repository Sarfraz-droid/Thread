import { z } from "zod";
import {
  opportunitySchema,
  parseRecipientEmails,
  type Opportunity,
  type ResearchSource,
} from "@mailer/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import { check, must, HttpError, required } from "./errors";
import { structured } from "./ai";
import { assertPublicUrl, providerJson } from "./network";
type Db = SupabaseClient<Database>;
type TavilySource = {
  url: string;
  title?: string;
  content?: string;
  raw_content?: string;
};
export async function intake(
  db: Db,
  userId: string,
  input: string,
  documentId?: string,
) {
  let text = input;
  if (documentId) {
    const doc = must(
      await db
        .from("documents")
        .select("text")
        .eq("user_id", userId)
        .eq("id", documentId)
        .single(),
    );
    text += `\nUPLOADED REFERRAL:\n${doc.text}`;
  }
  const details = await structured(
    db,
    userId,
    opportunitySchema,
    `Extract referral details from this source. Do not infer recipient email. If the source explicitly names several recipients for the same referral, include all their email addresses separated by commas in recipient_email. Preserve instructions. Missing fields should be empty.\nSOURCE DATA: ${JSON.stringify(text)}`,
  );
  // A model may only copy a recipient address actually present in the supplied input.
  if (details.recipient_email) {
    details.recipient_email = parseRecipientEmails(details.recipient_email)
      .filter((email) => text.toLowerCase().includes(email.toLowerCase()))
      .join(", ");
  }
  return must(
    await db
      .from("opportunities")
      .insert({
        user_id: userId,
        input: text.slice(0, 65000),
        document_id: documentId ?? null,
        ...details,
      })
      .select("*")
      .single(),
  );
}
export async function research(
  db: Db,
  userId: string,
  id: string,
  force = false,
) {
  const opportunity = must(
    await db
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single(),
  );
  if (opportunity.research && !force) return opportunity;
  if (!opportunity.company && !opportunity.job_url)
    throw new HttpError(
      400,
      "Add a company name or job URL before researching.",
    );
  const apiKey = required("TAVILY_API_KEY");
  const sources: TavilySource[] = [];
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (opportunity.job_url) {
    await assertPublicUrl(opportunity.job_url);
    const extracted = await providerJson<{ results: TavilySource[] }>(
      "https://api.tavily.com/extract",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          urls: [opportunity.job_url],
          extract_depth: "basic",
          format: "text",
        }),
      },
    );
    sources.push(...extracted.results);
  }
  const found = await providerJson<{ results: TavilySource[] }>(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `${opportunity.company} ${opportunity.role} ${opportunity.job_id} official careers company`,
        search_depth: "basic",
        max_results: 5,
        include_raw_content: "text",
        include_answer: false,
      }),
    },
  );
  sources.push(...found.results);
  const unique = [...new Map(sources.map((s) => [s.url, s])).values()]
    .filter((s) => s.raw_content || s.content)
    .slice(0, 6);
  if (!unique.length)
    throw new HttpError(
      422,
      "No usable research was found. Paste the job description or correct the company and job link.",
    );
  const opportunityContext = {
    company: opportunity.company,
    role: opportunity.role,
    job_id: opportunity.job_id,
    job_url: opportunity.job_url,
    instructions: opportunity.instructions.slice(0, 1000),
  };
  async function summarize(textLimit: number, maxOutputTokens: number) {
    return structured(
      db,
      userId,
      z.object({ summary: z.string().max(12000) }),
      `Research this opportunity using ONLY the supplied evidence. Include role requirements, company context, referral/application instructions, and missing or conflicting details. Cite source URLs next to factual claims. Prefer the provided job page and official company sources. Do not infer that a role is still open from an undated search snippet. Keep the summary concise.\nOPPORTUNITY: ${JSON.stringify(opportunityContext)}\nEVIDENCE: ${JSON.stringify(unique.map((source) => ({ url: source.url, title: source.title?.slice(0, 250), text: (source.raw_content ?? source.content ?? "").slice(0, textLimit) })))}`,
      { maxOutputTokens },
    );
  }
  let result: { summary: string };
  try {
    result = await summarize(2000, 1800);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("statusCode" in error) ||
      Number(error.statusCode) !== 413
    )
      throw error;
    // Keep every source URL while reducing evidence and output for smaller quotas.
    result = await summarize(1000, 1200);
  }
  check(
    await db.from("research_sources").upsert(
      unique.map((s) => ({
        user_id: userId,
        opportunity_id: id,
        url: s.url,
        title: s.title ?? s.url,
        content: (s.raw_content ?? s.content ?? "").slice(0, 15000),
        retrieved_at: new Date().toISOString(),
      })),
      { onConflict: "opportunity_id,url" },
    ),
  );
  return must(
    await db
      .from("opportunities")
      .update({
        research: result.summary,
        status:
          opportunity.status === "new" ? "researched" : opportunity.status,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .single(),
  );
}
export async function sourcesFor(
  db: Db,
  userId: string,
  id: string,
): Promise<ResearchSource[]> {
  return must(
    await db
      .from("research_sources")
      .select("*")
      .eq("user_id", userId)
      .eq("opportunity_id", id),
  );
}
export function missingDetails(opportunity: Opportunity) {
  return [
    !opportunity.recipient_email && "recipient email",
    !opportunity.company && "company",
    !opportunity.role && "role",
  ].filter(Boolean);
}
