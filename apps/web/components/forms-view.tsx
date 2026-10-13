"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BookmarkCheck,
  Brain,
  CircleHelp,
  ClipboardList,
  ExternalLink,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Badge } from "@mailer/ui/components/badge";
import { Input } from "@mailer/ui/components/input";
import { Textarea } from "@mailer/ui/components/textarea";
import { Checkbox } from "@mailer/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@mailer/ui/components/field";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@mailer/ui/components/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@mailer/ui/components/dialog";
import {
  cleanFormAnswers,
  missingRequired,
  prefilledFormUrl,
  type FormAnswerValue,
  type FormAnswers,
  type FormFill,
  type FormQuestion,
  type FormReadResult,
  type SavedFormAnswer,
} from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import { Spinner } from "./common";

const sourceLabel = {
  memory: "From memory",
  suggested: "Suggested",
  needs_you: "Needs you",
} as const;

function QuestionControl({
  question,
  value,
  onChange,
  disabled,
}: {
  question: FormQuestion;
  value: FormAnswerValue | undefined;
  onChange: (value: FormAnswerValue | undefined) => void;
  disabled: boolean;
}) {
  const id = `form-q-${question.entryId}`;
  const single = typeof value === "string" ? value : "";
  if (question.kind === "checkboxes") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div
        className="form-options"
        role="group"
        aria-labelledby={`${id}-label`}
      >
        {question.options.map((option, index) => (
          <Field key={option} orientation="horizontal">
            <Checkbox
              id={`${id}-${index}`}
              checked={selected.includes(option)}
              disabled={disabled}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, option]
                  : selected.filter((item) => item !== option);
                onChange(next.length ? next : undefined);
              }}
            />
            <FieldLabel htmlFor={`${id}-${index}`}>{option}</FieldLabel>
          </Field>
        ))}
      </div>
    );
  }
  if (["choice", "dropdown", "scale"].includes(question.kind)) {
    if (question.options.length > 10)
      return (
        <select
          id={id}
          className="form-select"
          value={single}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          <option value="">Choose…</option>
          {question.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      );
    return (
      <div
        className="form-options"
        data-kind={question.kind}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
      >
        {question.options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            role="radio"
            aria-checked={single === option}
            variant={single === option ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onChange(single === option ? undefined : option)}
          >
            {option}
          </Button>
        ))}
      </div>
    );
  }
  if (question.kind === "paragraph")
    return (
      <Textarea
        id={id}
        rows={3}
        value={single}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    );
  return (
    <Input
      id={id}
      type={
        question.kind === "date"
          ? "date"
          : question.kind === "time"
            ? "time"
            : question.entryId === "emailAddress"
              ? "email"
              : "text"
      }
      value={single}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || undefined)}
    />
  );
}

function MemoryRow({
  row,
  onChanged,
}: {
  row: SavedFormAnswer;
  onChanged: () => Promise<void>;
}) {
  const { busy, run } = useWorkspace();
  const original = Array.isArray(row.answer)
    ? row.answer.join(", ")
    : row.answer;
  const [draft, setDraft] = useState(original);
  return (
    <li className="form-memory-row">
      <label htmlFor={`memory-${row.id}`}>{row.question}</label>
      <div>
        <Input
          id={`memory-${row.id}`}
          value={draft}
          disabled={Boolean(busy)}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Save answer for ${row.question}`}
          disabled={Boolean(busy) || draft.trim() === original || !draft.trim()}
          onClick={() =>
            void run("Saving form memory", async () => {
              await request(`form-memory/${row.id}`, "PUT", {
                answer: Array.isArray(row.answer)
                  ? draft.split(",").map((item) => item.trim())
                  : draft,
              });
              await onChanged();
            })
          }
        >
          <Save />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label={`Forget answer for ${row.question}`}
          disabled={Boolean(busy)}
          onClick={() =>
            void run("Forgetting form answer", async () => {
              await request(`form-memory/${row.id}`, "DELETE");
              await onChanged();
            })
          }
        >
          <Trash2 />
        </Button>
      </div>
      <small>
        Used {row.times_used} {row.times_used === 1 ? "time" : "times"} ·
        updated {new Date(row.updated_at).toLocaleDateString()}
      </small>
    </li>
  );
}

export function FormsView() {
  const { busy, run, loaded } = useWorkspace();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<FormReadResult>();
  const [answers, setAnswers] = useState<Partial<FormAnswers>>({});
  const [remember, setRemember] = useState(true);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [outcome, setOutcome] = useState<{
    title: string;
    description: string;
    href?: string;
  }>();
  const [memory, setMemory] = useState<SavedFormAnswer[]>([]);
  const [history, setHistory] = useState<FormFill[]>([]);
  const refresh = useCallback(async () => {
    const [rows, fills] = await Promise.all([
      request<SavedFormAnswer[]>("form-memory").catch(() => []),
      request<FormFill[]>("forms/history").catch(() => []),
    ]);
    setMemory(Array.isArray(rows) ? rows : []);
    setHistory(Array.isArray(fills) ? fills : []);
  }, []);
  useEffect(() => {
    if (loaded) void refresh();
  }, [loaded, refresh]);

  const form = result?.form;
  const filled = form
    ? cleanFormAnswers(form, answers as FormAnswers)
    : ({} as FormAnswers);
  const missing = form ? missingRequired(form, filled) : [];
  const canSubmit = form && !form.requiresSignIn && !form.hasFileUpload;

  async function fill(mode: "prefill" | "submit") {
    if (!result || !form) return;
    const saved = await request<{
      status: string;
      error?: string;
      prefill_url: string;
      remembered: number;
    }>("forms/fill", "POST", {
      url: result.url,
      answers: filled,
      mode,
      remember,
    });
    await refresh();
    const memoryNote = saved.remembered
      ? ` ${saved.remembered} ${saved.remembered === 1 ? "answer" : "answers"} saved to form memory.`
      : "";
    if (mode === "submit" && saved.status !== "submitted")
      throw new Error(saved.error ?? "The form was not submitted.");
    setOutcome(
      mode === "submit"
        ? {
            title: "Form submitted",
            description: `Your answers were sent to “${form.title}”.${memoryNote}`,
          }
        : {
            title: "Prefilled form opened",
            description: `Check the answers in your Google account and press Submit there.${memoryNote}`,
            href: saved.prefill_url,
          },
    );
  }

  return (
    <div className="page-body forms-body">
      <div className="page-heading">
        <div>
          <h1>Forms</h1>
          <p>
            Fill Google Forms with your details. Answers you confirm are
            remembered for the next form.
          </p>
        </div>
      </div>
      <section className="form-reader" aria-labelledby="form-reader-title">
        <h2 id="form-reader-title" className="sr-only">
          Read a Google Form
        </h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setOutcome(undefined);
            void run("Reading the form", async () => {
              const read = await request<FormReadResult>("forms/read", "POST", {
                url,
              });
              setResult(read);
              setAnswers(
                Object.fromEntries(
                  Object.entries(read.answers)
                    .filter(([, answer]) => answer.value !== null)
                    .map(([entryId, answer]) => [entryId, answer.value!]),
                ),
              );
            });
          }}
        >
          <Field>
            <FieldLabel htmlFor="form-url">Google Form link</FieldLabel>
            <div className="form-reader-row">
              <Input
                id="form-url"
                type="url"
                inputMode="url"
                placeholder="https://forms.gle/… or https://docs.google.com/forms/d/e/…"
                value={url}
                disabled={Boolean(busy)}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
              <Button type="submit" disabled={Boolean(busy) || !url.trim()}>
                {busy === "Reading the form" ? (
                  <Spinner />
                ) : (
                  <ClipboardList data-icon="inline-start" />
                )}
                Read form
              </Button>
            </div>
            <FieldDescription>
              Thread reads the questions, answers from your saved form memory
              first, then suggests the rest from your profile. You review
              everything before it goes anywhere.
            </FieldDescription>
          </Field>
        </form>
        {busy === "Reading the form" && (
          <p className="form-reader-status" role="status">
            <Spinner /> Reading questions and preparing answers from your
            memory…
          </p>
        )}
      </section>

      {outcome && (
        <Alert className="form-outcome">
          <BookmarkCheck />
          <AlertTitle>{outcome.title}</AlertTitle>
          <AlertDescription>
            {outcome.description}
            {outcome.href && (
              <a href={outcome.href} target="_blank" rel="noopener noreferrer">
                Open it again <ExternalLink className="inline size-3.5" />
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      {form && result && (
        <section className="form-fill" aria-labelledby="form-fill-title">
          <div className="section-heading">
            <div>
              <h2 id="form-fill-title">{form.title}</h2>
              {form.description && (
                <p className="section-description form-fill-description">
                  {form.description}
                </p>
              )}
            </div>
            <div className="form-fill-badges">
              <Badge variant="secondary">
                {form.questions.length}{" "}
                {form.questions.length === 1 ? "question" : "questions"}
              </Badge>
              {form.pageCount > 1 && (
                <Badge variant="secondary">{form.pageCount} pages</Badge>
              )}
            </div>
          </div>
          {(form.requiresSignIn || form.skipped.length > 0) && (
            <Alert>
              <CircleHelp />
              <AlertTitle>Finish a few things in Google Forms</AlertTitle>
              <AlertDescription>
                {form.requiresSignIn &&
                  "This form needs your Google sign-in, so it opens prefilled in your browser for you to submit. "}
                {form.skipped.length > 0 &&
                  `Answer these there yourself: ${form.skipped.join(", ")}.`}
              </AlertDescription>
            </Alert>
          )}
          <FieldGroup className="form-questions">
            {form.questions.map((question) => {
              const suggestion = result.answers[question.entryId];
              return (
                <Field
                  key={question.entryId}
                  className="form-question"
                  data-source={suggestion?.source}
                >
                  <div className="form-question-heading">
                    <FieldLabel
                      id={`form-q-${question.entryId}-label`}
                      htmlFor={`form-q-${question.entryId}`}
                    >
                      {question.title}
                      {question.required && (
                        <span className="form-required" aria-label="required">
                          *
                        </span>
                      )}
                    </FieldLabel>
                    {suggestion && (
                      <Badge
                        variant={
                          suggestion.source === "needs_you"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {suggestion.source === "memory" && (
                          <Brain data-icon="inline-start" />
                        )}
                        {sourceLabel[suggestion.source]}
                      </Badge>
                    )}
                  </div>
                  {question.description && (
                    <FieldDescription>{question.description}</FieldDescription>
                  )}
                  <QuestionControl
                    question={question}
                    value={answers[question.entryId]}
                    disabled={Boolean(busy)}
                    onChange={(value) =>
                      setAnswers((current) => {
                        const next = { ...current };
                        if (value === undefined) delete next[question.entryId];
                        else next[question.entryId] = value;
                        return next;
                      })
                    }
                  />
                  {suggestion?.note && suggestion.source !== "memory" && (
                    <FieldDescription className="form-question-note">
                      {suggestion.note}
                    </FieldDescription>
                  )}
                </Field>
              );
            })}
          </FieldGroup>
          <div className="form-fill-footer">
            <Field orientation="horizontal">
              <Checkbox
                id="form-remember"
                checked={remember}
                disabled={Boolean(busy)}
                onCheckedChange={setRemember}
              />
              <FieldLabel htmlFor="form-remember">
                Remember these answers for future forms
              </FieldLabel>
            </Field>
            <p className="section-description" aria-live="polite">
              {missing.length
                ? `${missing.length} required ${missing.length === 1 ? "question needs" : "questions need"} an answer.`
                : "All required questions are answered."}
            </p>
            <div className="form-fill-actions">
              {canSubmit && (
                <Button
                  variant="outline"
                  disabled={Boolean(busy) || missing.length > 0}
                  onClick={() => setConfirmSubmit(true)}
                >
                  <Send data-icon="inline-start" />
                  Submit directly
                </Button>
              )}
              <Button
                disabled={Boolean(busy)}
                onClick={() => {
                  // Open synchronously so the browser does not block the tab.
                  window.open(
                    prefilledFormUrl(form, filled),
                    "_blank",
                    "noopener,noreferrer",
                  );
                  void run("Saving form answers", () => fill("prefill"));
                }}
              >
                <ExternalLink data-icon="inline-start" />
                Open prefilled in Google Forms
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="forms-columns">
        <section className="form-memory" aria-labelledby="form-memory-title">
          <div className="section-heading">
            <div>
              <h2 id="form-memory-title">Form memory</h2>
              <p className="section-description">
                Answers reused whenever a form asks the same question. Edit or
                forget any of them.
              </p>
            </div>
            <Badge variant="secondary">{memory.length}</Badge>
          </div>
          {memory.length ? (
            <ul className="form-memory-list">
              {memory.map((row) => (
                <MemoryRow
                  key={`${row.id}-${row.updated_at}`}
                  row={row}
                  onChanged={refresh}
                />
              ))}
            </ul>
          ) : (
            <p className="section-description">
              Nothing saved yet. Your confirmed answers appear here after your
              first form.
            </p>
          )}
        </section>
        <section className="form-history" aria-labelledby="form-history-title">
          <h2 id="form-history-title">Recent forms</h2>
          {history.length ? (
            <ul>
              {history.map((fill) => (
                <li key={fill.id}>
                  <a
                    href={fill.form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {fill.title}
                  </a>
                  <Badge variant="secondary">
                    {fill.status === "prepared" ? "prefilled" : fill.status}
                  </Badge>
                  <small>{new Date(fill.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-description">No forms filled yet.</p>
          )}
        </section>
      </div>

      <Dialog
        open={confirmSubmit}
        onOpenChange={(open) => {
          if (!busy) setConfirmSubmit(open);
        }}
      >
        <DialogContent className="opportunity-delete-dialog">
          <DialogHeader>
            <DialogTitle>Submit “{form?.title}”?</DialogTitle>
            <DialogDescription>
              This sends your answers straight to the form without your Google
              sign-in. It can’t be undone. To review it in Google Forms first,
              open the prefilled form instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setConfirmSubmit(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() =>
                void run("Submitting form", async () => {
                  await fill("submit");
                  setConfirmSubmit(false);
                })
              }
            >
              {busy === "Submitting form" ? (
                <Spinner />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Submit form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
