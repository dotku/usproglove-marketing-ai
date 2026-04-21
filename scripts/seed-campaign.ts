import { db, schema } from "@/lib/db";

async function main() {
  const vertical = (process.argv[2] as typeof schema.verticalEnum.enumValues[number]) ?? "tattoo";
  const dailyCap = Number(process.argv[3] ?? process.env.DAILY_SEND_CAP ?? 5);
  const heroSkuByVertical: Record<string, string> = {
    tattoo: "5.0-black",
    beauty: "3.0",
    restaurant: "3.5-ice-blue",
  };

  const senderEmail = process.env.SENDER_EMAIL ?? "jay.lin@usproglove.us";
  const senderName = process.env.SENDER_NAME ?? "Jay Lin";
  const replyToEmail = process.env.SENDER_REPLY_TO ?? senderEmail;

  const [row] = await db
    .insert(schema.campaigns)
    .values({
      name: `${vertical} starter`,
      vertical,
      heroSkuId: heroSkuByVertical[vertical] ?? "3.5-black",
      status: "draft",
      dailyCap,
      promptTemplate: `content/prompts/${vertical}/first-touch.md`,
      senderEmail,
      senderName,
      replyToEmail,
    })
    .returning();

  console.log(`Seeded campaign: ${row.id} (${row.name})`);
  console.log(`To activate: UPDATE campaigns SET status='active' WHERE id='${row.id}';`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
