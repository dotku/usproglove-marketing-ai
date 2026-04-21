import { NextResponse } from "next/server";
import { pollInbox } from "@/lib/email/reply-poller";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 30 * 60 * 1000);
  try {
    const messages = await pollInbox(since);
    return NextResponse.json({ ok: true, count: messages.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 200 });
  }
}
