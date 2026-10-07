import { describe, expect, test } from "bun:test";
import {
  draftContentSchema,
  memoryDecision,
  MAX_ATTACHMENT_SIZE,
  validateAttachments,
  validateFile,
} from "./index";

describe("grounded memories", () => {
  const proposal = {
    key: "preferences.location",
    content: "Prefers remote roles",
    evidence: "I want remote roles",
  };
  test("rejects unsupported inference", () =>
    expect(memoryDecision(undefined, proposal, "I want a new role")).toBe(
      "reject",
    ));
  test("saves an explicit statement", () =>
    expect(memoryDecision(undefined, proposal, "I want remote roles")).toBe(
      "insert",
    ));
  test("asks about conflicting statements", () =>
    expect(
      memoryDecision(
        { content: "Prefers hybrid", status: "active" },
        proposal,
        proposal.evidence,
      ),
    ).toBe("conflict"));
  test("forgotten facts cannot be automatically recreated", () =>
    expect(
      memoryDecision(
        { content: proposal.content, status: "forgotten" },
        proposal,
        proposal.evidence,
      ),
    ).toBe("reject"));
  test("does not duplicate identical facts", () =>
    expect(
      memoryDecision(
        { content: proposal.content, status: "active" },
        proposal,
        proposal.evidence,
      ),
    ).toBe("unchanged"));
});
describe("email and documents", () => {
  test("rejects header injection", () =>
    expect(
      draftContentSchema.safeParse({
        recipient_email: "a@example.com",
        subject: "Hello\r\nBcc: hidden@example.com",
        body: "Hi",
      }).success,
    ).toBe(false));
  test("requires an actual recipient", () =>
    expect(
      draftContentSchema.safeParse({
        recipient_email: "",
        subject: "Hello",
        body: "Hi",
      }).success,
    ).toBe(false));
  test("rejects oversized combined attachments", () =>
    expect(() =>
      validateAttachments([{ size: MAX_ATTACHMENT_SIZE }, { size: 1 }]),
    ).toThrow());
  test("rejects unsupported and empty files", () => {
    expect(() => validateFile("text/html", 20)).toThrow();
    expect(() => validateFile("application/pdf", 0)).toThrow();
  });
});
