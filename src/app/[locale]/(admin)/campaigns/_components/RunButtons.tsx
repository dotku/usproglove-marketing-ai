"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Mode = "discover" | "preview" | "send";

type LogEntry = { id: number; kind: string; data: Record<string, unknown>; ts: number };

type RunSummary = {
  sent: number;
  preview: number;
  discovered: number;
  skipped: number;
  failed: number;
  total: number;
};

const DISCOVER_DEFAULT_LIMIT = 25;
const MAX_LOG_ENTRIES = 2000;
const STORAGE_PREFIX = "uspg_runlog:";

export function RunButtons({ campaignId }: { campaignId: string }) {
  const t = useTranslations("campaigns.run");
  const router = useRouter();
  const [pending, setPending] = useState<Mode | null>(null);
  const [, startTransition] = useTransition();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<{ mode: Mode; summary: RunSummary } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const counterRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const storageKey = `${STORAGE_PREFIX}${campaignId}`;

  // restore persisted log on mount (legit external-store read, not render-derived state)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as LogEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLog(parsed);
          counterRef.current = parsed[parsed.length - 1].id;
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // persist log on change (debounce-free; writes are small)
  useEffect(() => {
    try {
      if (log.length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(log));
    } catch {
      // ignore quota errors
    }
  }, [log, storageKey]);

  function pushLog(kind: string, data: Record<string, unknown>) {
    setLog((prev) => {
      const next = [...prev, { id: ++counterRef.current, kind, data, ts: Date.now() }];
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
  }

  async function trigger(mode: Mode) {
    if (pending) return;

    if (mode === "send" && !confirm(t("confirmLive"))) return;

    let qs = `?mode=${mode}`;
    if (mode === "discover") {
      const raw = prompt(t("discoverPrompt"), String(DISCOVER_DEFAULT_LIMIT));
      if (raw == null) return;
      const n = Math.max(1, Math.min(500, Number(raw) || DISCOVER_DEFAULT_LIMIT));
      qs += `&limit=${n}`;
    }

    setPending(mode);
    setError(null);
    setSummary(null);
    setExpanded(true);
    pushLog("__separator", {
      mode,
      startedAt: new Date().toISOString(),
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/run${qs}`, {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setError(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!frame.trim() || frame.startsWith(":")) continue;

          let eventName = "message";
          let dataStr = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          let parsed: Record<string, unknown> = {};
          try {
            parsed = dataStr ? JSON.parse(dataStr) : {};
          } catch {
            parsed = { raw: dataStr };
          }

          if (eventName === "run.complete") {
            setSummary({ mode: (parsed.mode as Mode) ?? mode, summary: parsed.summary as RunSummary });
            pushLog(eventName, parsed);
          } else if (eventName === "run.error") {
            setError(String(parsed.message ?? "unknown_error"));
            pushLog(eventName, parsed);
          } else {
            pushLog(eventName, parsed);
          }
        }
      }

      startTransition(() => router.refresh());
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setPending(null);
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function clearLog() {
    if (!confirm(t("clearConfirm"))) return;
    setLog([]);
    counterRef.current = 0;
    setSummary(null);
    setError(null);
  }

  function downloadLog() {
    const payload = {
      campaignId,
      exportedAt: new Date().toISOString(),
      entries: log.map((e) => ({
        ts: new Date(e.ts).toISOString(),
        kind: e.kind,
        data: e.data,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runlog-${campaignId.slice(0, 8)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col items-end gap-2 min-w-0">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!!pending}
          onClick={() => trigger("discover")}
          className="rounded border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
          title={t("discoverHint")}
        >
          {pending === "discover" ? t("running") : t("discover")}
        </button>
        <button
          type="button"
          disabled={!!pending}
          onClick={() => trigger("preview")}
          className="rounded border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
        >
          {pending === "preview" ? t("running") : t("preview")}
        </button>
        <button
          type="button"
          disabled={!!pending}
          onClick={() => trigger("send")}
          className="rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-2.5 py-1 text-xs disabled:opacity-50"
        >
          {pending === "send" ? t("running") : t("runOnce")}
        </button>
        {pending && (
          <button
            type="button"
            onClick={cancel}
            className="rounded border border-red-300 dark:border-red-800 px-2.5 py-1 text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          >
            {t("cancel")}
          </button>
        )}
      </div>

      {(log.length > 0 || summary || error) && (
        <div className="w-full max-w-[420px] text-left space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              {expanded ? "▾" : "▸"} {t("logTitle", { n: log.length })}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadLog}
                disabled={log.length === 0}
                className="hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-40"
              >
                {t("download")}
              </button>
              <button
                type="button"
                onClick={clearLog}
                disabled={log.length === 0 || !!pending}
                className="hover:text-red-600 disabled:opacity-40"
              >
                {t("clear")}
              </button>
            </div>
          </div>

          {expanded && log.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-2 text-xs font-mono space-y-0.5">
              {log.map((e) => (
                <LogLine key={e.id} entry={e} />
              ))}
            </div>
          )}

          {summary && (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 tabular-nums">
              {summary.mode === "discover"
                ? t("discoveredResult", { n: summary.summary.discovered })
                : summary.mode === "preview"
                  ? t("previewResult", { n: summary.summary.preview })
                  : t("sentResult", { n: summary.summary.sent })}
              {summary.summary.skipped > 0 && ` · ${t("skipped", { n: summary.summary.skipped })}`}
              {summary.summary.failed > 0 && ` · ${t("failed", { n: summary.summary.failed })}`}
            </div>
          )}
          {error && <div className="text-xs text-red-600 break-all">{error}</div>}
        </div>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const { kind, data, ts } = entry;
  const time = new Date(ts).toLocaleTimeString([], { hour12: false });

  if (kind === "__separator") {
    return (
      <div className="mt-2 mb-1 flex items-center gap-2 text-neutral-400">
        <span className="flex-1 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
        <span className="text-[10px] uppercase tracking-wide">
          {time} · {String(data.mode ?? "")}
        </span>
        <span className="flex-1 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
      </div>
    );
  }

  const label = describe(kind, data);
  const color = colorFor(kind);
  return (
    <div className="flex items-start gap-2">
      <span className="text-neutral-400 shrink-0 tabular-nums">{time}</span>
      <span className={`shrink-0 ${color}`}>●</span>
      <span className="truncate">
        <span className="text-neutral-500">{kind}</span>
        {label && <span className="ml-2">{label}</span>}
      </span>
    </div>
  );
}

function describe(kind: string, data: Record<string, unknown>): string {
  const company = data.companyName || data.name;
  const email = data.email;
  const fit = data.fit;
  const score = data.score;
  const reason = data.reason;
  const subject = data.subject;

  if (kind === "run.started") return `mode=${data.mode} cap=${data.dailyCap}`;
  if (kind === "run.search") return `${data.source} · ${data.vertical}`;
  if (kind === "run.complete") return `done`;
  if (kind === "run.error") return String(data.message ?? "");
  if (kind === "company.discovered") return `${company}`;
  if (kind === "company.skipped") return `${company ?? ""} — ${reason}`;
  if (kind === "contact.skipped") return `${email} — ${reason}`;
  if (kind === "prospect.enriched") return `${company} · ${email}`;
  if (kind === "prospect.verified") return `${email} · score ${score}`;
  if (kind === "prospect.verify_failed") return `${email} · score ${score} < ${data.threshold}`;
  if (kind === "prospect.scored") return `${email} · fit ${fit}`;
  if (kind === "prospect.skipped") return `${email} — ${reason} (${fit}/${data.threshold})`;
  if (kind === "message.drafted") return `${email} · "${subject}"`;
  if (kind === "message.sent") return `${email} ✓`;
  if (kind === "message.failed") return `${email} — ${data.error}`;
  return "";
}

function colorFor(kind: string): string {
  if (kind.endsWith(".failed") || kind.endsWith(".verify_failed") || kind === "run.error") return "text-red-500";
  if (kind.endsWith(".skipped")) return "text-neutral-400";
  if (kind === "message.sent" || kind === "run.complete") return "text-emerald-500";
  if (kind === "prospect.verified" || kind === "prospect.scored") return "text-sky-500";
  if (kind === "message.drafted") return "text-indigo-500";
  if (kind === "company.discovered") return "text-neutral-500";
  return "text-neutral-400";
}
