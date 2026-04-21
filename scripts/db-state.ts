import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const sql = neon(url);

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("Tables:", tables.map((r) => r.table_name).join(", "));

  const types = await sql`
    SELECT typname FROM pg_type
    WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
      AND typcategory = 'E'
    ORDER BY typname
  `;
  console.log("Enums:", types.map((r) => r.typname).join(", "));

  // Check migrator tracker
  try {
    const tracker = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`;
    console.log(`Drizzle tracker rows: ${tracker.length}`);
    tracker.forEach((r: any) => console.log(`  - ${r.hash} @ ${new Date(Number(r.created_at)).toISOString()}`));
  } catch {
    console.log("Drizzle tracker table missing — schema applied outside migrator");
  }

  // Row counts for critical tables
  const counts = await sql`
    SELECT 'companies' AS t, count(*)::int AS c FROM companies
    UNION ALL SELECT 'prospects', count(*)::int FROM prospects
    UNION ALL SELECT 'campaigns', count(*)::int FROM campaigns
    UNION ALL SELECT 'messages', count(*)::int FROM messages
    UNION ALL SELECT 'ai_usage', count(*)::int FROM ai_usage
    UNION ALL SELECT 'usage_snapshots', count(*)::int FROM usage_snapshots
  `;
  console.log("\nRow counts:");
  counts.forEach((r) => console.log(`  ${r.t.padEnd(20)} ${r.c}`));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
