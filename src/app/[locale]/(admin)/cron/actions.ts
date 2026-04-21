"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkAdmin } from "@/lib/auth/admin";
import { CRON_JOBS, type CronJob } from "@/lib/cron/tracker";

export type RetryResult = {
  ok: boolean;
  error?: string;
  status?: number;
};

export async function retryCronJob(job: string): Promise<RetryResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "forbidden" };
  if (!CRON_JOBS.includes(job as CronJob)) return { ok: false, error: "invalid_job" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const base = host ? `${proto}://${host}` : process.env.APP_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${base}/api/cron/${job}?trigger=manual`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
    cache: "no-store",
  });

  revalidatePath("/cron");
  revalidatePath("/dashboard");

  return { ok: res.ok, status: res.status };
}
