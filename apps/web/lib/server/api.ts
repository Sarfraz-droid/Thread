import "server-only";
import { z } from "zod";
import {
  aiProviderSchema,
  referralAnswerSchema,
  emptyProfile,
  profileSchema,
  settingsSchema,
  opportunitySchema,
  draftContentSchema,
  mcpSchema,
  memoryProposalSchema,
  safeFilename,
  validateFile,
  readDraftChatReply,
  type WorkspaceState,
} from "@mailer/core";
import {
  requireUser,
  assertSameOrigin,
  isConfigured,
  sessionClient,
} from "./supabase";
import { check, must, errorResponse, HttpError, required } from "./errors";
import {
  compatibleBaseUrl,
  providerKeyName,
  usesGateway,
  defaultAiModel,
  gatewayClient,
} from "./ai-provider";
import { context, chat, extractProfile, getSettings, mem0Target } from "./ai";
import {
  mem0Add,
  mem0Configured,
  mem0Forget,
  mem0List,
  mem0Owned,
  mem0Update,
} from "./mem0";
import { prepareReferral } from "./referral";
import { intake, research, sourcesFor } from "./research";
import { gmailConnect, gmailCallback, gmailInfo, sendDraft } from "./gmail";
import { encrypt, decrypt } from "./crypto";
import { assertPublicUrl, publicFetch, providerJson } from "./network";
import { createMCPClient } from "@ai-sdk/mcp";

import { draftChat, draftMessages } from "./draft-chat";

const uuid = z.uuid();
async function json(request: Request) {
  const text = await request.text();
  if (text.length > 120000)
    throw new HttpError(
      413,
      "This request is too large. Shorten the text and try again.",
    );
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "The request must contain valid JSON.");
  }
}
// A memory-layer outage must not take the whole workspace down with it.
async function listMem0Memories(
  db: Parameters<typeof mem0Target>[0],
  userId: string,
) {
  if (!mem0Configured()) return [];
  try {
    return await mem0List(await mem0Target(db, userId), userId);
  } catch {
    return [];
  }
}
export async function api(request: Request, path: string[]) {
  try {
    const route = path.join("/"),
      method = request.method;
    if (route === "status" && method === "GET")
      return Response.json({ configured: isConfigured() });
    const { user, db, isOwner } = await requireUser();
    const uid = user.id;
    assertSameOrigin(request);
    const timestamp = () => new Date().toISOString();
    const profileResult = await db.from("profiles").upsert(
      {
        user_id: uid,
        settings: settingsSchema.parse({ model: defaultAiModel() }),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    check(profileResult);

    if (route === "state" && method === "GET") {
      const results = await Promise.all([
        db.from("profiles").select("*").eq("user_id", uid).single(),
        db
          .from("memories")
          .select("*")
          .eq("user_id", uid)
          .neq("status", "forgotten")
          .order("updated_at", { ascending: false }),
        db
          .from("documents")
          .select(
            "id,user_id,name,path,mime_type,size,kind,is_default,created_at",
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        db
          .from("conversations")
          .select("id,title,summary,created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        db
          .from("opportunities")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        db
          .from("drafts")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        db
          .from("mcp_configs")
          .select("id,name,url,enabled,allowed_tools")
          .eq("user_id", uid),
        gmailInfo(db, uid),
      ]);
      const state: WorkspaceState = {
        profile: profileSchema.parse(must(results[0]).data ?? emptyProfile),
        settings: await getSettings(db, uid),
        isOwner,
        memories: [
          ...(must(results[1]) as WorkspaceState["memories"]),
          ...(await listMem0Memories(db, uid)),
        ].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        documents: must(results[2]).map((d) => ({
          ...d,
          text: "",
        })) as WorkspaceState["documents"],
        conversations: must(results[3]),
        opportunities: must(results[4]) as WorkspaceState["opportunities"],
        drafts: must(results[5]) as WorkspaceState["drafts"],
        mcp: must(results[6]),
        gmail: results[7],
      };
      return Response.json(state, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    if (route === "profile" && method === "PUT") {
      const data = profileSchema.parse(await json(request));
      check(
        await db
          .from("profiles")
          .update({ data, updated_at: timestamp() })
          .eq("user_id", uid),
      );
      return Response.json(data);
    }
    if (route === "settings" && method === "PUT") {
      const input = settingsSchema.parse(await json(request));
      // Only the owner may choose the AI provider/model; everyone else keeps the default agent.
      const settings = isOwner
        ? input
        : {
            ...(await getSettings(db, uid)),
            signature: input.signature,
          };
      check(
        await db
          .from("profiles")
          .update({ settings, updated_at: timestamp() })
          .eq("user_id", uid),
      );
      return Response.json(settings);
    }
    if (route === "models" && method === "GET") {
      if (!isOwner)
        throw new HttpError(403, "Model selection is not available.");
      const requested = new URL(request.url).searchParams.get("provider");
      const provider =
        requested === null
          ? (await getSettings(db, uid)).provider
          : aiProviderSchema.parse(requested);
      if (usesGateway(provider)) {
        const { models } = await gatewayClient().getAvailableModels();
        return Response.json({
          models: models.map((model) => ({ id: model.id })),
        });
      }
      if (provider === "together") {
        const result = await providerJson<unknown>(
          "https://api.together.ai/v1/models",
          {
            headers: {
              Authorization: `Bearer ${required("TOGETHER_API_KEY")}`,
            },
          },
        );
        const models = z
          .array(z.object({ id: z.string(), type: z.string().optional() }))
          .parse(result);
        return Response.json({
          models: models
            .filter((model) => !model.type || model.type === "chat")
            .map((model) => ({ id: model.id })),
        });
      }
      const result = await providerJson<{
        data: {
          id: string;
          input_modalities?: string[];
          supported_features?: string[];
        }[];
      }>(`${compatibleBaseUrl(provider)}/models`, {
        headers: {
          Authorization: `Bearer ${required(providerKeyName(provider))}`,
        },
      });
      return Response.json({
        models: result.data.map((m) => ({
          id: m.id,
          input_modalities: m.input_modalities ?? [],
          supported_features: m.supported_features ?? [],
        })),
      });
    }
    if (route === "chat" && method === "POST")
      return await chat(
        db,
        uid,
        z
          .object({
            content: z.string().trim().min(1).max(12000),
            conversation_id: uuid.optional(),
          })
          .parse(await json(request)),
      );
    if (route === "messages" && method === "GET") {
      const id = uuid.parse(
        new URL(request.url).searchParams.get("conversation"),
      );
      return Response.json(
        must(
          await db
            .from("messages")
            .select("id,conversation_id,role,content,created_at")
            .eq("user_id", uid)
            .eq("conversation_id", id)
            .order("created_at"),
        ).map((message) => ({
          ...message,
          content:
            message.role === "assistant"
              ? (readDraftChatReply(message.content)?.message ??
                message.content)
              : message.content,
        })),
      );
    }
    if (path[0] === "conversations" && path[1] && method === "DELETE") {
      const id = uuid.parse(path[1]);
      // Preserve memory evidence while allowing the source conversation to be deleted.
      const messages = must(
        await db
          .from("messages")
          .select("id")
          .eq("user_id", uid)
          .eq("conversation_id", id),
      );
      const ids = messages.map((m) => m.id);
      if (ids.length) {
        check(
          await db
            .from("memories")
            .update({ source_message_id: null })
            .eq("user_id", uid)
            .in("source_message_id", ids),
        );
        check(
          await db
            .from("memories")
            .update({ conflict_source_message_id: null })
            .eq("user_id", uid)
            .in("conflict_source_message_id", ids),
        );
      }
      check(
        await db.from("conversations").delete().eq("id", id).eq("user_id", uid),
      );
      return Response.json({ ok: true });
    }
    if (route === "memories" && method === "POST") {
      const fact = memoryProposalSchema
        .omit({ evidence: true })
        .parse(await json(request));
      if (mem0Configured()) {
        const id = await mem0Add(
          await mem0Target(db, uid),
          uid,
          fact.key,
          fact.content,
        );
        return Response.json({ id });
      }
      return Response.json(
        must(
          await db
            .from("memories")
            .upsert(
              {
                user_id: uid,
                ...fact,
                status: "active",
                evidence: "Manually added by owner",
                proposal: null,
                source_message_id: null,
                conflict_source_message_id: null,
                updated_at: timestamp(),
              },
              { onConflict: "user_id,key" },
            )
            .select("*")
            .single(),
        ),
      );
    }
    if (path[0] === "memories" && path[1]) {
      const id = uuid.parse(path[1]);
      const legacy = check(
        await db
          .from("memories")
          .select("*")
          .eq("id", id)
          .eq("user_id", uid)
          .maybeSingle(),
      );
      const llm =
        legacy || !mem0Configured() ? null : await mem0Target(db, uid);
      const memory = legacy ?? (llm && (await mem0Owned(llm, uid, id)));
      if (!memory) throw new HttpError(404, "This item was not found.");
      if (method === "DELETE") {
        const ids = [
          memory.source_message_id,
          "conflict_source_message_id" in memory
            ? memory.conflict_source_message_id
            : null,
        ].filter((id): id is string => Boolean(id));
        if (ids.length)
          check(
            await db
              .from("messages")
              .update({ excluded_from_context: true })
              .eq("user_id", uid)
              .in("id", ids),
          );
        // Summaries and assistant paraphrases may contain the forgotten fact. Exclude
        // all existing conversation context rather than allow it to resurface.
        check(
          await db
            .from("messages")
            .update({ excluded_from_context: true })
            .eq("user_id", uid),
        );
        check(
          await db
            .from("conversations")
            .update({ summary: "" })
            .eq("user_id", uid),
        );
        if (!legacy) {
          await mem0Forget(llm!, id);
          return Response.json({ ok: true });
        }
        check(
          await db
            .from("memories")
            .update({
              status: "forgotten",
              content: "",
              evidence: "",
              proposal: null,
              source_message_id: null,
              conflict_source_message_id: null,
              updated_at: timestamp(),
            })
            .eq("id", id)
            .eq("user_id", uid),
        );
        return Response.json({ ok: true });
      }
      if (method === "PUT") {
        const { content } = z
          .object({ content: z.string().trim().min(1).max(1500) })
          .parse(await json(request));
        if (!legacy) {
          await mem0Update(llm!, id, content);
          return Response.json({ ok: true });
        }
        check(
          await db
            .from("memories")
            .update({
              content,
              status: "active",
              proposal: null,
              evidence: "Corrected by owner",
              updated_at: timestamp(),
            })
            .eq("id", id)
            .eq("user_id", uid),
        );
        return Response.json({ ok: true });
      }
    }
    if (route === "documents/upload" && method === "POST") {
      const input = z
        .object({
          name: z.string().min(1).max(200),
          mime_type: z.string(),
          size: z.number().int().positive(),
        })
        .parse(await json(request));
      validateFile(input.mime_type, input.size);
      const id = crypto.randomUUID(),
        path = `${uid}/${id}/${safeFilename(input.name)}`;
      const signed = must(
        await db.storage.from("documents").createSignedUploadUrl(path),
      );
      return Response.json({
        id,
        path,
        token: signed.token,
        signed_url: signed.signedUrl,
      });
    }
    if (route === "documents" && method === "POST") {
      const input = z
        .object({
          id: uuid,
          path: z.string(),
          name: z.string().min(1).max(200),
          mime_type: z.string(),
          size: z.number().int(),
          kind: z.enum(["resume", "referral", "attachment"]),
          text: z.string().max(65000),
        })
        .parse(await json(request));
      validateFile(input.mime_type, input.size);
      if (input.path !== `${uid}/${input.id}/${safeFilename(input.name)}`)
        throw new HttpError(
          400,
          "This upload path does not belong to your document.",
        );
      const info = must(await db.storage.from("documents").info(input.path));
      if (info.size !== input.size || info.contentType !== input.mime_type)
        throw new HttpError(
          400,
          "The uploaded file does not match its declared size or type.",
        );
      const doc = must(
        await db
          .from("documents")
          .insert({ ...input, user_id: uid })
          .select("*")
          .single(),
      );
      const defaultResume = check(
        await db
          .from("documents")
          .select("id")
          .eq("user_id", uid)
          .eq("is_default", true)
          .maybeSingle(),
      );
      if (!defaultResume && input.kind === "resume")
        check(
          await db.rpc("set_default_document", {
            p_user_id: uid,
            p_document_id: doc.id,
          }),
        );
      return Response.json(doc);
    }
    if (path[0] === "documents" && path[1]) {
      const id = uuid.parse(path[1]),
        doc = must(
          await db
            .from("documents")
            .select("*")
            .eq("id", id)
            .eq("user_id", uid)
            .single(),
        );
      if (method === "GET")
        return Response.json({
          document: doc,
          ...must(
            await db.storage.from("documents").createSignedUrl(doc.path, 300),
          ),
        });
      if (method === "PUT") {
        const { text } = z
          .object({ text: z.string().max(65000) })
          .parse(await json(request));
        check(
          await db
            .from("documents")
            .update({ text })
            .eq("user_id", uid)
            .eq("id", id),
        );
        return Response.json({ ok: true });
      }
      if (path[2] === "profile" && method === "POST") {
        if (!doc.text.trim())
          throw new HttpError(
            400,
            "No readable text was extracted. Paste the resume text or upload a clearer document.",
          );
        return Response.json(await extractProfile(db, uid, doc.text));
      }
      if (path[2] === "default" && method === "POST") {
        check(
          await db.rpc("set_default_document", {
            p_user_id: uid,
            p_document_id: id,
          }),
        );
        return Response.json({ ok: true });
      }
      if (method === "DELETE") {
        const referenced = must(
          await db
            .from("drafts")
            .select("id,status")
            .eq("user_id", uid)
            .contains("attachment_ids", [id]),
        );
        if (referenced.length)
          throw new HttpError(
            409,
            "This document is attached to a draft or sent message. Remove it from unsent drafts, or retain it for your sent history.",
          );
        check(
          await db
            .from("opportunities")
            .update({ document_id: null })
            .eq("user_id", uid)
            .eq("document_id", id),
        );
        check(await db.storage.from("documents").remove([doc.path]));
        check(
          await db.from("documents").delete().eq("user_id", uid).eq("id", id),
        );
        return Response.json({ ok: true });
      }
    }
    if (route === "opportunities" && method === "POST") {
      const input = z
        .object({
          input: z.string().trim().max(65000).default(""),
          document_id: uuid.optional(),
        })
        .refine(
          (v) => v.input.length > 0 || v.document_id,
          "Paste referral details or upload a file.",
        )
        .parse(await json(request));
      return Response.json(
        await intake(db, uid, input.input, input.document_id),
      );
    }
    if (path[0] === "opportunities" && path[1]) {
      const id = uuid.parse(path[1]);
      if (path.length === 2 && method === "DELETE") {
        const deleted = check(
          await db.rpc("delete_opportunity", {
            p_user_id: uid,
            p_opportunity_id: id,
          }),
        );
        if (!deleted)
          throw new HttpError(404, "This opportunity was not found.");
        return Response.json({ ok: true });
      }
      if (path[2] === "status" && method === "POST") {
        const input = z
          .object({
            status: z.enum([
              "new",
              "researched",
              "drafted",
              "sent",
              "discarded",
            ]),
          })
          .parse(await json(request));
        return Response.json(
          must(
            await db
              .from("opportunities")
              .update({ status: input.status, updated_at: timestamp() })
              .eq("id", id)
              .eq("user_id", uid)
              .select("*")
              .single(),
          ),
        );
      }
      if (method === "PUT") {
        const input = opportunitySchema
          .extend({
            research: z.string().max(12000).optional(),
            outcome: z
              .enum(["pending", "replied", "interview", "closed"])
              .optional(),
          })
          .parse(await json(request));
        return Response.json(
          must(
            await db
              .from("opportunities")
              .update({ ...input, updated_at: timestamp() })
              .eq("id", id)
              .eq("user_id", uid)
              .select("*")
              .single(),
          ),
        );
      }
      if (path[2] === "research" && method === "POST") {
        const input = z
          .object({ force: z.boolean().default(false) })
          .parse(await json(request));
        return Response.json(await research(db, uid, id, input.force));
      }
      if (path[2] === "sources" && method === "GET")
        return Response.json(await sourcesFor(db, uid, id));
      if (path[2] === "draft" && method === "POST") {
        const input = z
          .object({
            instructions: z.string().max(3000).default(""),
            answers: z.array(referralAnswerSchema).max(25).default([]),
          })
          .parse(await json(request));
        const opportunity = must(
          await db
            .from("opportunities")
            .select("*")
            .eq("id", id)
            .eq("user_id", uid)
            .single(),
        );
        if (
          !opportunity.recipient_email ||
          !opportunity.company ||
          !opportunity.role
        )
          throw new HttpError(
            400,
            "Add a recipient email, company, and role before drafting.",
          );
        const knowledge = await context(
          db,
          uid,
          `${opportunity.role} ${opportunity.research}`,
        );
        const settings = await getSettings(db, uid);
        const resume = check(
          await db
            .from("documents")
            .select("id")
            .eq("user_id", uid)
            .eq("is_default", true)
            .eq("kind", "resume")
            .maybeSingle(),
        );
        const generated = await prepareReferral(db, uid, {
          knowledge,
          opportunity,
          signature: settings.signature,
          hasResume: Boolean(resume),
          instructions: input.instructions,
          answers: input.answers,
        });
        if ("kind" in generated) return Response.json(generated);
        const content = draftContentSchema.parse({
          ...generated,
          recipient_email: opportunity.recipient_email,
          attachment_ids: resume ? [resume.id] : [],
        });
        const draft = must(
          await db
            .from("drafts")
            .insert({ user_id: uid, opportunity_id: id, ...content })
            .select("*")
            .single(),
        );
        if (opportunity.status !== "sent")
          check(
            await db
              .from("opportunities")
              .update({ status: "drafted", updated_at: timestamp() })
              .eq("id", id)
              .eq("user_id", uid),
          );
        return Response.json(draft);
      }
    }
    if (path[0] === "drafts" && path[1]) {
      const id = uuid.parse(path[1]);
      if (path[2] === "chat" && method === "GET")
        return Response.json(await draftMessages(db, uid, id));
      if (path[2] === "chat" && method === "POST")
        return Response.json(await draftChat(db, uid, id, await json(request)));
      if (method === "PUT") {
        const { version, ...content } = draftContentSchema
          .extend({ version: z.number().int().positive() })
          .parse(await json(request));
        if (content.attachment_ids.length) {
          const docs = must(
            await db
              .from("documents")
              .select("id")
              .eq("user_id", uid)
              .in("id", content.attachment_ids),
          );
          if (docs.length !== new Set(content.attachment_ids).size)
            throw new HttpError(400, "An attachment was not found.");
        }
        const draft = check(
          await db
            .from("drafts")
            .update({
              ...content,
              version: version + 1,
              status: "draft",
              updated_at: timestamp(),
            })
            .eq("id", id)
            .eq("user_id", uid)
            .eq("version", version)
            .in("status", ["draft", "failed"])
            .select("*")
            .maybeSingle(),
        );
        if (!draft)
          throw new HttpError(
            409,
            "This draft changed or is no longer editable. Refresh the workspace.",
          );
        return Response.json(draft);
      }
      if (path[2] === "send" && method === "POST")
        return Response.json(await sendDraft(db, uid, id, await json(request)));
      if (method === "DELETE") {
        check(
          await db
            .from("drafts")
            .delete()
            .eq("id", id)
            .eq("user_id", uid)
            .eq("status", "draft"),
        );
        return Response.json({ ok: true });
      }
    }
    if (route === "gmail/connect" && method === "POST")
      return Response.json(await gmailConnect());
    if (route === "gmail/callback" && method === "GET") {
      try {
        await gmailCallback(db, uid, new URL(request.url));
        return Response.redirect(
          new URL("/?gmail=connected", required("APP_URL")),
        );
      } catch (error) {
        return Response.redirect(
          new URL(
            `/?gmail_error=${encodeURIComponent(error instanceof HttpError ? error.message : "Gmail could not connect. Try again.")}`,
            required("APP_URL"),
          ),
        );
      }
    }
    if (route === "gmail" && method === "DELETE") {
      check(
        await db
          .from("integration_credentials")
          .delete()
          .eq("user_id", uid)
          .eq("kind", "gmail"),
      );
      return Response.json({ ok: true });
    }
    if (route === "mcp" && method === "POST") {
      const { token, ...config } = mcpSchema.parse(await json(request));
      await assertPublicUrl(config.url);
      const created = must(
        await db
          .from("mcp_configs")
          .insert({ user_id: uid, ...config })
          .select("*")
          .single(),
      );
      if (token)
        check(
          await db.from("integration_credentials").upsert(
            {
              user_id: uid,
              kind: "mcp",
              reference: created.id,
              encrypted_payload: encrypt({ token }),
            },
            { onConflict: "user_id,kind,reference" },
          ),
        );
      return Response.json(created);
    }
    if (path[0] === "mcp" && path[1]) {
      const id = uuid.parse(path[1]),
        config = must(
          await db
            .from("mcp_configs")
            .select("*")
            .eq("id", id)
            .eq("user_id", uid)
            .single(),
        );
      if (path[2] === "tools" && method === "GET") {
        const row = check(
          await db
            .from("integration_credentials")
            .select("encrypted_payload")
            .eq("user_id", uid)
            .eq("kind", "mcp")
            .eq("reference", id)
            .maybeSingle(),
        );
        const token = row
          ? decrypt<{ token: string }>(row.encrypted_payload).token
          : "";
        const client = await createMCPClient({
          transport: {
            type: "http",
            url: config.url,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            fetch: publicFetch,
          },
        });
        try {
          const tools = await client.listTools();
          return Response.json({
            tools: tools.tools.map((t) => ({
              name: t.name,
              description: t.description,
              read_only: t.annotations?.readOnlyHint === true,
            })),
          });
        } finally {
          await client.close();
        }
      }
      if (method === "PUT") {
        const update = z
          .object({
            allowed_tools: z.array(z.string()).max(30),
            enabled: z.boolean(),
          })
          .parse(await json(request));
        check(
          await db
            .from("mcp_configs")
            .update(update)
            .eq("id", id)
            .eq("user_id", uid),
        );
        return Response.json({ ok: true });
      }
      if (method === "DELETE") {
        check(
          await db
            .from("integration_credentials")
            .delete()
            .eq("user_id", uid)
            .eq("kind", "mcp")
            .eq("reference", id),
        );
        check(
          await db.from("mcp_configs").delete().eq("id", id).eq("user_id", uid),
        );
        return Response.json({ ok: true });
      }
    }
    if (route === "export" && method === "GET") {
      const data: Record<string, unknown> = {};
      for (const table of [
        "profiles",
        "memories",
        "conversations",
        "messages",
        "documents",
        "opportunities",
        "research_sources",
        "drafts",
        "send_attempts",
        "mcp_configs",
      ] as const)
        data[table] = must(await db.from(table).select("*").eq("user_id", uid));
      return Response.json(data, {
        headers: {
          "Content-Disposition":
            "attachment; filename=networking-workspace.json",
          "Cache-Control": "no-store",
        },
      });
    }
    if (route === "signout" && method === "POST") {
      const session = await sessionClient();
      const { error } = await session.auth.signOut({ scope: "local" });
      if (error)
        throw new HttpError(500, "Sign-out could not finish. Try again.");
      return Response.json({ ok: true });
    }
    throw new HttpError(404, "This endpoint was not found.");
  } catch (error) {
    return errorResponse(error);
  }
}
