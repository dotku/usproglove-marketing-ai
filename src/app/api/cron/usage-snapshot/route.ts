import { NextResponse } from "next/server";
import { runAllSnapshots } from "@/lib/usage/snapshot";
import { trackCronRun, inferTrigger } from "@/lib/cron/tracker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await trackCronRun("usage-snapshot", inferTrigger(request), async () => {
      const result = await runAllSnapshots();
      return { collected: result.collected };
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
