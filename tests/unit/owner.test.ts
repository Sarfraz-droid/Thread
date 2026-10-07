import { describe, expect, test } from "bun:test";
import { isOwnerAccount } from "../../apps/web/lib/owner";
describe("owner authentication", () => {
  test("accepts only a confirmed owner email", () => {
    expect(
      isOwnerAccount(
        { email: "Owner@Example.test", email_confirmed_at: "2026-10-06" },
        "owner@example.test",
      ),
    ).toBe(true);
  });
  test("rejects a different verified account", () => {
    expect(
      isOwnerAccount(
        { email: "someone@example.test", email_confirmed_at: "2026-10-06" },
        "owner@example.test",
      ),
    ).toBe(false);
  });
  test("rejects unverified or missing identity and missing owner configuration", () => {
    expect(
      isOwnerAccount({ email: "owner@example.test" }, "owner@example.test"),
    ).toBe(false);
    expect(isOwnerAccount({}, "owner@example.test")).toBe(false);
    expect(
      isOwnerAccount(
        { email: "owner@example.test", email_confirmed_at: "2026-10-06" },
        undefined,
      ),
    ).toBe(false);
  });
});
