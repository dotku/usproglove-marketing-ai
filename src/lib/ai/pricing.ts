/**
 * Estimated USD cost per 1M tokens for models we use.
 * At-cost pricing — kept in sync with upstream provider rate cards.
 * Numbers below track Anthropic public pricing as of 2026-Q1; update on change.
 */
interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
  reasoningPerMillion?: number;
}

const PRICE_TABLE: Record<string, ModelPrice> = {
  "anthropic/claude-haiku-4-5": { inputPerMillion: 1.0, outputPerMillion: 5.0, cachedInputPerMillion: 0.1 },
  "anthropic/claude-sonnet-4-6": { inputPerMillion: 3.0, outputPerMillion: 15.0, cachedInputPerMillion: 0.3 },
  "anthropic/claude-opus-4-7": { inputPerMillion: 15.0, outputPerMillion: 75.0, cachedInputPerMillion: 1.5 },
};

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
}

export function estimateCostUsd(modelId: string, usage: TokenCounts): number {
  const price = PRICE_TABLE[modelId];
  if (!price) return 0;

  const regularInput = Math.max(0, usage.inputTokens - (usage.cachedTokens ?? 0));
  const cached = usage.cachedTokens ?? 0;
  const reasoning = usage.reasoningTokens ?? 0;

  const inputCost = (regularInput / 1_000_000) * price.inputPerMillion;
  const cachedCost = (cached / 1_000_000) * (price.cachedInputPerMillion ?? price.inputPerMillion);
  const outputCost = (usage.outputTokens / 1_000_000) * price.outputPerMillion;
  const reasoningCost = (reasoning / 1_000_000) * (price.reasoningPerMillion ?? price.outputPerMillion);

  return Number((inputCost + cachedCost + outputCost + reasoningCost).toFixed(6));
}
