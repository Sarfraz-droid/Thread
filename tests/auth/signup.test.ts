import { afterAll, beforeEach, expect, mock, test } from "bun:test";

const originalOwner = process.env.OWNER_EMAIL;
const originalApp = process.env.APP_URL;
let configured = true;
let autoConfirm = false;
let verified = true;
let providerError: { code: string; status: number } | null = null;
let exchangeError = false;
const signUp = mock(async (_credentials: unknown) => ({
  data: { session: autoConfirm ? { access_token: "test" } : null },
  error: providerError,
}));
const signOut = mock(async () => ({}));
const exchange = mock(async (_code: string) => ({
  error: exchangeError ? { message: "Expired" } : null,
}));
mock.module("../../apps/web/lib/server/supabase", () => ({
  isConfigured: () => configured,
  sessionClient: async () => ({
    auth: {
      signUp,
      signOut,
      exchangeCodeForSession: exchange,
      getUser: async () => ({
        data: {
          user: {
            email: "owner@example.test",
            email_confirmed_at: verified ? "2026-10-07" : undefined,
          },
        },
        error: null,
      }),
    },
  }),
}));
const { POST } = await import("../../apps/web/app/auth/signup/route");
const { GET } = await import("../../apps/web/app/auth/callback/route");

beforeEach(() => {
  process.env.OWNER_EMAIL = "owner@example.test";
  process.env.APP_URL = "https://thread.example.test";
  configured = true;
  autoConfirm = false;
  verified = true;
  providerError = null;
  exchangeError = false;
  signUp.mockClear();
  signOut.mockClear();
  exchange.mockClear();
});
afterAll(() => {
  if (originalOwner === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = originalOwner;
  if (originalApp === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalApp;
  mock.restore();
});
function request(
  email = "owner@example.test",
  password = "long-password",
  confirmation = password,
  origin = "https://thread.example.test",
) {
  return new Request("https://thread.example.test/auth/signup", {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams({
      email,
      password,
      confirm_password: confirmation,
    }),
  });
}
test("owner signup requests confirmation at the deployed callback without leaking credentials", async () => {
  const response = await POST(request("Owner@Example.test"));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "https://thread.example.test/signup?sent=1",
  );
  expect(signUp.mock.calls[0][0]).toEqual({
    email: "Owner@Example.test",
    password: "long-password",
    options: { emailRedirectTo: "https://thread.example.test/auth/callback" },
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test("rejects cross-origin and unconfigured requests before calling Supabase", async () => {
  expect(
    (
      await POST(
        request(undefined, undefined, undefined, "https://attacker.test"),
      )
    ).headers.get("location"),
  ).toEndWith("error=origin");
  configured = false;
  expect((await POST(request())).headers.get("location")).toEndWith(
    "error=configuration",
  );
  expect(signUp).not.toHaveBeenCalled();
});
test("rejects invalid passwords before creating users", async () => {
  for (const [password, confirmation] of [
    ["short", "short"],
    ["long-password", "different-password"],
  ]) {
    expect(
      (
        await POST(request("owner@example.test", password, confirmation))
      ).headers.get("location"),
    ).toEndWith("error=validation");
  }
  expect(signUp).not.toHaveBeenCalled();
});
test("an immediate session still requires a verified email", async () => {
  autoConfirm = true;
  expect((await POST(request())).headers.get("location")).toBe(
    "https://thread.example.test/",
  );
  verified = false;
  expect((await POST(request())).headers.get("location")).toEndWith(
    "error=unconfirmed",
  );
  expect(signOut).toHaveBeenCalledTimes(1);
});
test("maps rate limit, disabled signup, and password errors to actionable states", async () => {
  for (const [code, status, expected] of [
    ["over_email_send_rate_limit", 429, "rate_limit"],
    ["signup_disabled", 422, "disabled"],
    ["weak_password", 422, "weak_password"],
  ] as const) {
    providerError = { code, status };
    expect((await POST(request())).headers.get("location")).toEndWith(
      `error=${expected}`,
    );
  }
});
test("confirmation exchanges a code, verifies the email, and ignores external redirect targets", async () => {
  const response = await GET(
    new Request(
      "https://thread.example.test/auth/callback?code=test-code&next=https://attacker.test",
    ),
  );
  expect(exchange).toHaveBeenCalledWith("test-code");
  expect(response.headers.get("location")).toBe("https://thread.example.test/");
  verified = false;
  expect(
    (
      await GET(
        new Request("https://thread.example.test/auth/callback?code=test-code"),
      )
    ).headers.get("location"),
  ).toEndWith("error=unconfirmed");
  expect(signOut).toHaveBeenCalledTimes(1);
});
test("missing and expired confirmation codes never authorize access", async () => {
  expect(
    (
      await GET(new Request("https://thread.example.test/auth/callback"))
    ).headers.get("location"),
  ).toEndWith("error=confirmation");
  expect(exchange).not.toHaveBeenCalled();
  exchangeError = true;
  expect(
    (
      await GET(
        new Request("https://thread.example.test/auth/callback?code=expired"),
      )
    ).headers.get("location"),
  ).toEndWith("error=confirmation");
});
