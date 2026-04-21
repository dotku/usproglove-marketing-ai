/**
 * Smoke-test cron endpoints by calling them directly with the Bearer secret.
 * Mirrors exactly what QStash (or Vercel Cron) would send.
 *
 * Usage:
 *   pnpm cron:test                     # hit all 4 jobs against APP_BASE_URL
 *   pnpm cron:test usage-snapshot      # hit just one job
 *   APP_BASE_URL=https://<prod-url> pnpm cron:test   # override target
 */
export {};

const JOBS = [
  "outbound",
  "reply-poll",
  "content-publish",
  "usage-snapshot",
] as const;

type Job = (typeof JOBS)[number];

const APP_BASE_URL = process.env.APP_BASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!APP_BASE_URL) throw new Error("APP_BASE_URL not set");
if (!CRON_SECRET) throw new Error("CRON_SECRET not set");

const arg = process.argv[2] as Job | undefined;
const targets: Job[] = arg ? [arg] : [...JOBS];

for (const job of targets) {
  if (!JOBS.includes(job)) {
    console.error(`unknown job: ${job} (expected one of ${JOBS.join(", ")})`);
    process.exit(1);
  }
}

async function hit(job: Job) {
  const url = `${APP_BASE_URL}/api/cron/${job}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    console.log(
      `${res.ok ? "✓" : "✗"} ${job.padEnd(18)} ${res.status}  ${ms}ms`,
    );
    console.log(`  ${JSON.stringify(body)}`);
  } catch (err) {
    const ms = Date.now() - started;
    console.log(`✗ ${job.padEnd(18)} fetch-error  ${ms}ms`);
    console.log(`  ${(err as Error).message}`);
  }
}

console.log(`→ ${APP_BASE_URL}\n`);
for (const job of targets) await hit(job);
