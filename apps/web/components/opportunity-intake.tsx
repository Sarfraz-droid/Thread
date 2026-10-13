"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileText, ImagePlus, Wand2, X } from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Checkbox } from "@mailer/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@mailer/ui/components/field";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@mailer/ui/components/alert";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogHeader,
} from "@mailer/ui/components/dialog";
import {
  MAX_REFERRAL_FILES,
  validateFile,
  type Document,
  type Opportunity,
} from "@mailer/core";
import { request, useWorkspace } from "./workspace-context";
import { TextField, UploadButton, uploadDocument, Spinner } from "./common";

type IntakeFile = {
  key: string;
  file: File;
  preview?: string;
  // Set once uploaded, so a retry after a failure does not upload it twice.
  document?: Document;
};
type Progress = {
  stage: "files" | "structure";
  current: number;
  message: string;
};
const AUTO_MODE_KEY = "thread:auto-mode";
function readAutoMode() {
  try {
    return localStorage.getItem(AUTO_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

export function OpportunityIntake({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (opportunity: Opportunity, auto: boolean) => void;
}) {
  const { busy, error, setError, run, reload } = useWorkspace();
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<IntakeFile[]>([]);
  const [progress, setProgress] = useState<Progress>();
  const [dragging, setDragging] = useState(false);
  const [auto, setAuto] = useState(false);
  useEffect(() => setAuto(readAutoMode()), []);
  const filesRef = useRef(files);
  filesRef.current = files;
  // Release every preview URL when the intake closes for good.
  useEffect(
    () => () =>
      filesRef.current.forEach(
        (item) => item.preview && URL.revokeObjectURL(item.preview),
      ),
    [],
  );
  const working = busy === "Reading referral details";

  function addFiles(next: File[]) {
    if (!next.length) return;
    try {
      next.forEach((file) => validateFile(file.type, file.size));
      if (files.length + next.length > MAX_REFERRAL_FILES)
        throw new Error(
          `Add up to ${MAX_REFERRAL_FILES} files or screenshots per opportunity.`,
        );
      setError("");
      setFiles((current) => [
        ...current,
        ...next.map((file) => ({
          key: crypto.randomUUID(),
          file,
          preview: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This file can't be used.");
    }
  }
  function removeFile(key: string) {
    setFiles((current) => {
      const removed = current.find((item) => item.key === key);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter((item) => item.key !== key);
    });
  }
  function reset() {
    files.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    setFiles([]);
    setInput("");
    setProgress(undefined);
  }

  async function submit() {
    const uploaded: Document[] = [];
    for (const [index, item] of files.entries()) {
      if (item.document) {
        uploaded.push(item.document);
        continue;
      }
      setProgress({
        stage: "files",
        current: index,
        message: `Reading ${item.file.name}…`,
      });
      const document = await uploadDocument(item.file, "referral", (message) =>
        setProgress({ stage: "files", current: index, message }),
      );
      uploaded.push(document);
      setFiles((current) =>
        current.map((f) => (f.key === item.key ? { ...f, document } : f)),
      );
    }
    setProgress({
      stage: "structure",
      current: files.length,
      message: "Finding the company, role, and contact…",
    });
    const created = await request<Opportunity>("opportunities", "POST", {
      input,
      document_ids: uploaded.map((doc) => doc.id),
    });
    await reload();
    reset();
    onCreated(created, auto);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      disablePointerDismissal
    >
      <DialogContent
        className="intake-dialog"
        showCloseButton={false}
        data-dragging={dragging}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files") || busy) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          setDragging(false);
          if (!busy) addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <DialogHeader className="intake-heading">
          <div>
            <DialogTitle>Add an opportunity</DialogTitle>
            <DialogDescription>
              Start with the details you already have.
            </DialogDescription>
          </div>
          <DialogClose
            render={<Button variant="ghost" disabled={Boolean(busy)} />}
          >
            Close
            <X data-icon="inline-end" />
          </DialogClose>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Unable to add opportunity</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ol className="intake-steps" aria-label="Creation steps">
          <li aria-current={!working ? "step" : undefined}>
            <span>1</span>Add context
          </li>
          <li aria-current={working ? "step" : undefined}>
            <span>2</span>Review details
          </li>
          <li>
            <span>3</span>
            {auto ? "Review & send" : "Create a draft"}
          </li>
        </ol>
        <p>
          Paste a referral message or job link, or add one or more screenshots.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("Reading referral details", submit).finally(() =>
              setProgress(undefined),
            );
          }}
        >
          <FieldGroup>
            <TextField
              id="referral-input"
              label="Referral details"
              multiline
              rows={6}
              placeholder="Paste the referral message or job URL here…"
              value={input}
              onChange={setInput}
              disabled={Boolean(busy)}
              onPaste={(event) => {
                const images = Array.from(event.clipboardData.items)
                  .filter(
                    (item) =>
                      item.kind === "file" && item.type.startsWith("image/"),
                  )
                  .map((item) => item.getAsFile())
                  .filter((file): file is File => Boolean(file));
                if (!images.length || busy) return;
                event.preventDefault();
                const text = event.clipboardData.getData("text/plain");
                if (text) {
                  const { selectionStart, selectionEnd } = event.currentTarget;
                  setInput(
                    (value) =>
                      value.slice(0, selectionStart) +
                      text +
                      value.slice(selectionEnd),
                  );
                }
                addFiles(images);
              }}
              hint="Paste text or images here, or drop files anywhere in this window. Include the recipient’s email if available."
            />
            {files.length > 0 && (
              <ul
                className="intake-files"
                aria-label={`Referral attachments (${files.length} of ${MAX_REFERRAL_FILES})`}
              >
                {files.map((item, index) => {
                  const state = item.document
                    ? "done"
                    : progress?.stage === "files" && progress.current === index
                      ? "reading"
                      : working
                        ? "waiting"
                        : "ready";
                  return (
                    <li
                      key={item.key}
                      className="intake-file"
                      data-state={state}
                    >
                      <div className="intake-file-media">
                        {item.preview ? (
                          /* Clipboard and file previews use temporary blob URLs. */
                          <img
                            src={item.preview}
                            alt={`Preview of ${item.file.name}`}
                          />
                        ) : (
                          <FileText aria-hidden="true" />
                        )}
                        {state === "reading" && (
                          <span className="intake-file-overlay">
                            <Spinner />
                          </span>
                        )}
                        {state === "done" && (
                          <span
                            className="intake-file-overlay"
                            data-done="true"
                          >
                            <Check aria-label="Read" />
                          </span>
                        )}
                      </div>
                      <span className="intake-file-name" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-xs"
                        className="intake-file-remove"
                        aria-label={`Remove ${item.file.name}`}
                        disabled={Boolean(busy)}
                        onClick={() => removeFile(item.key)}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
                {files.length < MAX_REFERRAL_FILES && !busy && (
                  <li className="intake-file intake-file-add">
                    <label htmlFor="upload-referral">
                      <ImagePlus aria-hidden="true" />
                      <span>Add more</span>
                    </label>
                  </li>
                )}
              </ul>
            )}
            <Field orientation="horizontal" className="intake-auto">
              <Checkbox
                id="intake-auto-mode"
                checked={auto}
                disabled={Boolean(busy)}
                onCheckedChange={(checked) => {
                  setAuto(checked);
                  try {
                    localStorage.setItem(AUTO_MODE_KEY, checked ? "on" : "off");
                  } catch {
                    // Remembering the choice is a convenience only.
                  }
                }}
              />
              <FieldLabel htmlFor="intake-auto-mode">
                <Wand2 className="size-4" aria-hidden="true" />
                <span>
                  <strong>Auto mode</strong>
                  <small>
                    Research, draft, review the email as you would, fix it, and
                    send it through Gmail. Stops and asks you when something
                    needs your input.
                  </small>
                </span>
              </FieldLabel>
            </Field>
            {working && progress ? (
              <div className="intake-progress" role="status" aria-live="polite">
                <div className="intake-progress-bar">
                  <span
                    style={{
                      width: `${Math.round(
                        ((progress.current + 0.5) / (files.length + 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <p>
                  <Spinner />
                  {progress.stage === "files"
                    ? `File ${progress.current + 1} of ${files.length} · ${progress.message}`
                    : progress.message}
                </p>
              </div>
            ) : (
              <div className="intake-actions">
                <UploadButton
                  kind="referral"
                  multiple
                  label={
                    files.length ? "Add files" : "Add files or screenshots"
                  }
                  onSelected={addFiles}
                />
                <Button
                  type="submit"
                  disabled={(!input.trim() && !files.length) || Boolean(busy)}
                >
                  {auto
                    ? "Structure and run auto mode"
                    : "Structure opportunity"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            )}
          </FieldGroup>
        </form>
        <p className="intake-note">
          {auto
            ? "Auto mode pauses for questions it can’t answer from your profile, and only sends once its own review passes."
            : "Next, review the extracted company, role, and contact details. You can edit everything before creating an email."}
        </p>
        {dragging && (
          <div className="intake-drop" aria-hidden="true">
            <ImagePlus />
            Drop files to add them
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
