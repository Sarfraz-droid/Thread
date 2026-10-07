import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new HttpError(
      503,
      `Configure ${name} in your deployment environment first.`,
    );
  return value;
}
export function check<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): T {
  if (result.error !== null) {
    if (
      result.error.code === "PGRST204" &&
      /cc_emails|bcc_emails/.test(result.error.message)
    )
      throw new HttpError(
        503,
        "Apply the multiple_recipients Supabase migration to enable To, Cc and Bcc.",
      );
    if (result.error.code === "55P03")
      throw new HttpError(
        409,
        "This opportunity is being updated or sent. Wait for it to finish before deleting.",
      );
    if (result.error.code === "P0001")
      throw new HttpError(409, result.error.message);
    if (result.error.code === "PGRST116")
      throw new HttpError(404, "This item was not found.");
    throw new HttpError(
      500,
      "The database operation failed. Check the Supabase migrations and service configuration.",
    );
  }
  return result.data;
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "TimeoutError")
    return Response.json(
      {
        error:
          "The provider timed out before this request could finish. Retry, or choose a faster model in Settings.",
      },
      { status: 504 },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map(
            (issue) => `${issue.path.join(".") || "Input"}: ${issue.message}`,
          )
          .join(" "),
      },
      { status: 400 },
    );
  const providerStatus =
    error && typeof error === "object" && "statusCode" in error
      ? Number(error.statusCode)
      : 0;
  if (
    providerStatus === 403 &&
    error instanceof Error &&
    error.name.startsWith("Gateway") &&
    /valid credit card on file/i.test(error.message)
  )
    return Response.json(
      {
        error:
          "Vercel AI Gateway requires a valid credit card on file. Add a payment method in your Vercel AI Gateway dashboard to unlock credits.",
      },
      { status: 503 },
    );
  if (providerStatus === 413)
    return Response.json(
      {
        error:
          "The AI request exceeds your provider’s token allowance. Try a model with a higher limit or increase your provider quota.",
      },
      { status: 503 },
    );
  if (providerStatus === 402)
    return Response.json(
      {
        error:
          "Your AI credits have run out. Top up your AI provider and try again.",
      },
      { status: 503 },
    );
  if (providerStatus === 429)
    return Response.json(
      { error: "The provider is rate limited. Wait a moment and try again." },
      { status: 429 },
    );
  if (providerStatus === 401 || providerStatus === 403)
    return Response.json(
      {
        error:
          "The provider rejected its credentials. Check the API key in your environment.",
      },
      { status: 503 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error:
        "This request could not finish. Try again, or check your provider configuration.",
    },
    { status: 500 },
  );
}

export function must<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  const data = check(result);
  if (data === null || data === undefined)
    throw new HttpError(404, "This item was not found.");
  return data;
}
