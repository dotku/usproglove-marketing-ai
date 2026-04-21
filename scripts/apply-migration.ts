/**
 * Apply a single Drizzle-generated SQL migration to the configured DATABASE_URL.
 * Used when `pnpm db:push` can't be run interactively.
 *
 * Usage: pnpm tsx --env-file=.env.local scripts/apply-migration.ts <filename>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: apply-migration.ts <sql-filename>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

  const path = resolve(process.cwd(), "drizzle", file);
  const sql = readFileSync(path, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = neon(process.env.DATABASE_URL);

  for (const stmt of statements) {
    console.log(`▸ ${stmt.split("\n")[0].slice(0, 100)}...`);
    await client.query(stmt);
  }
  console.log(`\n✓ applied ${statements.length} statements from ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
