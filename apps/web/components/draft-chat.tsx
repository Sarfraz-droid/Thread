"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Brain,
  Check,
  RefreshCw,
  Sparkles,
  FileText,
  X,
  Quote,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Textarea } from "@mailer/ui/components/textarea";
import { Field, FieldLabel } from "@mailer/ui/components/field";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@mailer/ui/components/message";
import { Bubble, BubbleContent } from "@mailer/ui/components/bubble";
import {
  applyProfileUpdates,
  readDraftChatReply,
  type Draft,
  type DraftReference,
  type DraftChatResult,
  type Message as ChatMessage,
  type ProfileUpdate,
} from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import { Spinner } from "./common";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@mailer/ui/components/message-scroller";

export function DraftChat({
  draft,
  prepareDraft,
  onUpdated,
  reference,
  onClearReference,
}: {
  draft: Draft;
  prepareDraft: () => Promise<Draft>;
  onUpdated: (draft: Draft) => void;
  reference?: DraftReference;
  onClearReference: () => void;
}) {
  const { state, busy, run, reload } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingMessage, setPendingMessage] = useState("");
  const [workingStage, setWorkingStage] = useState("Preparing your draft");
  const sendingRef = useRef(false);
  const editable = ["draft", "failed"].includes(draft.status);
  useEffect(() => {
    let cancelled = false;
    request<ChatMessage[]>(`drafts/${draft.id}/chat`)
      .then((rows) => {
        if (!cancelled) {
          setMessages(rows);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load this conversation.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id, loadAttempt]);
  async function send() {
    if (
      !content.trim() ||
      sendingRef.current ||
      busy ||
      loading ||
      !editable ||
      loadError
    )
      return;
    const text = content.trim();
    sendingRef.current = true;
    setSending(true);
    setPendingMessage(text);
    setWorkingStage("Preparing your draft");
    try {
      await run("Updating draft with chat", async () => {
        const saved = await prepareDraft();
        setWorkingStage("Revising with your profile & memory");
        const result = await request<DraftChatResult>(
          `drafts/${draft.id}/chat`,
          "POST",
          { content: text, version: saved.version, reference },
        );
        onUpdated(result.draft);
        setContent("");
        onClearReference();
        // Persisted messages are the source of truth, including memory outcomes.
        setWorkingStage("Loading saved conversation");
        setMessages(await request<ChatMessage[]>(`drafts/${draft.id}/chat`));
        await reload();
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
      setPendingMessage("");
    }
  }
  async function apply(update: ProfileUpdate) {
    await run("Updating your profile", async () => {
      // Fetch current data so accepting a suggestion does not overwrite other
      // profile edits made since this draft conversation was loaded.
      const latest = await request<typeof state>("state");
      await request(
        "profile",
        "PUT",
        applyProfileUpdates(latest.profile, [update]),
      );
      await reload();
    });
  }
  const latestAssistant = messages.findLast(
    (message) => message.role === "assistant",
  )?.id;
  return (
    <section
      className="draft-chat"
      aria-labelledby={`draft-chat-title-${draft.id}`}
    >
      <div className="agent-pane-heading">
        <Brain className="size-5" aria-hidden="true" />
        <h3 id={`draft-chat-title-${draft.id}`}>Referral agent</h3>
        <span className="agent-state" data-working={sending}>
          <span className="agent-state-dot" />
          {sending ? "Working" : editable ? "Ready" : "Read only"}
        </span>
      </div>
      <p className="agent-pane-description">
        Draft edits, with your profile and memory in context.
      </p>
      {loading && (
        <p className="draft-chat-status" role="status">
          <Spinner /> Loading conversation…
        </p>
      )}
      {loadError && (
        <div className="draft-chat-load-error" role="alert">
          <p>{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(busy)}
            onClick={() => {
              setLoading(true);
              setLoadAttempt((value) => value + 1);
            }}
          >
            <RefreshCw data-icon="inline-start" /> Retry loading chat
          </Button>
        </div>
      )}
      <div className="agent-thread">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent
                className="draft-chat-messages"
                role="log"
                aria-label="Draft conversation"
                aria-live="polite"
                aria-busy={sending}
              >
                {!loading &&
                  !loadError &&
                  messages.length === 0 &&
                  !sending &&
                  editable && (
                    <MessageScrollerItem>
                      <div className="agent-chat-intro">
                        <Sparkles className="size-7" aria-hidden="true" />
                        <h4>Shape the email together.</h4>
                        <p>
                          Tell me what to change or share experience that makes
                          your story stronger.
                        </p>
                        <div className="draft-chat-starters">
                          {[
                            "Make it shorter and more natural",
                            "Make the opening warmer",
                            "Ask me what experience would strengthen this email",
                          ].map((prompt) => (
                            <Button
                              key={prompt}
                              variant="outline"
                              size="sm"
                              disabled={Boolean(busy)}
                              onClick={() => setContent(prompt)}
                            >
                              {prompt}
                              <ArrowUp className="size-3.5" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    </MessageScrollerItem>
                  )}
                {messages.map((message, index) => {
                  const reply =
                    message.role === "assistant"
                      ? readDraftChatReply(message.content)
                      : null;
                  return (
                    <MessageScrollerItem
                      key={message.id}
                      scrollAnchor={index === messages.length - 1}
                    >
                      <Message
                        align={message.role === "user" ? "end" : "start"}
                      >
                        <MessageContent>
                          <MessageHeader>
                            {message.role === "user" ? "You" : "Thread"}
                          </MessageHeader>
                          <Bubble
                            variant={
                              message.role === "user" ? "secondary" : "ghost"
                            }
                          >
                            <BubbleContent className="whitespace-pre-wrap break-words">
                              {reply?.message ?? message.content}
                            </BubbleContent>
                          </Bubble>
                          {reply && (
                            <div className="draft-chat-outcomes">
                              {reply.draft_updated && (
                                <span>
                                  <Check
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />{" "}
                                  Draft updated
                                </span>
                              )}
                              {reply.memory.saved > 0 && (
                                <span>
                                  {reply.memory.saved}{" "}
                                  {reply.memory.saved === 1
                                    ? "fact remembered"
                                    : "facts remembered"}
                                </span>
                              )}
                              {reply.memory.conflicts > 0 && (
                                <p>
                                  {reply.memory.conflicts}{" "}
                                  {reply.memory.conflicts === 1
                                    ? "fact needs"
                                    : "facts need"}{" "}
                                  review in Profile & memory.
                                </p>
                              )}
                              {reply.memory.failed && (
                                <p>
                                  Memory could not finish saving. Check Profile
                                  & memory before relying on these facts.
                                </p>
                              )}
                            </div>
                          )}
                          {reply &&
                            message.id === latestAssistant &&
                            reply.profile_updates.length > 0 && (
                              <div className="draft-profile-suggestions">
                                <h4>Suggested profile changes</h4>
                                {reply.profile_updates.map((update, index) => {
                                  const applied =
                                    JSON.stringify(
                                      state.profile[update.field],
                                    ) === JSON.stringify(update.value);
                                  return (
                                    <div
                                      className="draft-profile-suggestion"
                                      key={`${update.field}-${index}`}
                                    >
                                      <strong>
                                        {update.field.replaceAll("_", " ")}
                                      </strong>
                                      <p className="whitespace-pre-wrap break-words">
                                        {Array.isArray(update.value)
                                          ? update.value.join(", ")
                                          : update.value}
                                      </p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={Boolean(busy) || applied}
                                        onClick={() => void apply(update)}
                                      >
                                        {applied ? (
                                          <Check data-icon="inline-start" />
                                        ) : (
                                          <Brain data-icon="inline-start" />
                                        )}
                                        {applied
                                          ? "Saved to profile"
                                          : "Apply to profile"}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  );
                })}
                {sending && (
                  <MessageScrollerItem scrollAnchor>
                    <Message align="end">
                      <MessageContent>
                        <MessageHeader>You</MessageHeader>
                        <Bubble variant="secondary">
                          <BubbleContent className="whitespace-pre-wrap break-words">
                            {pendingMessage}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                    <div className="agent-working" role="status">
                      <span className="agent-working-icon">
                        <Brain className="size-4" />
                      </span>
                      <div>
                        <strong>{workingStage}</strong>
                        <p>
                          Keeping your experience grounded in what you share.
                        </p>
                      </div>
                      <Spinner />
                    </div>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
      {editable ? (
        <form
          className="draft-chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {reference && (
            <div className="agent-selected-reference">
              <div>
                <Quote className="size-3.5" />
                <strong>Selected from email</strong>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove selected text reference"
                  disabled={Boolean(busy)}
                  onClick={onClearReference}
                >
                  <X />
                </Button>
              </div>
              <blockquote>{reference.text}</blockquote>
            </div>
          )}
          <Field>
            <FieldLabel
              className="sr-only"
              htmlFor={`draft-chat-input-${draft.id}`}
            >
              Message your draft assistant
            </FieldLabel>
            <Textarea
              id={`draft-chat-input-${draft.id}`}
              value={content}
              rows={3}
              maxLength={12000}
              placeholder={
                reference
                  ? "What should I change about this passage?"
                  : "Ask for an edit, or share more about yourself…"
              }
              disabled={Boolean(busy) || loading || Boolean(loadError)}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
          </Field>
          <div className="draft-chat-composer-bottom">
            <p className="section-description">
              <FileText className="size-3.5" /> Working on version{" "}
              {draft.version}
            </p>
            <Button
              type="submit"
              disabled={
                !content.trim() ||
                Boolean(busy) ||
                loading ||
                Boolean(loadError)
              }
            >
              {sending ? <Spinner /> : <ArrowUp data-icon="inline-start" />}{" "}
              Send message
            </Button>
          </div>
          <p className="agent-composer-note">
            Personal facts build memory. Review suggested profile changes before
            applying.
          </p>
        </form>
      ) : (
        <p className="section-description">
          This email is locked. Its conversation is kept here for reference.
        </p>
      )}
    </section>
  );
}
