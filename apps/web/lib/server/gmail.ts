import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import {
  draftContentSchema,
  emailRecipients,
  performDelivery,
  RejectedDelivery,
  safeFilename,
  validateAttachments,
} from "@mailer/core";
import { check, must, HttpError, required } from "./errors";
import { encrypt, decrypt } from "./crypto";
import { providerJson } from "./network";
type Db = SupabaseClient<Database>;
type GmailCredential = {
  refresh_token: string;
  access_token: string;
  expires_at: number;
  email: string;
};
const redirectUri = () =>
  `${required("APP_URL").replace(/\/$/, "")}/api/gmail/callback`;
export async function gmailConnect() {
  const state = randomBytes(32).toString("hex"),
    store = await cookies();
  store.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: new URL(required("APP_URL")).protocol === "https:",
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent select_account",
    state,
  }).toString();
  return { url: url.href };
}
export async function gmailCallback(db: Db, userId: string, url: URL) {
  const store = await cookies(),
    expected = store.get("gmail_oauth_state")?.value,
    state = url.searchParams.get("state");
  store.set("gmail_oauth_state", "", {
    httpOnly: true,
    secure: new URL(required("APP_URL")).protocol === "https:",
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 0,
  });
  if (
    !expected ||
    !state ||
    expected.length !== state.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(state))
  )
    throw new HttpError(
      400,
      "Gmail authorization expired or could not be verified. Connect again.",
    );
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error"))
    throw new HttpError(
      400,
      "Gmail permission was not granted. Connect again when ready.",
    );
  const tokens = await providerJson<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokens.refresh_token)
    throw new HttpError(
      400,
      "Google did not return offline access. Revoke this app's permission in Google and reconnect.",
    );
  const info = await providerJson<{ email: string }>(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const credential: GmailCredential = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    email: info.email,
  };
  check(
    await db.from("integration_credentials").upsert(
      {
        user_id: userId,
        kind: "gmail",
        reference: "primary",
        encrypted_payload: encrypt(credential),
      },
      { onConflict: "user_id,kind,reference" },
    ),
  );
}
export async function gmailInfo(db: Db, userId: string) {
  const row = check(
    await db
      .from("integration_credentials")
      .select("encrypted_payload")
      .eq("user_id", userId)
      .eq("kind", "gmail")
      .eq("reference", "primary")
      .maybeSingle(),
  );
  if (!row) return { connected: false, email: null };
  const credentials = decrypt<GmailCredential>(row.encrypted_payload);
  return { connected: true, email: credentials.email };
}
async function gmailCredential(db: Db, userId: string) {
  const row = check(
    await db
      .from("integration_credentials")
      .select("encrypted_payload")
      .eq("user_id", userId)
      .eq("kind", "gmail")
      .eq("reference", "primary")
      .maybeSingle(),
  );
  if (!row)
    throw new HttpError(400, "Connect Gmail in Settings before sending.");
  const credentials = decrypt<GmailCredential>(row.encrypted_payload);
  if (credentials.expires_at < Date.now() + 60000) {
    const tokens = await providerJson<{
      access_token: string;
      expires_in: number;
    }>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        refresh_token: credentials.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    credentials.access_token = tokens.access_token;
    credentials.expires_at = Date.now() + tokens.expires_in * 1000;
    check(
      await db
        .from("integration_credentials")
        .update({
          encrypted_payload: encrypt(credentials),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("kind", "gmail")
        .eq("reference", "primary"),
    );
  }
  return credentials;
}
export async function sendDraft(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
) {
  const { version, idempotency_key } = z
    .object({ version: z.number().int().positive(), idempotency_key: z.uuid() })
    .parse(input);
  const prior = check(
    await db
      .from("send_attempts")
      .select("status,gmail_message_id,draft_id,error")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotency_key)
      .maybeSingle(),
  );
  if (prior) {
    if (prior.draft_id !== id)
      throw new HttpError(409, "This send key belongs to another draft.");
    return {
      status: prior.status,
      messageId: prior.gmail_message_id,
      error: prior.error,
    };
  }
  const draft = must(
    await db
      .from("drafts")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .single(),
  );
  if (draft.version !== version || !["draft", "failed"].includes(draft.status))
    throw new HttpError(
      409,
      "This draft changed or has already been sent. Refresh before continuing.",
    );
  const content = draftContentSchema.parse(draft);
  const ids = [...new Set(content.attachment_ids)];
  const docs = ids.length
    ? must(
        await db
          .from("documents")
          .select("*")
          .eq("user_id", userId)
          .in("id", ids),
      )
    : [];
  if (docs.length !== ids.length)
    throw new HttpError(
      400,
      "One of the selected attachments is missing. Update the draft before sending.",
    );
  validateAttachments(docs);
  const attachments = await Promise.all(
    docs.map(async (doc) => {
      const file = must(await db.storage.from("documents").download(doc.path));
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length !== doc.size)
        throw new HttpError(
          400,
          "An attachment changed after upload. Upload it again.",
        );
      return {
        filename: safeFilename(doc.name),
        content: bytes,
        contentType: doc.mime_type,
      };
    }),
  );

  const credential = await gmailCredential(db, userId);
  // Gmail API reads recipients from MIME headers, including Bcc.
  // Gmail removes Bcc from the messages it delivers to recipients.
  const raw = await composeDraftEmail(content, {
    from: credential.email,
    attachments,
    messageId: `<${idempotency_key}@networking-mailer.local>`,
  });
  return performDelivery({
    claim: async () =>
      must(
        await db.rpc("claim_send", {
          p_user_id: userId,
          p_draft_id: id,
          p_version: version,
          p_key: idempotency_key,
          p_snapshot: {
            ...content,
            version,
            sender: credential.email,
            attachments: docs.map((d) => ({
              id: d.id,
              name: d.name,
              size: d.size,
              path: d.path,
            })),
          },
        }),
      ),
    deliver: async () => {
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credential.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
          signal: AbortSignal.timeout(45000),
        },
      );
      if (!response.ok) {
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408
        )
          throw new RejectedDelivery(
            response.status === 401
              ? "Gmail authorization was rejected. Reconnect your account."
              : "Gmail rejected the message. Check the recipient, attachments, and account limits before retrying.",
          );
        throw new Error("Uncertain provider response");
      }
      return z.object({ id: z.string().min(1) }).parse(await response.json())
        .id;
    },
    finish: async (attempt, outcome) => {
      check(
        await db.rpc("finish_send", {
          p_user_id: userId,
          p_attempt_id: attempt,
          p_status: outcome.status,
          p_message_id: outcome.messageId ?? "",
          p_error: outcome.error ?? "",
        }),
      );
    },
  });
}

export async function composeDraftEmail(
  content: z.infer<typeof draftContentSchema>,
  options: {
    from: string;
    messageId?: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  },
) {
  const recipients = emailRecipients(content);
  // Stream transport retains Bcc in the raw MIME submitted to Gmail.
  const composed = await nodemailer
    .createTransport({ streamTransport: true, buffer: true, newline: "unix" })
    .sendMail({
      ...options,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject: content.subject,
      text: content.body,
    });
  if (!Buffer.isBuffer(composed.message))
    throw new HttpError(500, "The email could not be composed.");
  return composed.message.toString("base64url");
}
