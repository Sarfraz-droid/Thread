"use client";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import getCaretCoordinates from "textarea-caret";
import { createPortal } from "react-dom";
import {
  Trash2,
  ArrowRight,
  Plus,
  Search,
  Mail,
  Save,
  Send,
  ExternalLink,
  Check,
  Paperclip,
  X,
  Brain,
  MessageSquare,
  FileText,
  Sparkles,
  BriefcaseBusiness,
  MessageSquarePlus,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Badge } from "@mailer/ui/components/badge";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@mailer/ui/components/field";
import { Checkbox } from "@mailer/ui/components/checkbox";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import { parseRecipientEmails } from "@mailer/core";
import {
  type DraftReviewResult,
  type ReferralAnswer,
  type ReferralDraftResult,
  type Opportunity,
  type Draft,
  type ResearchSource,
  type DraftReference,
} from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import { BoardSkeleton, TextField, Spinner } from "./common";
import { DraftChat } from "./draft-chat";
import { OpportunityIntake } from "./opportunity-intake";
import {
  AutoModePanel,
  autoSteps,
  type AutoStep,
  type AutoStepId,
} from "./auto-mode";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@mailer/ui/components/dialog";
const editableStatuses: Draft["status"][] = ["draft", "failed"];

function DraftEditor({
  draft,
  chatContainer,
  onReference,
  onDirtyChange,
}: {
  draft: Draft;
  chatContainer: HTMLElement | null;
  onReference: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { state, busy, run, reload } = useWorkspace();
  const [content, setContent] = useState(draft);
  const [dirty, setDirty] = useState(false);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const [cc, setCc] = useState((draft.cc_emails ?? []).join(", "));
  const [bcc, setBcc] = useState((draft.bcc_emails ?? []).join(", "));
  const [agentVersion, setAgentVersion] = useState<number>();
  const [reference, setReference] = useState<DraftReference>();
  const [selectionTool, setSelectionTool] = useState<
    DraftReference & { left: number; top: number }
  >();
  function selectPassage(event: SyntheticEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const text = textarea.value.slice(start, end);
    if (!text.trim() || !editable || busy) {
      setSelectionTool(undefined);
      return;
    }
    const field = textarea.closest("[data-slot=field]");
    if (!field) return;
    const box = textarea.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const caret = getCaretCoordinates(textarea, start);
    setSelectionTool({
      text,
      start,
      end,
      left: Math.max(
        8,
        Math.min(
          box.left - fieldBox.left + caret.left - textarea.scrollLeft,
          box.width - 40,
        ),
      ),
      top: Math.max(
        0,
        Math.min(
          box.top - fieldBox.top + caret.top - textarea.scrollTop - 38,
          box.bottom - fieldBox.top - 38,
        ),
      ),
    });
  }
  const editable = ["draft", "failed"].includes(draft.status);
  useEffect(() => {
    if (!dirty && draft.version >= content.version) {
      setCc((draft.cc_emails ?? []).join(", "));
      setBcc((draft.bcc_emails ?? []).join(", "));
      setContent((current) =>
        draft.version >= current.version ? draft : current,
      );
    }
  }, [draft, dirty, content.version]);
  function edit(patch: Partial<Draft>) {
    setContent((d) => ({ ...d, ...patch }));
    setDirty(true);
    if (patch.body !== undefined) {
      setReference(undefined);
      setSelectionTool(undefined);
    }
  }
  async function save(refresh = true) {
    const saved = await request<Draft>(`drafts/${draft.id}`, "PUT", {
      recipient_email: parseRecipientEmails(content.recipient_email).join(", "),
      cc_emails: parseRecipientEmails(cc),
      bcc_emails: parseRecipientEmails(bcc),
      subject: content.subject,
      body: content.body,
      attachment_ids: content.attachment_ids,
      version: content.version,
    });
    setContent(saved);
    setDirty(false);
    if (refresh) await reload();
    return saved;
  }
  return (
    <>
      <section
        className="draft-editor"
        data-agent-working={busy === "Updating draft with chat"}
        data-agent-updated={agentVersion === content.version}
      >
        <div className="section-heading">
          <div>
            <h2>
              {draft.status === "sent" ? "Sent email" : "Your email draft"}
            </h2>
            {agentVersion === content.version && (
              <p className="draft-agent-revision" role="status">
                <Check className="size-3.5" /> Updated by your agent · Review
                before sending
              </p>
            )}
          </div>
          <Badge variant={draft.status === "sent" ? "default" : "secondary"}>
            {draft.status}
          </Badge>
        </div>
        {draft.status === "sent" && (
          <Alert>
            <Check />
            <AlertTitle>Sent through Gmail</AlertTitle>
            <AlertDescription>
              This is the exact email you sent.{" "}
              {draft.sent_at && new Date(draft.sent_at).toLocaleString()}
            </AlertDescription>
          </Alert>
        )}
        {["unknown", "sending"].includes(draft.status) && (
          <Alert>
            <AlertTitle>
              {draft.status === "unknown"
                ? "Delivery needs verification"
                : "Sending, or awaiting verification"}
            </AlertTitle>
            <AlertDescription>
              Check Sent in Gmail before taking further action. This draft is
              locked to prevent a duplicate email.
            </AlertDescription>
          </Alert>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("Saving draft", () => save());
          }}
        >
          <FieldGroup>
            <TextField
              id="draft-recipient"
              label="To"
              type="text"
              value={content.recipient_email}
              onChange={(v) => edit({ recipient_email: v })}
              disabled={!editable || Boolean(busy)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Separate email addresses with commas.
            </p>
            <div className="form-two">
              <TextField
                id="draft-cc"
                label="Cc"
                value={cc}
                onChange={(value) => {
                  setCc(value);
                  setDirty(true);
                }}
                disabled={!editable || Boolean(busy)}
              />
              <TextField
                id="draft-bcc"
                label="Bcc"
                value={bcc}
                onChange={(value) => {
                  setBcc(value);
                  setDirty(true);
                }}
                disabled={!editable || Boolean(busy)}
              />
            </div>
            <TextField
              id="draft-subject"
              label="Subject"
              value={content.subject}
              onChange={(v) => edit({ subject: v })}
              disabled={!editable || Boolean(busy)}
              required
            />
            <TextField
              id="draft-body"
              label="Message"
              multiline
              rows={13}
              className="draft-body-field"
              style={{ position: "relative" }}
              onSelect={selectPassage}
              onScroll={selectPassage}
              value={content.body}
              onChange={(v) => edit({ body: v })}
              disabled={!editable || Boolean(busy)}
              required
            >
              {selectionTool && (
                <Button
                  type="button"
                  size="icon-sm"
                  className="draft-selection-tool"
                  aria-label="Ask agent about selected text"
                  title="Ask agent about selected text"
                  disabled={!editable || Boolean(busy)}
                  style={{
                    position: "absolute",
                    width: 32,
                    height: 32,
                    padding: 0,
                    zIndex: 10,
                    left: selectionTool.left,
                    top: selectionTool.top,
                  }}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setReference({
                      text: selectionTool.text,
                      start: selectionTool.start,
                      end: selectionTool.end,
                    });
                    setSelectionTool(undefined);
                    onReference();
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`draft-chat-input-${draft.id}`)
                        ?.focus(),
                    );
                  }}
                >
                  <MessageSquarePlus />
                </Button>
              )}
            </TextField>
            <FieldSet>
              <FieldLegend>
                <Paperclip className="inline size-4" /> Attachments
              </FieldLegend>
              {state.documents.length ? (
                state.documents.map((doc) => (
                  <Field key={doc.id} orientation="horizontal">
                    <Checkbox
                      id={`attach-${doc.id}`}
                      checked={content.attachment_ids.includes(doc.id)}
                      disabled={!editable || Boolean(busy)}
                      onCheckedChange={(checked) =>
                        edit({
                          attachment_ids: checked
                            ? [...content.attachment_ids, doc.id]
                            : content.attachment_ids.filter(
                                (id) => id !== doc.id,
                              ),
                        })
                      }
                    />
                    <FieldLabel htmlFor={`attach-${doc.id}`}>
                      {doc.name}{" "}
                      <span className="text-muted-foreground">
                        ({Math.ceil(doc.size / 1024)} KB)
                      </span>
                    </FieldLabel>
                  </Field>
                ))
              ) : (
                <p className="section-description">
                  Upload a resume in Profile & Memory to attach it here.
                </p>
              )}
            </FieldSet>
            {editable && (
              <div className="draft-actions">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!dirty || Boolean(busy)}
                >
                  <Save data-icon="inline-start" />
                  Save changes
                </Button>
                <Button
                  type="button"
                  disabled={dirty || Boolean(busy) || !state.gmail.connected}
                  onClick={() =>
                    void run("Sending email", async () => {
                      const outcome = await request<{
                        status: string;
                        error?: string;
                      }>(`drafts/${draft.id}/send`, "POST", {
                        version: content.version,
                        idempotency_key: crypto.randomUUID(),
                      });
                      await reload();
                      if (outcome.status !== "sent")
                        throw new Error(
                          outcome.error ??
                            "The send request is awaiting verification. Check Gmail Sent.",
                        );
                    })
                  }
                >
                  {busy === "Sending email" ? (
                    <Spinner />
                  ) : (
                    <Send data-icon="inline-start" />
                  )}
                  Send email
                </Button>
              </div>
            )}
          </FieldGroup>
        </form>
        {editable && (
          <>
            <p className="composer-note">
              {dirty
                ? "Save your changes before sending."
                : !state.gmail.connected
                  ? "Connect Gmail in Settings to send this draft."
                  : "Send emails the exact saved message and selected attachments."}
            </p>
          </>
        )}
      </section>
      {chatContainer &&
        createPortal(
          <DraftChat
            draft={content}
            reference={reference}
            onClearReference={() => setReference(undefined)}
            prepareDraft={() =>
              dirty ? save(false) : Promise.resolve(content)
            }
            onUpdated={(updated) => {
              setContent(updated);
              setDirty(false);
              setReference(undefined);
              setSelectionTool(undefined);
              if (updated.version !== content.version)
                setAgentVersion(updated.version);
            }}
          />,
          chatContainer,
        )}
    </>
  );
}
function DeleteOpportunity({
  opportunity,
  onDeleted,
}: {
  opportunity: Opportunity;
  onDeleted: () => void;
}) {
  const { state, busy, error, run, reload } = useWorkspace();
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pendingDelivery = state.drafts.some(
    (draft) =>
      draft.opportunity_id === opportunity.id &&
      ["sending", "unknown"].includes(draft.status),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            disabled={Boolean(busy) || pendingDelivery}
          />
        }
        aria-label="Delete opportunity"
        title={
          pendingDelivery
            ? "Resolve pending delivery before deleting"
            : "Delete opportunity"
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent
        className="opportunity-delete-dialog"
        showCloseButton={false}
        initialFocus={() => cancelRef.current}
      >
        <DialogHeader>
          <span className="delete-opportunity-icon" aria-hidden="true">
            <Trash2 />
          </span>
          <DialogTitle>
            Delete {opportunity.company || "this opportunity"}?
          </DialogTitle>
          <DialogDescription>
            This permanently removes the opportunity and its research, drafts,
            conversations, and local send history.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Your profile, saved memories, and uploaded files stay in your
          workspace. Emails already sent remain in Gmail.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not delete</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            ref={cancelRef}
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("Deleting opportunity", async () => {
                await request(`opportunities/${opportunity.id}`, "DELETE");
                setOpen(false);
                onDeleted();
                await reload();
              })
            }
          >
            {busy === "Deleting opportunity" ? (
              <Spinner />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}{" "}
            Confirm delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function OpportunityEditor({
  opportunity,
  autoStart = false,
  onAutoStarted,
}: {
  opportunity: Opportunity;
  autoStart?: boolean;
  onAutoStarted?: () => void;
}) {
  const { state, busy, run, reload } = useWorkspace();
  const [autoRun, setAutoRun] = useState<AutoStep[]>();
  const [draftDirty, setDraftDirty] = useState(false);
  // Set while auto mode waits on clarification answers, so answering resumes it.
  const autoPaused = useRef(false);
  const autoStarted = useRef(false);
  const [details, setDetails] = useState(opportunity),
    [sources, setSources] = useState<ResearchSource[]>([]),
    [dirty, setDirty] = useState(false),
    [draftId, setDraftId] = useState<string>();
  const [chatContainer, setChatContainer] = useState<HTMLElement | null>(null);
  const [mobilePanel, setMobilePanel] = useState("referral");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [previousAnswers, setPreviousAnswers] = useState<ReferralAnswer[]>([]);
  const clarificationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (questions.length) clarificationRef.current?.focus();
  }, [questions]);
  async function generateDraft(respond = false): Promise<Draft | undefined> {
    const submitted = respond
      ? [
          ...previousAnswers,
          ...questions.map((question) => ({
            question,
            answer: answers[question]?.trim() ?? "",
          })),
        ]
      : [];
    const result = await request<ReferralDraftResult>(
      `opportunities/${opportunity.id}/draft`,
      "POST",
      { answers: submitted },
    );
    if ("kind" in result) {
      setPreviousAnswers(submitted);
      setAnswers({});
      setQuestions(result.questions);
      setMobilePanel("referral");
      return;
    }
    setQuestions([]);
    setPreviousAnswers([]);
    setAnswers({});
    setDraftId(result.id);
    await reload();
    return result;
  }
  const drafts = state.drafts.filter(
      (d) => d.opportunity_id === opportunity.id,
    ),
    draft = drafts.find((d) => d.id === draftId) ?? drafts[0];
  const draftEditable = Boolean(
    draft && editableStatuses.includes(draft.status),
  );
  function markStep(id: AutoStepId, patch: Partial<AutoStep>) {
    setAutoRun((steps) =>
      steps?.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
  }
  // Research → draft → self-review → send, each as its own request so every
  // step stays inside the route time limit and its progress is visible.
  async function autoPipeline(existing?: Draft) {
    let step: AutoStepId = "research";
    try {
      let working = existing;
      if (!working) {
        markStep("research", { status: "active", detail: undefined });
        if (details.research)
          markStep("research", {
            status: "done",
            detail: "Using saved research",
          });
        else if (!details.company && !details.job_url)
          markStep("research", {
            status: "skipped",
            detail: "No company or job link to research",
          });
        else
          try {
            const result = await request<Opportunity>(
              `opportunities/${opportunity.id}/research`,
              "POST",
              { force: false },
            );
            setDetails(result);
            markStep("research", { status: "done", detail: "Research saved" });
          } catch (error) {
            // Research improves the email but is not required to write it.
            markStep("research", {
              status: "skipped",
              detail: `Continuing without research: ${error instanceof Error ? error.message : "it did not finish"}`,
            });
          }
        step = "draft";
        markStep("draft", {
          status: "active",
          detail: "Drafting from your profile and memories",
        });
        working = await generateDraft();
        if (!working) {
          autoPaused.current = true;
          markStep("draft", {
            status: "blocked",
            detail:
              "Answer the questions below. Auto mode continues once you do.",
          });
          return;
        }
      } else
        setAutoRun((steps) =>
          steps?.map((s) =>
            s.id === "research" && s.status === "pending"
              ? { ...s, status: "skipped", detail: "Draft already written" }
              : s,
          ),
        );
      markStep("draft", { status: "done", detail: working.subject });
      step = "review";
      markStep("review", {
        status: "active",
        detail: "Checking facts, names, tone, and the referral ask",
      });
      const review = await request<DraftReviewResult>(
        `drafts/${working.id}/review`,
        "POST",
        { version: working.version },
      );
      await reload();
      const notes = review.issues.map(
        (issue) =>
          `${issue.severity === "blocking" ? "Needs you" : "Fixed"}: ${issue.note}`,
      );
      if (!review.approved) {
        markStep("review", {
          status: "blocked",
          detail: review.summary,
          notes,
        });
        return;
      }
      markStep("review", {
        status: "done",
        detail: `${review.revised ? "Revised. " : ""}${review.summary}`,
        notes,
      });
      step = "send";
      if (!state.gmail.connected) {
        markStep("send", {
          status: "blocked",
          detail: "Connect Gmail in Settings, then resume auto mode.",
        });
        return;
      }
      markStep("send", {
        status: "active",
        detail: `Sending to ${review.draft.recipient_email}`,
      });
      const outcome = await request<{ status: string; error?: string }>(
        `drafts/${working.id}/send`,
        "POST",
        {
          version: review.draft.version,
          idempotency_key: crypto.randomUUID(),
        },
      );
      await reload();
      if (outcome.status !== "sent")
        throw new Error(
          outcome.error ??
            "The send request is awaiting verification. Check Gmail Sent.",
        );
      markStep("send", {
        status: "done",
        detail: `Sent to ${review.draft.recipient_email}`,
      });
    } catch (error) {
      markStep(step, {
        status: "blocked",
        detail: error instanceof Error ? error.message : "This step failed.",
      });
      throw error;
    }
  }
  const autoBlocker = dirty
    ? "Save opportunity details before running auto mode."
    : draftDirty
      ? "Save your email changes before running auto mode."
      : questions.length && !autoPaused.current
        ? "Answer the questions below first."
        : undefined;
  function runAuto() {
    autoPaused.current = false;
    setQuestions([]);
    setAnswers({});
    setPreviousAnswers([]);
    setAutoRun(autoSteps());
    void run("Auto mode", () =>
      autoPipeline(draftEditable ? draft : undefined),
    );
  }
  useEffect(() => {
    if (!autoStart || busy || autoStarted.current) return;
    autoStarted.current = true;
    onAutoStarted?.();
    runAuto();
  });
  function edit(field: keyof Opportunity, value: string) {
    setDetails((d) => ({ ...d, [field]: value }));
    setDirty(true);
    setQuestions([]);
    setAnswers({});
    setPreviousAnswers([]);
  }
  async function save() {
    const saved = await request<Opportunity>(
      `opportunities/${opportunity.id}`,
      "PUT",
      details,
    );
    setDetails(saved);
    setDirty(false);
    await reload();
    return saved;
  }
  return (
    <div className="referral-workspace" data-mobile-panel={mobilePanel}>
      <div
        className="referral-mobile-switch"
        role="group"
        aria-label="Referral workspace view"
      >
        <Button
          variant={mobilePanel === "referral" ? "secondary" : "ghost"}
          aria-pressed={mobilePanel === "referral"}
          onClick={() => setMobilePanel("referral")}
        >
          <FileText data-icon="inline-start" /> Referral
        </Button>
        <Button
          variant={mobilePanel === "agent" ? "secondary" : "ghost"}
          aria-pressed={mobilePanel === "agent"}
          onClick={() => setMobilePanel("agent")}
        >
          <MessageSquare data-icon="inline-start" /> Agent
        </Button>
      </div>
      <div
        className="referral-content opportunity-editor"
        aria-label="Referral and email editor"
      >
        {(autoRun || !draft || draftEditable) && (
          <AutoModePanel
            steps={autoRun}
            running={busy === "Auto mode"}
            disabled={Boolean(busy) || Boolean(autoBlocker)}
            disabledReason={autoBlocker}
            onRun={runAuto}
          />
        )}
        {questions.length > 0 && (
          <section
            ref={clarificationRef}
            tabIndex={-1}
            className="draft-editor"
            aria-labelledby="clarification-title"
          >
            <h2 id="clarification-title">A few details before drafting</h2>
            <p className="section-description">
              Answer these so your email asks for the right referral and
              accurately presents your background.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run("Drafting your email", async () => {
                  const created = await generateDraft(true);
                  if (created && autoPaused.current) {
                    autoPaused.current = false;
                    await autoPipeline(created);
                  }
                });
              }}
            >
              <FieldGroup>
                {questions.map((question, index) => (
                  <TextField
                    key={question}
                    id={`referral-answer-${index}`}
                    label={question}
                    value={answers[question] ?? ""}
                    required
                    multiline
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [question]: value,
                      }))
                    }
                  />
                ))}
                <Button
                  type="submit"
                  disabled={
                    dirty ||
                    Boolean(busy) ||
                    questions.some((question) => !answers[question]?.trim())
                  }
                >
                  {busy ? <Spinner /> : <Mail data-icon="inline-start" />}{" "}
                  Answer and create draft
                </Button>
              </FieldGroup>
            </form>
          </section>
        )}
        {draft && (
          <DraftEditor
            key={draft.id}
            draft={draft}
            chatContainer={chatContainer}
            onReference={() => setMobilePanel("agent")}
            onDirtyChange={setDraftDirty}
          />
        )}
        <details className="referral-detail-panel" open={!draft}>
          <summary>
            <BriefcaseBusiness className="size-4" /> Opportunity details{" "}
            <span>
              {opportunity.company} · {opportunity.role}
            </span>
          </summary>
          <div className="section-heading">
            <div>
              <h2>{opportunity.company || "New opportunity"}</h2>
              <p className="section-description">
                {opportunity.role || "Add the role details below"}
              </p>
            </div>
            <Badge variant="secondary">{opportunity.status}</Badge>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("Saving opportunity", save);
            }}
          >
            <FieldGroup>
              <div className="form-two">
                <TextField
                  id="company"
                  label="Company"
                  value={details.company}
                  onChange={(v) => edit("company", v)}
                  required
                />
                <TextField
                  id="role"
                  label="Role"
                  value={details.role}
                  onChange={(v) => edit("role", v)}
                  required
                />
                <TextField
                  id="recipient-name"
                  label="Recipient name"
                  value={details.recipient_name}
                  onChange={(v) => edit("recipient_name", v)}
                />
                <TextField
                  id="recipient-email"
                  label="Recipient email"
                  type="text"
                  value={details.recipient_email}
                  onChange={(v) => edit("recipient_email", v)}
                  required
                />
              </div>
              <TextField
                id="job-url"
                label="Job URL"
                value={details.job_url}
                onChange={(v) => edit("job_url", v)}
              />
              <details className="profile-details">
                <summary>Referral instructions and additional context</summary>
                <FieldGroup>
                  <TextField
                    id="job-id"
                    label="Job ID"
                    value={details.job_id}
                    onChange={(v) => edit("job_id", v)}
                  />
                  <TextField
                    id="referral-instructions"
                    label="Referral instructions"
                    multiline
                    value={details.instructions}
                    onChange={(v) => edit("instructions", v)}
                  />
                  <TextField
                    id="opportunity-notes"
                    label="Your notes"
                    multiline
                    value={details.notes}
                    onChange={(v) => edit("notes", v)}
                  />
                </FieldGroup>
              </details>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!dirty || Boolean(busy)}
                >
                  <Save data-icon="inline-start" />
                  Save details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={dirty || Boolean(busy)}
                  onClick={() =>
                    void run("Researching company and role", async () => {
                      const result = await request<Opportunity>(
                        `opportunities/${opportunity.id}/research`,
                        "POST",
                        { force: false },
                      );
                      setDetails(result);
                      setSources(
                        await request<ResearchSource[]>(
                          `opportunities/${opportunity.id}/sources`,
                        ),
                      );
                      await reload();
                    })
                  }
                >
                  {busy === "Researching company and role" ? (
                    <Spinner />
                  ) : (
                    <Search data-icon="inline-start" />
                  )}
                  Research opportunity
                </Button>
                <Button
                  type="button"
                  disabled={dirty || Boolean(busy)}
                  onClick={() =>
                    void run("Drafting your email", () => generateDraft())
                  }
                >
                  <Mail data-icon="inline-start" />
                  Create email draft
                </Button>
              </div>
            </FieldGroup>
          </form>
        </details>
        {details.research && (
          <details
            className="research-section referral-detail-panel"
            open={!draft}
          >
            <summary>
              <Search className="size-4" /> Research & sources{" "}
              <span>Company and role context</span>
            </summary>
            <div className="section-heading">
              <h2>Research notes</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run("Refreshing research", async () => {
                    const result = await request<Opportunity>(
                      `opportunities/${opportunity.id}/research`,
                      "POST",
                      { force: true },
                    );
                    setDetails(result);
                    await reload();
                  })
                }
              >
                Refresh
              </Button>
            </div>
            <TextField
              id="research-notes"
              label="Research summary"
              multiline
              rows={8}
              value={details.research}
              onChange={(v) => edit("research", v)}
            />
            <Button
              variant="link"
              onClick={() =>
                void run("Loading sources", async () =>
                  setSources(
                    await request<ResearchSource[]>(
                      `opportunities/${opportunity.id}/sources`,
                    ),
                  ),
                )
              }
            >
              View research sources
              <ExternalLink data-icon="inline-end" />
            </Button>
            {sources.map((source) => (
              <a
                className="source-link"
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.title}
                <ArrowRight className="size-4" />
                <span>
                  {new URL(source.url).hostname} ·{" "}
                  {new Date(source.retrieved_at).toLocaleDateString()}
                </span>
              </a>
            ))}
          </details>
        )}
        <details className="profile-details">
          <summary>Original referral input</summary>
          <p className="whitespace-pre-wrap text-sm">{opportunity.input}</p>
        </details>

        {drafts.length > 1 && (
          <div className="draft-history">
            <h3>Draft versions and sent history</h3>
            {drafts.map((d) => (
              <Button
                key={d.id}
                variant="ghost"
                onClick={() => setDraftId(d.id)}
              >
                {d.subject} <Badge variant="secondary">{d.status}</Badge>
              </Button>
            ))}
          </div>
        )}
        <div className="outcomes">
          <span>Outcome</span>
          {(["pending", "replied", "interview", "closed"] as const).map(
            (outcome) => (
              <Button
                key={outcome}
                variant={details.outcome === outcome ? "secondary" : "ghost"}
                size="sm"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run("Updating outcome", async () => {
                    const result = await request<Opportunity>(
                      `opportunities/${opportunity.id}`,
                      "PUT",
                      { ...details, outcome },
                    );
                    setDetails(result);
                    await reload();
                  })
                }
              >
                {outcome}
              </Button>
            ),
          )}
        </div>
      </div>
      <aside
        className="referral-agent-pane"
        ref={setChatContainer}
        aria-label="Referral agent"
      >
        {!draft && (
          <section className="referral-agent-empty">
            <div className="agent-pane-heading">
              <Brain className="size-5" />
              <h3>Referral agent</h3>
              <span className="agent-state">
                <span className="agent-state-dot" />
                {busy ? "Working" : "Ready"}
              </span>
            </div>
            <div className="agent-empty-content">
              <Sparkles className="size-8" aria-hidden="true" />
              <h4>A stronger email starts with your story.</h4>
              <p>
                Create your draft, then chat here to shape the message, add your
                experience, and build your profile.
              </p>
              <div className="agent-context-summary">
                <strong>{details.company || "Your opportunity"}</strong>
                <span>{details.role || "Add a role to get started"}</span>
                <span>
                  {state.memories.length} saved{" "}
                  {state.memories.length === 1 ? "memory" : "memories"}{" "}
                  available
                </span>
              </div>
              <Button
                disabled={dirty || Boolean(busy)}
                onClick={() =>
                  void run("Drafting your email", () => generateDraft())
                }
              >
                {busy === "Drafting your email" ? (
                  <Spinner />
                ) : (
                  <Mail data-icon="inline-start" />
                )}{" "}
                Start a draft
              </Button>
              {dirty && (
                <p className="section-description">
                  Save opportunity details before drafting.
                </p>
              )}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
export function OpportunitiesView({
  initialSelected,
  initialCreate = false,
}: {
  initialSelected?: string;
  initialCreate?: boolean;
}) {
  const { state, busy, loaded, error, run, reload } = useWorkspace();
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialSelected));
  const [autoStartId, setAutoStartId] = useState<string>();
  const [showIntake, setShowIntake] = useState(
    initialCreate || (loaded && !state.opportunities.length),
  );
  // An empty workspace opens the intake, but only once data has actually loaded.
  const promptedEmpty = useRef(loaded);
  useEffect(() => {
    if (!loaded || promptedEmpty.current) return;
    promptedEmpty.current = true;
    if (!state.opportunities.length) setShowIntake(true);
  }, [loaded, state.opportunities.length]);
  const [view, setView] = useState<"board" | "table">("board");
  const [sentRange, setSentRange] = useState<"today" | "all">("today");
  const today = new Date().toDateString();
  const [dragging, setDragging] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();
  const moveTo = (id: string, status: Opportunity["status"]) => {
    setDragging(undefined);
    setDropTarget(undefined);
    const current = state.opportunities.find((o) => o.id === id);
    if (!current || current.status === status) return;
    void run(
      status === "discarded" ? "Discarding opportunity" : "Moving opportunity",
      async () => {
        await request(`opportunities/${id}/status`, "POST", { status });
        await reload();
      },
    );
  };
  const opener = useRef<HTMLElement | null>(null);
  const opportunity = state.opportunities.find((o) => o.id === selected);
  return (
    <>
      <OpportunityIntake
        open={showIntake}
        onOpenChange={setShowIntake}
        onCreated={(created, auto) => {
          setSelected(created.id);
          setAutoStartId(auto ? created.id : undefined);
          setDialogOpen(true);
          setShowIntake(false);
        }}
      />
      <Dialog
        open={dialogOpen && Boolean(opportunity)}
        onOpenChange={(open) => {
          if (!busy) setDialogOpen(open);
        }}
        disablePointerDismissal
      >
        <div className="page-body">
          <div className="page-heading">
            <div>
              <h1>Opportunities</h1>
              <p>From a promising lead to a personal conversation.</p>
            </div>
            {state.opportunities.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1" role="group" aria-label="View">
                  <Button
                    variant={view === "board" ? "secondary" : "ghost"}
                    aria-pressed={view === "board"}
                    onClick={() => setView("board")}
                  >
                    Board
                  </Button>
                  <Button
                    variant={view === "table" ? "secondary" : "ghost"}
                    aria-pressed={view === "table"}
                    onClick={() => setView("table")}
                  >
                    Table
                  </Button>
                </div>
                {view === "board" && (
                  <div
                    className="flex gap-1"
                    role="group"
                    aria-label="Sent filter"
                  >
                    <Button
                      variant={sentRange === "today" ? "secondary" : "ghost"}
                      aria-pressed={sentRange === "today"}
                      onClick={() => setSentRange("today")}
                    >
                      Sent today
                    </Button>
                    <Button
                      variant={sentRange === "all" ? "secondary" : "ghost"}
                      aria-pressed={sentRange === "all"}
                      onClick={() => setSentRange("all")}
                    >
                      All sent
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowIntake(true);
                    setDialogOpen(false);
                    setSelected(undefined);
                  }}
                >
                  <Plus data-icon="inline-start" />
                  New opportunity
                </Button>
              </div>
            )}
          </div>
          <div
            className="opportunities-layout referrals-overview"
            data-empty={loaded && !state.opportunities.length}
          >
            {!loaded && <BoardSkeleton />}
            {state.opportunities.length > 0 && view === "table" && (
              <section
                className="opportunity-table-wrap"
                aria-label="All opportunities"
              >
                <table className="opportunity-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Outcome</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...state.opportunities]
                      .sort((x, y) => y.updated_at.localeCompare(x.updated_at))
                      .map((o) => (
                        <tr key={o.id}>
                          <td>
                            <DialogTrigger
                              render={<Button variant="link" />}
                              aria-label={`Open ${o.company || "New opportunity"}, ${o.role || "Details needed"}`}
                              onClick={(event) => {
                                opener.current = event.currentTarget;
                                setSelected(o.id);
                              }}
                            >
                              {o.company || "New opportunity"}
                            </DialogTrigger>
                          </td>
                          <td>{o.role || "Details needed"}</td>
                          <td>{o.recipient_email || "—"}</td>
                          <td>
                            <Badge variant="secondary">{o.status}</Badge>
                          </td>
                          <td>{o.outcome}</td>
                          <td>{new Date(o.updated_at).toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            )}
            {state.opportunities.length > 0 && view === "board" && (
              <section
                className="opportunity-board"
                aria-label="Opportunities board"
              >
                {(
                  [
                    ["new", "New"],
                    ["researched", "Researched"],
                    ["drafted", "Drafted"],
                    ["sent", "Sent"],
                  ] as const
                ).map(([status, title]) => {
                  const opportunities = state.opportunities.filter(
                    (item) =>
                      item.status === status &&
                      (status !== "sent" ||
                        sentRange === "all" ||
                        new Date(item.updated_at).toDateString() === today),
                  );
                  const hidden =
                    status === "sent"
                      ? state.opportunities.filter(
                          (item) => item.status === "sent",
                        ).length - opportunities.length
                      : 0;
                  return (
                    <section
                      key={status}
                      className="kanban-column"
                      data-drop={dropTarget === status}
                      aria-label={`${title} opportunities`}
                      onDragOver={(e) => {
                        if (!dragging) return;
                        e.preventDefault();
                        setDropTarget(status);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setDropTarget(undefined);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        if (id) moveTo(id, status);
                      }}
                    >
                      <div className="kanban-heading">
                        <h2>
                          <span
                            className="kanban-status"
                            data-status={status}
                          />
                          {title}
                        </h2>
                        <Badge
                          variant="secondary"
                          aria-label={`${opportunities.length} opportunities`}
                        >
                          {opportunities.length}
                        </Badge>
                      </div>
                      <div className="kanban-cards">
                        {opportunities.map((o) => (
                          <DialogTrigger
                            key={o.id}
                            render={
                              <Button
                                variant="ghost"
                                className="kanban-card"
                                draggable
                                data-dragging={dragging === o.id}
                                onDragStart={(e: React.DragEvent) => {
                                  e.dataTransfer.setData("text/plain", o.id);
                                  e.dataTransfer.effectAllowed = "move";
                                  setDragging(o.id);
                                }}
                                onDragEnd={() => {
                                  setDragging(undefined);
                                  setDropTarget(undefined);
                                }}
                              />
                            }
                            aria-label={`Open ${o.company || "New opportunity"}, ${o.role || "Details needed"}`}
                            onClick={(event) => {
                              opener.current = event.currentTarget;
                              setSelected(o.id);
                            }}
                          >
                            <span className="kanban-card-top">
                              <span className="company-monogram">
                                {o.company.slice(0, 1) || "?"}
                              </span>
                              <ArrowRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            </span>
                            <strong>{o.company || "New opportunity"}</strong>
                            <span className="kanban-role">
                              {o.role || "Details needed"}
                            </span>
                            {o.outcome !== "pending" && (
                              <Badge variant="secondary">{o.outcome}</Badge>
                            )}
                          </DialogTrigger>
                        ))}
                        {!opportunities.length && (
                          <p className="kanban-empty">No opportunities</p>
                        )}
                        {hidden > 0 && (
                          <p className="kanban-empty">
                            {hidden} earlier sent hidden. Use All sent or Table.
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
                {dragging && (
                  <div
                    className="kanban-discard"
                    data-drop={dropTarget === "discarded"}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget("discarded");
                    }}
                    onDragLeave={() => setDropTarget(undefined)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) moveTo(id, "discarded");
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Drop here to discard
                  </div>
                )}
              </section>
            )}
            {loaded && !state.opportunities.length && (
              <div className="dashboard-empty">
                <p>
                  No opportunities yet. Add a referral or job link to get
                  started.
                </p>
                <Button onClick={() => setShowIntake(true)}>
                  <Plus data-icon="inline-start" />
                  New opportunity
                </Button>
              </div>
            )}
          </div>
        </div>
        {opportunity && (
          <DialogContent
            className="referral-dialog"
            showCloseButton={false}
            keepMounted
            finalFocus={() => opener.current}
          >
            <DialogHeader className="referral-dialog-header">
              <div className="referral-dialog-identity">
                <span className="company-monogram" aria-hidden="true">
                  {opportunity.company.slice(0, 1) || "?"}
                </span>
                <div>
                  <DialogTitle>
                    {opportunity.company || "Referral workspace"}
                  </DialogTitle>
                  <DialogDescription>
                    {opportunity.role || "Review and prepare your referral"}
                  </DialogDescription>
                </div>
              </div>
              <div className="referral-dialog-header-actions">
                <Badge variant="secondary">{opportunity.status}</Badge>
                <DeleteOpportunity
                  opportunity={opportunity}
                  onDeleted={() => {
                    setDialogOpen(false);
                    setSelected(undefined);
                  }}
                />
                <DialogClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={Boolean(busy)}
                    />
                  }
                >
                  <X />
                  <span className="sr-only">Close referral</span>
                </DialogClose>
              </div>
            </DialogHeader>
            {error && (
              <Alert className="referral-dialog-error" variant="destructive">
                <AlertTitle>Could not finish</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <OpportunityEditor
              key={opportunity.id}
              opportunity={opportunity}
              autoStart={autoStartId === opportunity.id}
              onAutoStarted={() => setAutoStartId(undefined)}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
