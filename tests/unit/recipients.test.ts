import { expect, mock, test } from "bun:test";
import {
  draftContentSchema,
  emailRecipients,
  parseRecipientEmails,
} from "../../packages/core/src/index";
mock.module("server-only", () => ({}));
const { composeDraftEmail } = await import("../../apps/web/lib/server/gmail");
test("recipient lists validate each address and reject header injection", () => {
  expect(
    parseRecipientEmails("a@example.com; b@example.com, A@example.com"),
  ).toHaveLength(2);
  expect(() => parseRecipientEmails("a@example.com, invalid")).toThrow();
  expect(() =>
    parseRecipientEmails("a@example.com\r\nBcc: other@example.com"),
  ).toThrow();
  expect(() =>
    parseRecipientEmails(
      Array.from({ length: 51 }, (_, i) => `user${i}@example.com`).join(","),
    ),
  ).toThrow();
});
test("legacy drafts default to empty Cc/Bcc", () => {
  const content = draftContentSchema.parse({
    recipient_email: "a@example.com",
    subject: "Hi",
    body: "Hello",
  });
  expect(content.cc_emails).toEqual([]);
  expect(content.bcc_emails).toEqual([]);
});
test("Gmail MIME contains multiple To, Cc and Bcc with no duplicate deliveries", async () => {
  const content = draftContentSchema.parse({
    recipient_email: "a@example.com, b@example.com",
    cc_emails: ["A@example.com", "c@example.com"],
    bcc_emails: ["d@example.com"],
    subject: "Hi",
    body: "Hello",
  });
  expect(emailRecipients(content)).toEqual({
    to: ["a@example.com", "b@example.com"],
    cc: ["c@example.com"],
    bcc: ["d@example.com"],
  });
  const raw = await composeDraftEmail(content, { from: "owner@example.com" });
  const mime = Buffer.from(raw, "base64url").toString();
  expect(mime).toContain("To: a@example.com, b@example.com");
  expect(mime).toContain("Cc: c@example.com");
  expect(mime).toContain("Bcc: d@example.com");
  expect(mime).toContain("Hello");
});
