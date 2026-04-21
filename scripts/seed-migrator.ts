import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

/**
 * Bootstrap the drizzle migrator tracker when schema was applied out-of-band.
 * Safe to re-run — uses UPSERT semantics on hash.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const journal = JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8")) as {
    entries: Array<{ idx: number; when: number; tag: string }>;
  };

  const existing = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const existingHashes = new Set((existing as Array<{ hash: string }>).map((r) => r.hash));

  for (const entry of journal.entries) {
    const files = readdirSync("./drizzle").filter((f) => f.startsWith(entry.tag) && f.endsWith(".sql"));
    if (files.length === 0) {
      console.warn(`No SQL file found for ${entry.tag}`);
      continue;
    }
    const content = readFileSync(join("./drizzle", files[0]), "utf8");
    const hash = createHash("sha256").update(content).digest("hex");

    if (existingHashes.has(hash)) {
      console.log(`✓ ${entry.tag} already tracked`);
      continue;
    }

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`+ ${entry.tag} seeded (hash ${hash.slice(0, 12)}...)`);
  }

  console.log("Migrator tracker seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
