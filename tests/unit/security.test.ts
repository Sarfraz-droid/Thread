import { afterAll, describe, expect, test } from "bun:test";
import { encrypt, decrypt } from "../../apps/web/lib/server/crypto";
import {
  assertPublicUrl,
  isPublicAddress,
} from "../../apps/web/lib/server/network";
const original = process.env.ENCRYPTION_KEY;
process.env.ENCRYPTION_KEY = "a".repeat(64);
afterAll(() => {
  if (original) process.env.ENCRYPTION_KEY = original;
  else delete process.env.ENCRYPTION_KEY;
});
describe("credential protection", () => {
  test("encrypts and authenticates credentials", () => {
    const value = {
      refresh_token: "test-only-secret",
      email: "owner@example.test",
    };
    const encrypted = encrypt(value);
    expect(encrypted).not.toContain(value.refresh_token);
    expect(decrypt(encrypted)).toEqual(value);
  });
  test("detects tampering", () => {
    const [iv, tag, data] = encrypt({ token: "secret" }).split(".");
    const bytes = Buffer.from(data, "base64url");
    bytes[0] ^= 255;
    expect(() =>
      decrypt([iv, tag, bytes.toString("base64url")].join(".")),
    ).toThrow();
  });
  test("uses a fresh nonce for every encryption", () =>
    expect(encrypt({ a: 1 })).not.toBe(encrypt({ a: 1 })));
});
describe("remote endpoint isolation", () => {
  test("blocks loopback, private, and metadata addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.100.100.200",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPublicAddress(address)).toBe(false);
  });
  test("permits public addresses", () =>
    expect(isPublicAddress("8.8.8.8")).toBe(true));
  test("requires HTTPS without URL credentials", async () => {
    await expect(assertPublicUrl("http://example.com")).rejects.toThrow(
      "HTTPS",
    );
    await expect(
      assertPublicUrl("https://user:pass@example.com"),
    ).rejects.toThrow("HTTPS");
  });
  test("blocks literal private HTTPS targets", async () =>
    expect(assertPublicUrl("https://169.254.169.254")).rejects.toThrow(
      "Private",
    ));
});
