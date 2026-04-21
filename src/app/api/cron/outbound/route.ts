import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { runOutboundStep } from "@/lib/workflow/outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const active = await db.select().from(schema.campaigns).where(eq(schema.campaigns.status, "active"));

  const runs = [];
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
    } catch (err) {
      runs.push({ campaignId: campaign.id, error: (err as Error).message });
    }
  }

  return NextResponse.json({ ok: true, runs });
}
