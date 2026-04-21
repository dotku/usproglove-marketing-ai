import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type SnapshotKind = (typeof schema.usageSnapshotKindEnum.enumValues)[number];

interface Snapshot {
  kind: SnapshotKind;
  scope?: string;
  value: number;
  unit: string;
  metadata?: Record<string, unknown>;
}

const TRACKED_TABLES = [
  "companies",
  "prospects",
  "campaigns",
  "messages",
  "events",
  "content_pieces",
  "ai_usage",
  "usage_snapshots",
] as const;

export async function collectDbSnapshots(): Promise<Snapshot[]> {
  const snapshots: Snapshot[] = [];

  const sizeRow = await db.execute<{ size: string }>(sql`SELECT pg_database_size(current_database())::text AS size`);
  const firstRow = (sizeRow.rows ?? sizeRow)[0] as { size: string } | undefined;
  if (firstRow) {
    snapshots.push({ kind: "db_total_size_bytes", value: Number(firstRow.size), unit: "bytes" });
  }

  for (const table of TRACKED_TABLES) {
    try {
      const countRes = await db.execute<{ count: string }>(
        sql.raw(`SELECT count(*)::text AS count FROM "${table}"`),
      );
      const countRow = (countRes.rows ?? countRes)[0] as { count: string } | undefined;
      if (countRow) {
        snapshots.push({ kind: "table_row_count", scope: table, value: Number(countRow.count), unit: "rows" });
      }

      const sizeRes = await db.execute<{ size: string }>(
        sql.raw(`SELECT pg_total_relation_size('"${table}"')::text AS size`),
      );
      const sizeRow2 = (sizeRes.rows ?? sizeRes)[0] as { size: string } | undefined;
      if (sizeRow2) {
        snapshots.push({ kind: "table_size_bytes", scope: table, value: Number(sizeRow2.size), unit: "bytes" });
      }
    } catch {
    }
  }

  return snapshots;
}

export async function collectBrevoSnapshot(): Promise<Snapshot[]> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn(`Brevo snapshot: account endpoint returned ${res.status}`);
    return [];
  }
  const data = (await res.json()) as {
    plan?: Array<{ type?: string; credits?: number; creditsType?: string }>;
  };

  const snapshots: Snapshot[] = [];
  for (const p of data.plan ?? []) {
    if (!p.type || typeof p.credits !== "number") continue;

    // sendLimit = daily cap (free tier email-send quota), everything else is monthly credits.
    const isDailyCap = p.creditsType === "sendLimit";
    snapshots.push({
      kind: isDailyCap ? "brevo_daily_remaining" : "brevo_credits_remaining",
      scope: p.type,
      value: p.credits,
      unit: p.creditsType ?? "credits",
    });
  }
  return snapshots;
}

export async function collectHunterSnapshot(): Promise<Snapshot[]> {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return [];

  const res = await fetch(`https://api.hunter.io/v2/account?api_key=${key}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: {
      requests?: {
        searches?: { available?: number; used?: number };
        verifications?: { available?: number; used?: number };
      };
    };
  };

  const snapshots: Snapshot[] = [];
  const s = data.data?.requests?.searches;
  if (s?.available !== undefined && s.used !== undefined) {
    snapshots.push({
      kind: "hunter_searches_remaining",
      value: Math.max(0, s.available - s.used),
      unit: "searches",
      metadata: { available: s.available, used: s.used },
    });
  }
  const v = data.data?.requests?.verifications;
  if (v?.available !== undefined && v.used !== undefined) {
    snapshots.push({
      kind: "hunter_verifications_remaining",
      value: Math.max(0, v.available - v.used),
      unit: "verifications",
      metadata: { available: v.available, used: v.used },
    });
  }
  return snapshots;
}

export async function collectSnovSnapshot(): Promise<Snapshot[]> {
  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("Snov snapshot: credentials not set");
    return [];
  }

  const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) {
    console.warn(`Snov snapshot: oauth failed ${tokenRes.status} — ${await tokenRes.text()}`);
    return [];
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    console.warn(`Snov snapshot: oauth returned no token — ${JSON.stringify(tokenData)}`);
    return [];
  }

  const balanceRes = await fetch("https://api.snov.io/v1/get-balance", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!balanceRes.ok) {
    console.warn(`Snov snapshot: balance failed ${balanceRes.status} — ${await balanceRes.text()}`);
    return [];
  }
  const data = (await balanceRes.json()) as { balance?: string | number; data?: { balance?: string | number } };
  const rawBalance = data.balance ?? data.data?.balance ?? 0;
  const balance = typeof rawBalance === "string" ? Number(rawBalance) : rawBalance;

  return [{ kind: "snov_credits_remaining", value: balance, unit: "credits" }];
}

export async function collectAiDailyCost(): Promise<Snapshot[]> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const res = await db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(cost_usd), 0)::text AS total FROM ai_usage WHERE created_at >= ${startOfDay}`,
  );
  const firstRow = (res.rows ?? res)[0] as { total: string } | undefined;
  return [{ kind: "ai_daily_cost_usd", value: Number(firstRow?.total ?? 0), unit: "usd" }];
}

export async function persistSnapshots(snapshots: Snapshot[]) {
  if (snapshots.length === 0) return;
  await db.insert(schema.usageSnapshots).values(
    snapshots.map((s) => ({
      kind: s.kind,
      scope: s.scope,
      value: String(s.value),
      unit: s.unit,
      metadata: s.metadata,
    })),
  );
}

export async function runAllSnapshots() {
  const all: Snapshot[] = [];
  const sectionNames = ["db", "brevo", "hunter", "snov", "ai-cost"] as const;
  const sections = await Promise.allSettled([
    collectDbSnapshots(),
    collectBrevoSnapshot(),
    collectHunterSnapshot(),
    collectSnovSnapshot(),
    collectAiDailyCost(),
  ]);
  const errors: Array<{ section: string; error: string }> = [];
  sections.forEach((section, i) => {
    if (section.status === "fulfilled") {
      all.push(...section.value);
    } else {
      errors.push({ section: sectionNames[i], error: String(section.reason) });
    }
  });
  await persistSnapshots(all);
  return { collected: all.length, errors };
}
