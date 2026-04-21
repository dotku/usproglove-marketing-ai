/**
 * vercel.ts — typed project config (Vercel 2026 replacement for vercel.json).
 * Falls back to vercel.json if @vercel/config isn't available in the build env.
 */
export const config = {
  framework: "nextjs" as const,
  buildCommand: "pnpm build",
  installCommand: "pnpm install",
  devCommand: "pnpm dev",
  crons: [
    {
      path: "/api/cron/outbound",
      schedule: "0 */4 * * *",
    },
    {
      path: "/api/cron/reply-poll",
      schedule: "*/15 * * * *",
    },
    {
      path: "/api/cron/content-publish",
      schedule: "0 9 * * *",
    },
  ],
} as const;
