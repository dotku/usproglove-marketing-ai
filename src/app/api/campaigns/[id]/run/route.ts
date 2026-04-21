import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { checkAdmin } from "@/lib/auth/admin";
import {
  runOutboundStep,
  type OutboundMode,
  type ProgressEvent,
} from "@/lib/workflow/outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_MODES: OutboundMode[] = ["discover", "preview", "send"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await checkAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);

  const modeParam = url.searchParams.get("mode");
  const dryRunLegacy = url.searchParams.get("dryRun") === "1";
  const mode: OutboundMode = VALID_MODES.includes(modeParam as OutboundMode)
    ? (modeParam as OutboundMode)
    : dryRunLegacy
      ? "preview"
      : "send";

  const limitParam = url.searchParams.get("limit");
  const limitOverride = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : null;

  const rows = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const campaign = rows[0];

  const wantsJson = request.headers.get("accept")?.includes("application/json")
    && !request.headers.get("accept")?.includes("text/event-stream");

  const runArgs = {
    vertical: campaign.vertical,
    dailyCap: limitOverride ?? campaign.dailyCap,
    contactsPerCompany: campaign.contactsPerCompany,
    senderEmail: campaign.senderEmail,
    senderName: campaign.senderName,
    replyToEmail: campaign.replyToEmail,
    campaignId: campaign.id,
    icp: campaign.icp,
    mode,
  };

  if (wantsJson) {
    try {
      const results = await runOutboundStep(runArgs);
      const summary = buildSummary(results);
      return NextResponse.json({ ok: true, mode, summary, results });
    } catch (err) {
      return errorJson(err, { campaignId: id, mode });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (evt: ProgressEvent) => {
        if (closed) return;
        try {
          const { kind, ...rest } = evt;
          const frame = `event: ${kind}\ndata: ${JSON.stringify(rest)}\n\n`;
          controller.enqueue(encoder.encode(frame));
        } catch {
          // ignore write errors
        }
      };

      // heartbeat every 15s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // ignore
        }
      }, 15000);

      try {
        const results = await runOutboundStep({
          ...runArgs,
          onEvent: write,
        });
        const summary = buildSummary(results);
        write({ kind: "run.complete", mode, summary, total: results.length });
      } catch (err) {
        const cause = (err as { cause?: unknown }).cause;
        console.error("[campaign/run] stream failed", { campaignId: id, mode, err, cause });
        write({
          kind: "run.error",
          message: (err as Error).message,
          cause: cause instanceof Error ? cause.message : String(cause ?? ""),
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        controller.close();
      }
    },
    cancel() {
      // client disconnected — nothing special to clean up; the generator
      // will run to completion on the server (Brevo sends have already been
      // committed per-iteration)
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function buildSummary(results: Awaited<ReturnType<typeof runOutboundStep>>) {
  return {
    sent: results.filter((r) => r.status === "sent").length,
    preview: results.filter((r) => r.status === "preview").length,
    discovered: results.filter((r) => r.status === "discovered").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    total: results.length,
  };
}

function errorJson(err: unknown, ctx: Record<string, unknown>) {
  const cause = (err as { cause?: unknown }).cause;
  console.error("[campaign/run] failed", { ...ctx, err, cause });
  return NextResponse.json(
    {
      ok: false,
      error: (err as Error).message,
      cause: cause instanceof Error ? { message: cause.message, stack: cause.stack } : cause,
      stack: (err as Error).stack,
    },
    { status: 500 },
  );
}
