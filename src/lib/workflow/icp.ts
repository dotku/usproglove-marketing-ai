import { z } from "zod";

/**
 * Per-campaign Ideal Customer Profile. All fields optional — falls back to
 * vertical-level defaults when unset. Stored as jsonb on campaigns.icp.
 */
export const IcpSchema = z.object({
  description: z.string().max(2000).optional(),
  cities: z.array(z.string().min(1).max(80)).max(10).optional(),
  excludeKeywords: z.array(z.string().min(1).max(60)).max(30).optional(),
  minReviewCount: z.number().int().min(0).max(10000).optional(),
  minRating: z.number().min(0).max(5).optional(),
  preferredRoles: z.array(z.string().min(1).max(60)).max(30).optional(),
});

export type IcpConfig = z.infer<typeof IcpSchema>;

export function parseIcp(raw: unknown): IcpConfig | null {
  if (!raw) return null;
  const result = IcpSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function matchesExcludes(name: string, excludes: string[] | undefined): string | null {
  if (!excludes || excludes.length === 0) return null;
  const lower = name.toLowerCase();
  for (const kw of excludes) {
    const k = kw.toLowerCase().trim();
    if (k && lower.includes(k)) return kw;
  }
  return null;
}
