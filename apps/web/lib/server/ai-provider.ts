import "server-only";
import { createGateway } from "ai";
import { aiProviderSchema, type AiProvider } from "@mailer/core";
import { required } from "./errors";

export function selectedAiProvider(provider?: AiProvider): AiProvider {
  if (provider) return provider;
  const configured = aiProviderSchema.safeParse(process.env.AI_PROVIDER);
  if (configured.success) return configured.data;
  return !process.env.AI_PROVIDER && process.env.AI_GATEWAY_API_KEY
    ? "vercel"
    : "akash";
}
export function usesGateway(provider?: AiProvider) {
  return selectedAiProvider(provider) === "vercel";
}
export function defaultAiModel(provider?: AiProvider) {
  switch (selectedAiProvider(provider)) {
    case "vercel":
      return process.env.AI_GATEWAY_MODEL || "zai/glm-5.3";
    case "groq":
      return process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    case "together":
      return process.env.TOGETHER_MODEL || "MiniMaxAI/MiniMax-M3";
    case "openrouter":
      return process.env.OPENROUTER_MODEL || "openrouter/auto-beta";
    default:
      return process.env.AKASH_MODEL || "zai-org/GLM-5.3";
  }
}
export function providerKeyName(provider?: AiProvider) {
  switch (selectedAiProvider(provider)) {
    case "vercel":
      return "AI_GATEWAY_API_KEY";
    case "groq":
      return "GROQ_API_KEY";
    case "together":
      return "TOGETHER_API_KEY";
    case "openrouter":
      return "OPENROUTER_API_KEY";
    default:
      return "AKASH_API_KEY";
  }
}
export function gatewayClient() {
  return createGateway({ apiKey: required("AI_GATEWAY_API_KEY") });
}

export function compatibleBaseUrl(provider?: AiProvider) {
  switch (selectedAiProvider(provider)) {
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "together":
      return "https://api.together.ai/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    default:
      return "https://api.akashml.com/v1";
  }
}
