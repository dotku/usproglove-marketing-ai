import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { track } from "@vercel/analytics/server";
import type { z } from "zod";
import { db, schema } from "@/lib/db";
import { estimateCostUsd } from "./pricing";
import { models, type ModelKey } from "./gateway";

type Task = "score" | "draft" | "research" | "extract";

const modelIdByKey: Record<ModelKey, string> = {
  fast: "anthropic/claude-haiku-4-5",
  primary: "anthropic/claude-sonnet-4-6",
  reasoning: "anthropic/claude-opus-4-7",
};

export interface TrackedGenerateArgs<T extends z.ZodType> {
  task: Task;
  modelKey: ModelKey;
  schema: T;
  prompt: string;
  campaignId?: string;
  prospectId?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

export async function trackedGenerateObject<T extends z.ZodType>(args: TrackedGenerateArgs<T>) {
  const model: LanguageModel = models[args.modelKey];
  const modelId = modelIdByKey[args.modelKey];
  const start = Date.now();

  try {
    const result = await generateObject({ model, schema: args.schema, prompt: args.prompt });
    const durationMs = Date.now() - start;

    const usage = {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      reasoningTokens: result.usage?.reasoningTokens ?? 0,
      cachedTokens: result.usage?.cachedInputTokens ?? 0,
    };
    const costUsd = estimateCostUsd(modelId, usage);

    await persistUsage({ ...args, modelId, usage, costUsd, durationMs });
    emitAnalytics({ ...args, modelId, usage, costUsd, durationMs, errored: false });

    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await persistUsage({
      ...args,
      modelId,
      usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0 },
      costUsd: 0,
      durationMs,
      errored: true,
      errorMessage,
    });
    emitAnalytics({ ...args, modelId, durationMs, errored: true });
    throw err;
  }
}

interface PersistArgs {
  task: Task;
  modelId: string;
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number; cachedTokens: number };
  costUsd: number;
  durationMs: number;
  campaignId?: string;
  prospectId?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
  errored?: boolean;
  errorMessage?: string;
}

async function persistUsage(args: PersistArgs) {
  try {
    await db.insert(schema.aiUsage).values({
      task: args.task,
      modelId: args.modelId,
      inputTokens: args.usage.inputTokens,
      outputTokens: args.usage.outputTokens,
      reasoningTokens: args.usage.reasoningTokens,
      cachedTokens: args.usage.cachedTokens,
      costUsd: String(args.costUsd),
      durationMs: args.durationMs,
      campaignId: args.campaignId,
      prospectId: args.prospectId,
      messageId: args.messageId,
      errored: args.errored ?? false,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
    });
  } catch {
  }
}

function emitAnalytics(args: {
  task: Task;
  modelId: string;
  usage?: { inputTokens: number; outputTokens: number };
  costUsd?: number;
  durationMs: number;
  campaignId?: string;
  errored: boolean;
}) {
  try {
    track("ai_call", {
      task: args.task,
      modelId: args.modelId,
      inputTokens: args.usage?.inputTokens ?? 0,
      outputTokens: args.usage?.outputTokens ?? 0,
      costUsd: args.costUsd ?? 0,
      durationMs: args.durationMs,
      campaignId: args.campaignId ?? "none",
      errored: args.errored,
    });
  } catch {
  }
}

export async function trackEmailSent(args: {
  campaignId: string;
  prospectId: string;
  vertical: string;
  messageId: string;
}) {
  try {
    track("email_sent", {
      campaignId: args.campaignId,
      prospectId: args.prospectId,
      vertical: args.vertical,
      messageId: args.messageId,
    });
  } catch {
  }
}

export async function trackReplyReceived(args: {
  campaignId?: string;
  prospectId: string;
  sentiment: "positive" | "negative" | "neutral" | "unknown";
}) {
  try {
    track("reply_received", {
      campaignId: args.campaignId ?? "none",
      prospectId: args.prospectId,
      sentiment: args.sentiment,
    });
  } catch {
  }
}
