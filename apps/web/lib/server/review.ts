import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import {
  draftReviewSchema,
  findPlaceholders,
  type Draft,
  type DraftChatReply,
  type DraftReview,
  type DraftReviewResult,
} from "@mailer/core";
import { context, getSettings, structured } from "./ai";
import { REFERRAL_PURPOSE } from "./referral";
import { check, must, HttpError } from "./errors";

type Db = SupabaseClient<Database>;
const MAX_ROUNDS = 2;
// Only start a second pass while it can still finish inside the route limit.
const SECOND_ROUND_BEFORE_MS = 90000;

// Auto mode: read the draft as the owner would before pressing send, fix what
// can be fixed from known facts, and block anything that needs the owner.
export async function reviewDraft(
  db: Db,
  userId: string,
  draftId: string,
  version: number,
): Promise<DraftReviewResult> {
  let draft = must(
    await db
      .from("drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", userId)
      .single(),
  ) as Draft;
  if (!["draft", "failed"].includes(draft.status) || draft.version !== version)
    throw new HttpError(
      409,
      "This draft changed or is no longer editable. Refresh the workspace before reviewing.",
    );
  const opportunity = must(
    await db
      .from("opportunities")
      .select("*")
      .eq("id", draft.opportunity_id)
      .eq("user_id", userId)
      .single(),
  );
  const [knowledge, settings] = await Promise.all([
    context(db, userId, `${opportunity.role} ${opportunity.company}`),
    getSettings(db, userId),
  ]);
  let review: DraftReview | undefined;
  let revised = false;
  const started = Date.now();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round && Date.now() - started > SECOND_ROUND_BEFORE_MS) break;
    review = await structured(
      db,
      userId,
      draftReviewSchema,
      `${REFERRAL_PURPOSE}
You are the applicant, carefully re-reading your own referral email one last time before it is sent automatically. Review it as a thoughtful person would:
- Every claim about the applicant is supported by the saved profile and memories. Remove or soften anything unsupported rather than inventing detail.
- Company, role, job ID, and recipient name match the opportunity exactly; the greeting addresses the right person.
- The referral ask is clear and polite; the email is concise, specific, and free of vague praise, repetition, typos, and awkward phrasing.
- No placeholders, brackets, template slots, notes to self, or questions meant for the owner remain.
- The signature matches the supplied signature (or the applicant's name). Mention an attached resume only when attachment_ids is nonempty.
If anything should change, return the COMPLETE improved subject and body in revision; otherwise revision:null. Keep what already works, preserve paragraph breaks, and do not change recipients or attachments.
Mark an issue "blocking" only when the email cannot be sent truthfully without the owner's input (for example a required fact is missing or the role is ambiguous). Fixable problems you corrected in revision are "minor". approved is true only when, after your revision, nothing blocking remains.
summary is one or two sentences addressed to the owner describing what you checked and changed.
${round ? "This is a second pass over your own revision. Approve it unless something is still wrong.\n" : ""}CURRENT DRAFT: ${JSON.stringify({ subject: draft.subject, body: draft.body, recipient_email: draft.recipient_email, attachment_ids: draft.attachment_ids })}
SAVED PROFILE AND MEMORIES (possibly abbreviated): ${JSON.stringify(knowledge).slice(0, 9000)}
OPPORTUNITY AND RESEARCH (possibly abbreviated): ${JSON.stringify(opportunity).slice(0, 7000)}
SIGNATURE: ${JSON.stringify(settings.signature)}`,
    );
    const revision = review.revision;
    if (
      !revision ||
      (revision.subject.trim() === draft.subject.trim() &&
        revision.body.trim() === draft.body.trim())
    )
      break;
    const updated = check(
      await db
        .from("drafts")
        .update({
          subject: revision.subject.replace(/[\r\n]+/g, " ").trim(),
          body: revision.body.trim(),
          version: draft.version + 1,
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId)
        .eq("user_id", userId)
        .eq("version", draft.version)
        .in("status", ["draft", "failed"])
        .select("*")
        .maybeSingle(),
    );
    if (!updated)
      throw new HttpError(
        409,
        "The draft changed during review. Refresh the workspace and run auto mode again.",
      );
    draft = updated as Draft;
    revised = true;
    // A blocking verdict will not change on a re-read of the same facts.
    if (review.issues.some((issue) => issue.severity === "blocking")) break;
  }
  const issues = [...(review?.issues ?? [])];
  const placeholders = findPlaceholders(draft.subject, draft.body);
  if (placeholders.length)
    issues.push({
      severity: "blocking",
      note: `Unfilled placeholder text remains: ${placeholders.join(", ")}.`,
    });
  const approved =
    Boolean(review?.approved) &&
    !issues.some((issue) => issue.severity === "blocking");
  const summary = review?.summary ?? "Review finished.";
  // Record the review in the draft's agent thread so the owner can see it later.
  const reply: DraftChatReply = {
    kind: "draft-assistant",
    message: [
      `Auto review: ${approved ? "ready to send" : "needs your input"}. ${summary}`,
      ...issues.map(
        (issue) =>
          `• ${issue.severity === "blocking" ? "Needs you" : "Fixed"}: ${issue.note}`,
      ),
    ].join("\n"),
    draft_updated: revised,
    profile_updates: [],
    memory: { saved: 0, conflicts: 0, failed: false },
  };
  check(
    await db.from("conversations").upsert(
      {
        id: draftId,
        user_id: userId,
        title: `Draft: ${opportunity.company} · ${opportunity.role}`.slice(
          0,
          200,
        ),
      },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  );
  check(
    await db.from("messages").insert({
      user_id: userId,
      conversation_id: draftId,
      role: "assistant",
      content: JSON.stringify(reply),
    }),
  );
  return { draft, approved, revised, summary, issues };
}
