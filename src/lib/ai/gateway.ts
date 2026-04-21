import { gateway } from "@ai-sdk/gateway";

export const models = {
  fast: gateway("anthropic/claude-haiku-4-5"),
  primary: gateway("anthropic/claude-sonnet-4-6"),
  reasoning: gateway("anthropic/claude-opus-4-7"),
} as const;

export type ModelKey = keyof typeof models;

export function pickModel(task: "draft" | "score" | "extract" | "research"): ModelKey {
  switch (task) {
    case "draft":
      return "primary";
    case "score":
    case "extract":
      return "fast";
    case "research":
      return "reasoning";
  }
}
