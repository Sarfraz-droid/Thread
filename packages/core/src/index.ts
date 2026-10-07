import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().max(200).default(""),
  headline: z.string().max(500).default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
  location: z.string().max(200).default(""),
  summary: z.string().max(6000).default(""),
  experience: z.string().max(12000).default(""),
  education: z.string().max(4000).default(""),
  skills: z.array(z.string().max(100)).max(100).default([]),
  projects: z.string().max(8000).default(""),
  achievements: z.string().max(4000).default(""),
  links: z.array(z.url()).max(20).default([]),
  target_roles: z.string().max(2000).default(""),
  preferences: z.string().max(2000).default(""),
});
export type Profile = z.infer<typeof profileSchema>;
export const emptyProfile = profileSchema.parse({});

export const DEFAULT_MODEL = "zai-org/GLM-5.3";

export const aiProviderSchema = z.enum([
  "akash",
  "vercel",
  "together",
  "groq",
  "openrouter",
]);
export type AiProvider = z.infer<typeof aiProviderSchema>;
export const settingsSchema = z.object({
  provider: aiProviderSchema.optional(),
  model: z.string().max(200).default(DEFAULT_MODEL),
  signature: z.string().max(2000).default(""),
});
export type Settings = z.infer<typeof settingsSchema>;

export const memoryProposalSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.-]{2,100}$/),
  content: z.string().min(1).max(1500),
  evidence: z.string().min(1).max(1500),
});
export type MemoryProposal = z.infer<typeof memoryProposalSchema>;
export type Memory = {
  id: string;
  user_id: string;
  key: string;
  content: string;
  evidence: string;
  source_message_id: string | null;
  status: "active" | "conflict" | "forgotten";
  proposal: string | null;
  created_at: string;
  updated_at: string;
};
export function memoryDecision(
  existing: (Pick<Memory, "content"> & { status: string }) | undefined,
  proposal: MemoryProposal,
  source: string,
) {
  if (!source.includes(proposal.evidence)) return "reject";
  if (existing?.status === "forgotten") return "reject";
  if (!existing) return "insert";
  if (
    existing.content.trim().toLowerCase() ===
    proposal.content.trim().toLowerCase()
  )
    return "unchanged";
  return "conflict";
}

export function parseRecipientEmails(value: string): string[] {
  if (/[\r\n]/.test(value))
    throw new Error("Email addresses must be on one line.");
  if (!value.trim()) return [];
  const emails = value.split(/[,;]/).map((email) => email.trim());
  if (emails.some((email) => !z.email().safeParse(email).success))
    throw new Error("Enter valid email addresses separated by commas.");
  const unique = [
    ...new Map(emails.map((email) => [email.toLowerCase(), email])).values(),
  ];
  if (unique.length > 50)
    throw new Error("Use at most 50 addresses per field.");
  return unique;
}
const recipientEmailSchema = z
  .string()
  .max(12000)
  .refine((value) => {
    try {
      return parseRecipientEmails(value).length > 0;
    } catch {
      return false;
    }
  }, "Enter valid email addresses separated by commas (up to 50).");
const additionalRecipientSchema = z.array(z.email()).max(50).default([]);
export function emailRecipients(content: {
  recipient_email: string;
  cc_emails?: string[];
  bcc_emails?: string[];
}) {
  const seen = new Set<string>();
  const unique = (emails: string[]) =>
    emails.filter((email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    to: unique(parseRecipientEmails(content.recipient_email)),
    cc: unique(additionalRecipientSchema.parse(content.cc_emails)),
    bcc: unique(additionalRecipientSchema.parse(content.bcc_emails)),
  };
}

export const opportunitySchema = z.object({
  company: z.string().max(250).default(""),
  role: z.string().max(250).default(""),
  recipient_name: z.string().max(250).default(""),
  recipient_email: z.union([z.literal(""), recipientEmailSchema]).default(""),
  job_url: z.union([z.literal(""), z.url()]).default(""),
  job_id: z.string().max(250).default(""),
  instructions: z.string().max(6000).default(""),
  notes: z.string().max(10000).default(""),
});
export type OpportunityDetails = z.infer<typeof opportunitySchema>;
export type Opportunity = OpportunityDetails & {
  id: string;
  user_id: string;
  input: string;
  document_id: string | null;
  status: "new" | "researched" | "drafted" | "sent" | "discarded";
  outcome: "pending" | "replied" | "interview" | "closed";
  research: string;
  created_at: string;
  updated_at: string;
};
export const draftContentSchema = z.object({
  recipient_email: recipientEmailSchema,
  cc_emails: additionalRecipientSchema,
  bcc_emails: additionalRecipientSchema,
  subject: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((s) => !/[\r\n]/.test(s), "Subject must be one line."),
  body: z.string().trim().min(1).max(20000),
  attachment_ids: z.array(z.uuid()).max(10).default([]),
});
export type DraftContent = z.infer<typeof draftContentSchema>;
export type Draft = DraftContent & {
  id: string;
  user_id: string;
  opportunity_id: string;
  version: number;
  status: "draft" | "sending" | "sent" | "failed" | "unknown";
  gmail_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Document = {
  id: string;
  user_id: string;
  name: string;
  path: string;
  mime_type: string;
  size: number;
  text: string;
  kind: "resume" | "referral" | "attachment";
  is_default: boolean;
  created_at: string;
};
export type Conversation = {
  id: string;
  title: string;
  summary: string;
  created_at: string;
};
export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
export type ResearchSource = {
  id: string;
  opportunity_id: string;
  url: string;
  title: string;
  content: string;
  retrieved_at: string;
};
export type McpConfig = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  allowed_tools: string[];
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
export const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;
export function validateFile(type: string, size: number) {
  if (!(allowedMimeTypes as readonly string[]).includes(type))
    throw new Error("Use a PDF, DOCX, PNG, JPEG, or text file.");
  if (size < 1 || size > MAX_FILE_SIZE)
    throw new Error("Files must be between 1 byte and 10 MB.");
}
export function validateAttachments(files: Pick<Document, "size">[]) {
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_SIZE)
    throw new Error("Email attachments must total 15 MB or less.");
}
export const mcpSchema = z.object({
  name: z.string().min(1).max(100),
  url: z
    .url()
    .refine(
      (url) => new URL(url).protocol === "https:",
      "Use an HTTPS MCP endpoint.",
    ),
  enabled: z.boolean().default(false),
  allowed_tools: z.array(z.string().min(1).max(200)).max(30).default([]),
  token: z.string().max(4000).optional(),
});

export function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "attachment";
}

export type WorkspaceState = {
  profile: Profile;
  settings: Settings;
  memories: Memory[];
  documents: Document[];
  conversations: Conversation[];
  opportunities: Opportunity[];
  drafts: Draft[];
  mcp: McpConfig[];
  gmail: { connected: boolean; email: string | null };
};
export {
  performDelivery,
  RejectedDelivery,
  type DeliveryOutcome,
} from "./delivery";

export const profileUpdateSchema = z.object({
  field: profileSchema.keyof(),
  value: z.union([
    z.string().max(12000),
    z.array(z.string().max(2000)).max(100),
  ]),
  evidence: z.string().min(1).max(1500),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export const draftAgentResultSchema = z.object({
  message: z.string().min(1).max(6000),
  draft: z
    .object({
      subject: z.string().min(1).max(300),
      body: z.string().min(1).max(20000),
    })
    .nullable(),
  facts: z.array(memoryProposalSchema).max(8),
  profile_updates: z.array(profileUpdateSchema).max(13),
});
export const draftChatReplySchema = z.object({
  kind: z.literal("draft-assistant"),
  message: z.string(),
  draft_updated: z.boolean(),
  profile_updates: z.array(profileUpdateSchema),
  memory: z.object({
    saved: z.number(),
    conflicts: z.number(),
    failed: z.boolean(),
  }),
});
export type DraftChatReply = z.infer<typeof draftChatReplySchema>;
export type DraftChatResult = { draft: Draft; reply: DraftChatReply };
export const draftReferenceSchema = z.object({
  text: z.string().min(1).max(20000),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});
export type DraftReference = z.infer<typeof draftReferenceSchema>;
export function readDraftChatReply(content: string): DraftChatReply | null {
  try {
    const result = draftChatReplySchema.safeParse(JSON.parse(content));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function groundedProfileUpdates(
  updates: ProfileUpdate[],
  source: string,
) {
  return updates.filter(
    (update) =>
      source.includes(update.evidence) &&
      profileSchema.shape[update.field].safeParse(update.value).success,
  );
}
export function applyProfileUpdates(
  profile: Profile,
  updates: ProfileUpdate[],
): Profile {
  return profileSchema.parse({
    ...profile,
    ...Object.fromEntries(
      updates.map((update) => [update.field, update.value]),
    ),
  });
}

export const referralAnswerSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(2000),
});
export const referralReadinessSchema = z.object({
  questions: z.array(z.string().trim().min(1).max(500)).max(5),
});
export type ReferralAnswer = z.infer<typeof referralAnswerSchema>;
export type ReferralDraftResult =
  Draft | { kind: "clarification"; questions: string[] };
