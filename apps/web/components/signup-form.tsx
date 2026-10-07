"use client";

import { useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@mailer/ui/components/button";
import { Input } from "@mailer/ui/components/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@mailer/ui/components/field";

export function SignupForm({ configured }: { configured: boolean }) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const confirmation = useRef<HTMLInputElement>(null);

  function validatePasswords(form: HTMLFormElement) {
    const values = new FormData(form);
    const invalid =
      Boolean(values.get("confirm_password")) &&
      values.get("password") !== values.get("confirm_password");
    confirmation.current?.setCustomValidity(
      invalid ? "Both passwords must match." : "",
    );
    setMismatch(invalid);
  }

  return (
    <form
      action="/auth/signup"
      method="post"
      aria-busy={pending}
      onChange={(event) => validatePasswords(event.currentTarget)}
      onSubmit={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        validatePasswords(event.currentTarget);
        if (!event.currentTarget.reportValidity()) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="signup-email">Email</FieldLabel>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={254}
            aria-describedby="signup-email-help"
            required
          />
          <FieldDescription id="signup-email-help">
            Use an email address you can access for confirmation.
          </FieldDescription>
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="signup-password">Password</FieldLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={visible}
              aria-controls="signup-password signup-confirm-password"
              onClick={() => setVisible(!visible)}
            >
              {visible ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
              {visible ? "Hide passwords" : "Show passwords"}
            </Button>
          </div>
          <Input
            id="signup-password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={4096}
            aria-describedby="signup-password-help"
            required
          />
          <FieldDescription id="signup-password-help">
            Use at least 8 characters.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-confirm-password">
            Confirm password
          </FieldLabel>
          <Input
            ref={confirmation}
            id="signup-confirm-password"
            name="confirm_password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={4096}
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? "signup-password-error" : undefined}
            required
          />
          <p
            id="signup-password-error"
            aria-live="polite"
            className="text-sm text-destructive"
          >
            {mismatch ? "Both passwords must match." : null}
          </p>
        </Field>
        <Button
          type="submit"
          className="w-full"
          disabled={!configured || pending}
        >
          {pending ? "Creating account…" : "Create account"}
          {pending ? (
            <LoaderCircle aria-hidden="true" />
          ) : (
            <ArrowRight data-icon="inline-end" />
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
