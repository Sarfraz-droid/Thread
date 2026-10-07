"use client";
import { useState } from "react";
import {
  ArrowUp,
  Plus,
  MessageSquare,
  ArrowRight,
  Trash2,
  Brain,
  Paperclip,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Textarea } from "@mailer/ui/components/textarea";
import { Field, FieldLabel } from "@mailer/ui/components/field";
import { Badge } from "@mailer/ui/components/badge";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@mailer/ui/components/message";
import { Bubble, BubbleContent } from "@mailer/ui/components/bubble";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@mailer/ui/components/message-scroller";
import { type Message as ChatMessage } from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import { Spinner, DocumentAttachment } from "./common";
export function ChatView({ navigate }: { navigate: (view: string) => void }) {
  const { state, busy, run, reload, setError } = useWorkspace();
  const [content, setContent] = useState(""),
    [conversationId, setConversationId] = useState<string>(),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [streaming, setStreaming] = useState(false);
  async function select(id: string) {
    await run("Loading conversation", async () => {
      setMessages(await request<ChatMessage[]>(`messages?conversation=${id}`));
      setConversationId(id);
    });
  }
  async function send() {
    if (!content.trim() || streaming) return;
    const text = content.trim();
    setContent("");
    setStreaming(true);
    const userRow: ChatMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId ?? "",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const assistantId = crypto.randomUUID();
    setMessages((rows) => [
      ...rows,
      userRow,
      { ...userRow, id: assistantId, role: "assistant", content: "" },
    ]);
    await run("Thinking", async () => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          conversation_id: conversationId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        setContent(text);
        setMessages((rows) =>
          rows.filter((m) => m.id !== assistantId && m.id !== userRow.id),
        );
        throw new Error(error.error);
      }
      const id = response.headers.get("X-Conversation-Id") ?? conversationId;
      setConversationId(id);
      if (!response.body)
        throw new Error("The chat stream did not start. Try again.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((rows) =>
          rows.map((m) =>
            m.id === assistantId ? { ...m, content: answer } : m,
          ),
        );
      }
      if (!answer.trim())
        throw new Error(
          "The model did not return a response. Try a different model in Settings.",
        );
      if (id)
        setMessages(
          await request<ChatMessage[]>(`messages?conversation=${id}`),
        );
      await reload();
    });
    setStreaming(false);
  }
  return (
    <div className="chat-layout">
      <section
        className="chat-main"
        data-empty={messages.length === 0}
        aria-label="Profile conversation"
      >
        <div className="conversation-toolbar">
          <span className="subtle-label">
            <MessageSquare className="size-4" />{" "}
            {conversationId
              ? (state.conversations.find((c) => c.id === conversationId)
                  ?.title ?? "Conversation")
              : "A fresh conversation"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={streaming}
            onClick={() => {
              setConversationId(undefined);
              setMessages([]);
              setError("");
            }}
          >
            <Plus data-icon="inline-start" />
            New chat
          </Button>
        </div>
        {!messages.length && (
          <div className="chat-intro">
            <div className="intro-symbol">
              <Brain aria-hidden="true" />
            </div>
            <h1>Chat</h1>
            <p>Ask about your experience, preferences, or referral emails.</p>
            <div className="starter-prompts">
              {[
                "Help me build my profile",
                "Let’s talk about my next role",
                "What do you remember about me?",
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  onClick={() => setContent(prompt)}
                >
                  {prompt}
                  <ArrowUp data-icon="inline-end" />
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.length > 0 && (
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="chat-scroll-content">
                  {messages.map((message, index) => (
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
                            <BubbleContent className="whitespace-pre-wrap">
                              {message.content || (
                                <span className="flex items-center gap-2">
                                  <Spinner />
                                  Thinking…
                                </span>
                              )}
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Field>
            <FieldLabel htmlFor="chat-input" className="sr-only">
              Message your profile agent
            </FieldLabel>
            <Textarea
              id="chat-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tell me a little about yourself…"
              rows={3}
              disabled={streaming}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </Field>
          <div className="composer-bottom">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("profile")}
            >
              <Paperclip data-icon="inline-start" />
              Add your resume
            </Button>
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!content.trim() || Boolean(busy)}
            >
              {streaming ? <Spinner /> : <ArrowUp />}
            </Button>
          </div>
        </form>
      </section>
      <aside className="context-rail">
        <div className="rail-heading">
          <h2>Your context</h2>
          <Brain className="size-4" />
        </div>
        <section>
          <h3>Profile</h3>
          {state.profile.name ? (
            <>
              <strong>{state.profile.name}</strong>
              <p>
                {state.profile.headline || state.profile.summary.slice(0, 160)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {state.profile.skills.slice(0, 5).map((skill) => (
                  <Badge variant="secondary" key={skill}>
                    {skill}
                  </Badge>
                ))}
              </div>
              <div className="context-resume">
                {state.documents
                  .filter((d) => d.is_default)
                  .map((d) => (
                    <DocumentAttachment key={d.id} document={d} />
                  ))}
              </div>
            </>
          ) : (
            <p>
              A blank page, for now. Your resume and our conversations will fill
              this in.
            </p>
          )}
          <Button variant="link" onClick={() => navigate("profile")}>
            Build your profile
            <ArrowRight data-icon="inline-end" />
          </Button>
        </section>
        <section>
          <h3>
            Remembered about you <span>{state.memories.length}</span>
          </h3>
          {state.memories.length ? (
            state.memories.slice(0, 4).map((m) => (
              <p className="memory-snippet" key={m.id}>
                {m.content}
              </p>
            ))
          ) : (
            <p>
              Your experience, preferences, and ambitions. Saved as we talk,
              always yours to edit.
            </p>
          )}
          <Button variant="link" onClick={() => navigate("profile")}>
            View memory
            <ArrowRight data-icon="inline-end" />
          </Button>
        </section>
        <section>
          <h3>Recent conversations</h3>
          {state.conversations.length ? (
            state.conversations.slice(0, 5).map((c) => (
              <div className="conversation-row" key={c.id}>
                <Button
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start"
                  disabled={streaming}
                  onClick={() => void select(c.id)}
                >
                  <span className="truncate">{c.title}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete conversation ${c.title}`}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("Deleting conversation", async () => {
                      await request(`conversations/${c.id}`, "DELETE");
                      if (conversationId === c.id) {
                        setMessages([]);
                        setConversationId(undefined);
                      }
                      await reload();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          ) : (
            <p>Your conversations will appear here.</p>
          )}
        </section>
        <div className="rail-note">
          <span className="status-dot" /> Personal context, carried forward.
        </div>
      </aside>
    </div>
  );
}
