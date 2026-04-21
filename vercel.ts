/**
 * vercel.ts — typed project config (Vercel 2026 replacement for vercel.json).
 * Falls back to vercel.json if @vercel/config isn't available in the build env.
 *
 * Scheduling is handled by Upstash QStash (see scripts/setup-qstash-schedules.ts),
 * not Vercel Cron — Hobby tier only allows 2 daily crons, which is below our need.
 */
export const config = {
  framework: "nextjs" as const,
  buildCommand: "pnpm build",
  installCommand: "pnpm install",
  devCommand: "pnpm dev",
} as const;
