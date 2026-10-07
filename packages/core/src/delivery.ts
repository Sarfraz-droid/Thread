export type DeliveryOutcome = {
  status: "sent" | "failed" | "unknown";
  messageId?: string;
  error?: string;
};
export class RejectedDelivery extends Error {}
export async function performDelivery(deps: {
  claim: () => Promise<string>;
  deliver: () => Promise<string>;
  finish: (attemptId: string, outcome: DeliveryOutcome) => Promise<void>;
}): Promise<DeliveryOutcome> {
  const attemptId = await deps.claim();
  let outcome: DeliveryOutcome;
  try {
    const messageId = await deps.deliver();
    if (!messageId) throw new Error("Missing message identifier");
    outcome = { status: "sent", messageId };
  } catch (error) {
    outcome =
      error instanceof RejectedDelivery
        ? { status: "failed", error: error.message }
        : {
            status: "unknown",
            error:
              "Gmail's delivery outcome is uncertain. Check Sent in Gmail before taking further action.",
          };
  }
  await deps.finish(attemptId, outcome);
  return outcome;
}
