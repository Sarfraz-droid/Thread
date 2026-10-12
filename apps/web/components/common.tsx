"use client";
import type {
  ReactNode,
  ClipboardEventHandler,
  ReactEventHandler,
  CSSProperties,
} from "react";
import { Loader2, FileText, Upload, ArrowUpRight } from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import {
  Field,
  FieldLabel,
  FieldDescription,
} from "@mailer/ui/components/field";
import { Input } from "@mailer/ui/components/input";
import { Textarea } from "@mailer/ui/components/textarea";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@mailer/ui/components/empty";
import {
  Attachment,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
} from "@mailer/ui/components/attachment";
import { Skeleton } from "@mailer/ui/components/skeleton";
import { type Document } from "@mailer/core";
import { browserClient } from "@/lib/supabase-browser";
import { extractText } from "@/lib/extract";
import { request, useWorkspace } from "./workspace-context";
export function Spinner() {
  return (
    <Loader2 data-icon="inline-start" className="spin" aria-hidden="true" />
  );
}
// Holds the board's shape while the workspace loads so nothing jumps in later.
export function BoardSkeleton() {
  return (
    <div
      className="opportunity-board"
      role="status"
      aria-label="Loading opportunities"
    >
      {[3, 2, 1, 2].map((cards, column) => (
        <div key={column} className="kanban-column" aria-hidden="true">
          <div className="kanban-heading">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="kanban-cards">
            {Array.from({ length: cards }, (_, card) => (
              <div key={card} className="kanban-card skeleton-card">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function DashboardSkeleton() {
  return (
    <div
      className="page-body dashboard-body"
      role="status"
      aria-label="Loading your workspace"
    >
      <div className="page-heading" aria-hidden="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="home-focus skeleton-focus" aria-hidden="true">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-4/5 bg-background/60" />
          <Skeleton className="h-9 w-3/5 bg-background/60" />
          <Skeleton className="h-4 w-full bg-background/60" />
          <Skeleton className="h-9 w-36 bg-background/60" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full bg-background/60" />
          ))}
        </div>
      </div>
      <div className="dashboard-stats" aria-hidden="true">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="dashboard-grid" aria-hidden="true">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
export function TextField({
  id,
  label,
  value,
  onChange,
  multiline = false,
  hint,
  placeholder,
  required = false,
  rows = 4,
  type = "text",
  disabled = false,
  onPaste,
  onSelect,
  onScroll,
  children,
  className,
  style,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  type?: string;
  disabled?: boolean;
  onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  onSelect?: ReactEventHandler<HTMLTextAreaElement>;
  onScroll?: ReactEventHandler<HTMLTextAreaElement>;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Field className={className} style={style}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          onPaste={onPaste}
          onSelect={onSelect}
          onScroll={onScroll}
          required={required}
          disabled={disabled}
        />
      ) : (
        <Input
          id={id}
          placeholder={placeholder}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
        />
      )}{" "}
      {hint && <FieldDescription>{hint}</FieldDescription>}
      {children}
    </Field>
  );
}
export function Blank({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
export function DocumentAttachment({ document }: { document: Document }) {
  const { run } = useWorkspace();
  return (
    <Attachment>
      <AttachmentMedia>
        <FileText />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{document.name}</AttachmentTitle>
        <p className="text-muted-foreground text-xs">
          {(document.size / 1024).toFixed(0)} KB
          {document.is_default ? " · Default resume" : ""}
        </p>
      </AttachmentContent>
      <Button
        aria-label={`Open ${document.name}`}
        variant="ghost"
        size="icon"
        onClick={() =>
          void run("Opening document", async () => {
            const result = await request<{ signedUrl: string }>(
              `documents/${document.id}`,
            );
            window.open(result.signedUrl, "_blank", "noopener,noreferrer");
          })
        }
      >
        <ArrowUpRight />
      </Button>
    </Attachment>
  );
}
export async function uploadDocument(
  file: File,
  kind: Document["kind"],
  onProgress?: (message: string) => void,
) {
  const text = await extractText(file, onProgress);
  onProgress?.("Uploading securely…");
  const signed = await request<{ id: string; path: string; token: string }>(
    "documents/upload",
    "POST",
    { name: file.name, mime_type: file.type, size: file.size },
  );
  const { error } = await browserClient()
    .storage.from("documents")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type,
    });
  if (error)
    throw new Error("The upload failed. Check your connection and try again.");
  return request<Document>("documents", "POST", {
    ...signed,
    name: file.name,
    mime_type: file.type,
    size: file.size,
    kind,
    text,
  });
}
export function UploadButton({
  kind = "resume",
  onUploaded,
  onSelected,
  multiple = false,
  label = "Upload resume",
}: {
  kind?: Document["kind"];
  onUploaded?: (document: Document) => Promise<void> | void;
  // Receives the chosen files instead of uploading them immediately.
  onSelected?: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const { busy, run, reload } = useWorkspace();
  async function upload(file: File) {
    await run("Reading and uploading document", async () => {
      const document = await uploadDocument(file, kind);
      await reload();
      await onUploaded?.(document);
    });
  }
  return (
    <span className="upload-control">
      <input
        id={`upload-${kind}`}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
        multiple={multiple}
        disabled={Boolean(busy)}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) {
            if (onSelected) onSelected(files);
            else void upload(files[0]);
          }
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        disabled={Boolean(busy)}
        onClick={() => document.getElementById(`upload-${kind}`)?.click()}
      >
        {busy.includes("upload") ? (
          <Spinner />
        ) : (
          <Upload data-icon="inline-start" />
        )}
        {label}
      </Button>
    </span>
  );
}
