import { describe, expect, test } from "bun:test";
import {
  performDelivery,
  RejectedDelivery,
  type DeliveryOutcome,
} from "../../packages/core/src/index";
describe("send orchestration", () => {
  test("never sends if the atomic claim fails", async () => {
    let sent = 0;
    await expect(
      performDelivery({
        claim: async () => {
          throw new Error("Conflict");
        },
        deliver: async () => {
          sent++;
          return "id";
        },
        finish: async () => {},
      }),
    ).rejects.toThrow("Conflict");
    expect(sent).toBe(0);
  });
  test("persists successful delivery", async () => {
    let persisted: DeliveryOutcome | undefined;
    const result = await performDelivery({
      claim: async () => "attempt",
      deliver: async () => "gmail-id",
      finish: async (_id, outcome) => {
        persisted = outcome;
      },
    });
    expect(result.status).toBe("sent");
    expect(persisted?.messageId).toBe("gmail-id");
  });
  test("network failure stays unknown and is never retried", async () => {
    let sent = 0;
    const result = await performDelivery({
      claim: async () => "attempt",
      deliver: async () => {
        sent++;
        throw new Error("Timeout");
      },
      finish: async () => {},
    });
    expect(result.status).toBe("unknown");
    expect(sent).toBe(1);
  });
  test("a definitive rejection can be corrected", async () => {
    const result = await performDelivery({
      claim: async () => "attempt",
      deliver: async () => {
        throw new RejectedDelivery("Bad recipient");
      },
      finish: async () => {},
    });
    expect(result).toEqual({ status: "failed", error: "Bad recipient" });
  });
});
