import { sql, and, gte, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export interface TodayTokenUsage {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
}

export async function getTodayTokenUsage(): Promise<TodayTokenUsage> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const res = await db
    .select({
      callCount: sql<string>`COUNT(*)::text`,
      inputTokens: sql<string>`COALESCE(SUM(${schema.aiUsage.inputTokens}), 0)::text`,
      outputTokens: sql<string>`COALESCE(SUM(${schema.aiUsage.outputTokens}), 0)::text`,
      cachedTokens: sql<string>`COALESCE(SUM(${schema.aiUsage.cachedTokens}), 0)::text`,
      costUsd: sql<string>`COALESCE(SUM(${schema.aiUsage.costUsd}), 0)::text`,
    })
    .from(schema.aiUsage)
    .where(gte(schema.aiUsage.createdAt, startOfDay));

  const row = res[0];
  return {
    callCount: Number(row?.callCount ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    cachedTokens: Number(row?.cachedTokens ?? 0),
    costUsd: Number(row?.costUsd ?? 0),
  };
}

export interface LatestSnapshot {
  kind: (typeof schema.usageSnapshotKindEnum.enumValues)[number];
  scope: string | null;
  value: number;
  unit: string;
  createdAt: Date;
}

export async function getLatestSnapshotsByKind(): Promise<Record<string, LatestSnapshot>> {
  const rows = await db.execute<{
    kind: LatestSnapshot["kind"];
    scope: string | null;
    value: string;
    unit: string;
    created_at: Date;
  }>(sql`
    SELECT DISTINCT ON (kind, scope) kind, scope, value::text, unit, created_at
    FROM usage_snapshots
    ORDER BY kind, scope, created_at DESC
  `);

  const result: Record<string, LatestSnapshot> = {};
  for (const row of rows.rows ?? []) {
    const key = row.scope ? `${row.kind}:${row.scope}` : row.kind;
    result[key] = {
      kind: row.kind,
      scope: row.scope,
      value: Number(row.value),
      unit: row.unit,
      createdAt: new Date(row.created_at),
    };
  }
  return result;
}

export async function getActiveCampaignCount(): Promise<number> {
  const res = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.status, "active"));
  return Number(res[0]?.count ?? 0);
}

export async function getTodaySentCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const res = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.messages)
    .where(and(eq(schema.messages.direction, "outbound"), gte(schema.messages.sentAt, startOfDay)));
  return Number(res[0]?.count ?? 0);
}

export async function getTodayReplyCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const res = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.messages)
    .where(and(eq(schema.messages.direction, "inbound"), gte(schema.messages.receivedAt, startOfDay)));
  return Number(res[0]?.count ?? 0);
}

export async function getRecentAiCalls(limit = 10) {
  return db
    .select()
    .from(schema.aiUsage)
    .orderBy(desc(schema.aiUsage.createdAt))
    .limit(limit);
}
