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
import { type Document } from "@mailer/core";
import { browserClient } from "@/lib/supabase-browser";
import { extractText } from "@/lib/extract";
import { request, useWorkspace } from "./workspace-context";
export function Spinner() {
  return (
    <Loader2 data-icon="inline-start" className="spin" aria-hidden="true" />
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
export async function uploadDocument(file: File, kind: Document["kind"]) {
  const text = await extractText(file);
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
  label = "Upload resume",
}: {
  kind?: Document["kind"];
  onUploaded?: (document: Document) => Promise<void> | void;
  onSelected?: (file: File) => void;
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
        disabled={Boolean(busy)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (onSelected) onSelected(file);
            else void upload(file);
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
