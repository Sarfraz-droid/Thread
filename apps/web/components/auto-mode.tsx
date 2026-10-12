"use client";
import {
  AlertCircle,
  Check,
  CircleDashed,
  MinusCircle,
  Wand2,
} from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Spinner } from "./common";

export type AutoStepId = "research" | "draft" | "review" | "send";
export type AutoStep = {
  id: AutoStepId;
  label: string;
  status: "pending" | "active" | "done" | "skipped" | "blocked";
  detail?: string;
  notes?: string[];
};
export const autoSteps = (): AutoStep[] => [
  { id: "research", label: "Research the company and role", status: "pending" },
  { id: "draft", label: "Write the referral email", status: "pending" },
  { id: "review", label: "Review it as you would", status: "pending" },
  { id: "send", label: "Send through Gmail", status: "pending" },
];

function StepIcon({ status }: { status: AutoStep["status"] }) {
  if (status === "active") return <Spinner />;
  if (status === "done") return <Check aria-hidden="true" />;
  if (status === "blocked") return <AlertCircle aria-hidden="true" />;
  if (status === "skipped") return <MinusCircle aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

export function AutoModePanel({
  steps,
  running,
  disabled,
  disabledReason,
  onRun,
}: {
  steps?: AutoStep[];
  running: boolean;
  disabled: boolean;
  disabledReason?: string;
  onRun: () => void;
}) {
  const blocked = steps?.find((step) => step.status === "blocked");
  const finished = steps?.every((step) =>
    ["done", "skipped"].includes(step.status),
  );
  return (
    <section
      className="auto-mode"
      aria-labelledby="auto-mode-title"
      data-state={
        running ? "running" : blocked ? "blocked" : finished ? "done" : "idle"
      }
    >
      <div className="auto-mode-heading">
        <Wand2 className="size-4" aria-hidden="true" />
        <div>
          <h2 id="auto-mode-title">Auto mode</h2>
          <p>
            {running
              ? "Working through each step. You can watch the draft change."
              : blocked
                ? "Paused. Resolve the step below, then run it again."
                : finished
                  ? "Reviewed and sent."
                  : "Research, draft, review the email as you would, then send it."}
          </p>
        </div>
        {!running && !finished && (
          <Button
            size="sm"
            variant={blocked ? "outline" : "default"}
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
            onClick={onRun}
          >
            <Wand2 data-icon="inline-start" />
            {blocked ? "Resume auto mode" : "Run auto mode"}
          </Button>
        )}
      </div>
      {steps && (
        <ol className="auto-mode-steps" aria-live="polite">
          {steps.map((step) => (
            <li key={step.id} data-status={step.status}>
              <StepIcon status={step.status} />
              <div>
                <span>{step.label}</span>
                {step.detail && <small>{step.detail}</small>}
                {step.notes && step.notes.length > 0 && (
                  <ul>
                    {step.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {!steps && disabled && disabledReason && (
        <p className="auto-mode-hint">{disabledReason}</p>
      )}
    </section>
  );
}
