import { expect, test } from "bun:test";
import { errorResponse } from "../../apps/web/lib/server/errors";

test("gateway payment restriction is not presented as an invalid API key", async () => {
  const error = Object.assign(
    new Error(
      "AI Gateway requires a valid credit card on file to service requests.",
    ),
    { name: "GatewayInternalServerError", statusCode: 403 },
  );
  const response = errorResponse(error);
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("Add a payment method");
});

test("actual credential rejection still reports an authentication error", async () => {
  const error = Object.assign(new Error("Invalid API key"), {
    name: "GatewayAuthenticationError",
    statusCode: 401,
  });
  expect((await errorResponse(error).json()).error).toContain(
    "rejected its credentials",
  );
});

test("oversized AI requests explain the token limit instead of returning a generic error", async () => {
  const error = Object.assign(new Error("Request too large"), {
    name: "AI_APICallError",
    statusCode: 413,
  });
  const response = errorResponse(error);
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("token allowance");
});
