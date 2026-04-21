import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { runOutboundStep } from "@/lib/workflow/outbound";
import { trackCronRun, inferTrigger } from "@/lib/cron/tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await trackCronRun("outbound", inferTrigger(request), async () => {
    const active = await db.select().from(schema.campaigns).where(eq(schema.campaigns.status, "active"));
    const runs: Array<{ campaignId: string; sent?: number; error?: string }> = [];
    let sentTotal = 0;
    let errored = 0;
    for (const campaign of active) {
      try {
        const result = await runOutboundStep({
          vertical: campaign.vertical,
          dailyCap: campaign.dailyCap,
          contactsPerCompany: campaign.contactsPerCompany,
          senderEmail: campaign.senderEmail,
          senderName: campaign.senderName,
          replyToEmail: campaign.replyToEmail,
          campaignId: campaign.id,
          icp: campaign.icp,
        });
        runs.push({ campaignId: campaign.id, sent: result.length });
        sentTotal += result.length;
      } catch (err) {
        runs.push({ campaignId: campaign.id, error: (err as Error).message });
        errored += 1;
      }
    }
    return { campaignsProcessed: active.length, sentTotal, errored, runs };
  });

  return NextResponse.json({ ok: true, ...summary });
}
