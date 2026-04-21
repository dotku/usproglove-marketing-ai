import { hunterProvider } from "./hunter";
import { snovProvider } from "./snov";
import type { EnrichedContact, EnrichmentProvider, EnrichmentQuery } from "../types";

export async function findContacts(query: EnrichmentQuery): Promise<EnrichedContact[]> {
  const primary = hunterProvider;
  const fallback = snovProvider;

  try {
    const primaryResults = await primary.find(query);
    if (primaryResults.length > 0) return primaryResults;
  } catch {
  }

  try {
    return await fallback.find(query);
  } catch {
    return [];
  }
}

export async function verifyEmail(email: string): Promise<{ deliverable: boolean; score: number; verifierId: string }> {
  try {
    const result = await hunterProvider.verify(email);
    return { ...result, verifierId: hunterProvider.id };
  } catch {
  }
  try {
    const result = await snovProvider.verify(email);
    return { ...result, verifierId: snovProvider.id };
  } catch {
    return { deliverable: false, score: 0, verifierId: "none" };
  }
}

export { hunterProvider, snovProvider };
export type { EnrichmentProvider };
