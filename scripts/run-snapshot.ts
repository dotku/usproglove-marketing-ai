import { runAllSnapshots } from "@/lib/usage/snapshot";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

async function main() {
  console.log("Running all snapshots...");
  const result = await runAllSnapshots();
  console.log(`Collected ${result.collected} snapshot rows.\n`);

  const latest = await db
    .select()
    .from(schema.usageSnapshots)
    .orderBy(desc(schema.usageSnapshots.createdAt))
    .limit(result.collected);

  console.log("Latest snapshots:");
  for (const row of latest) {
    const scope = row.scope ? ` [${row.scope}]` : "";
    console.log(`  ${row.kind}${scope}: ${row.value} ${row.unit}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
