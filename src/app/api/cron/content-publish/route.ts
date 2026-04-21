import { NextResponse } from "next/server";
import { trackCronRun, inferTrigger } from "@/lib/cron/tracker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await trackCronRun("content-publish", inferTrigger(request), async () => {
    // TODO: publish any scheduled content_pieces whose publishedAt <= now
    return { published: 0 };
  });
  return NextResponse.json({ ok: true, ...summary });
}
