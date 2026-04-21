import Link from "next/link";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { getCronRunHistory, getLatestCronRunPerJob, type CronRunRow } from "@/lib/usage/queries";
import { CRON_JOBS } from "@/lib/cron/tracker";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-dynamic";

function summarize(row: CronRunRow): string {
  if (row.error) return row.error.slice(0, 120);
  if (!row.result) return "—";
  const r = row.result;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(r)) {
    if (v == null || typeof v === "object") continue;
    parts.push(`${k}: ${String(v)}`);
    if (parts.length >= 3) break;
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default async function CronPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { locale } = await params;
  const { job: jobFilter } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("cron");
  const format = await getFormatter();

  const validJob = jobFilter && (CRON_JOBS as readonly string[]).includes(jobFilter) ? jobFilter : undefined;

  const [runs, latestPerJob] = await Promise.all([
    getCronRunHistory({ job: validJob, limit: 100 }).catch(() => [] as CronRunRow[]),
    getLatestCronRunPerJob().catch(() => ({}) as Record<string, CronRunRow>),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-xs text-neutral-500">{t("description")}</p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CRON_JOBS.map((job) => {
          const run = latestPerJob[job];
          const statusClass = run
            ? run.status === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : run.status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
            : "text-neutral-500";
          return (
            <div key={job} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium">{job}</div>
                {run && <div className={`text-xs font-medium ${statusClass}`}>{t(`status.${run.status}`)}</div>}
              </div>
              <div className="text-xs text-neutral-500 tabular-nums min-h-[2.5em]">
                {run ? (
                  <>
                    <div>{format.relativeTime(run.startedAt, new Date())}</div>
                    <div>{run.durationMs != null ? `${run.durationMs}ms` : "—"}</div>
                  </>
                ) : (
                  t("never")
                )}
              </div>
              <RetryButton job={job} label={t("retry")} pendingLabel={t("retryPending")} />
            </div>
          );
        })}
      </section>

      <section>
        <div className="flex items-baseline gap-2 mb-3 flex-wrap">
          <h2 className="text-lg font-semibold">{t("historyTitle")}</h2>
          <span className="text-xs text-neutral-500">({runs.length})</span>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          <FilterChip href="/cron" active={!validJob} label={t("filterAll")} />
          {CRON_JOBS.map((job) => (
            <FilterChip key={job} href={`/cron?job=${job}`} active={validJob === job} label={job} />
          ))}
        </div>

        {runs.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-16 text-center text-neutral-500">
            {t("empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="text-left p-3">{t("col.startedAt")}</th>
                  <th className="text-left p-3">{t("col.job")}</th>
                  <th className="text-left p-3">{t("col.trigger")}</th>
                  <th className="text-left p-3">{t("col.status")}</th>
                  <th className="text-left p-3 tabular-nums">{t("col.duration")}</th>
                  <th className="text-left p-3">{t("col.summary")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="p-3 text-xs text-neutral-600 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                      {format.dateTime(r.startedAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="p-3">{r.job}</td>
                    <td className="p-3 text-xs text-neutral-500">{t(`trigger.${r.triggeredBy}`)}</td>
                    <td className="p-3">
                      <span
                        className={
                          r.status === "success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : r.status === "error"
                            ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400"
                        }
                      >
                        {t(`status.${r.status}`)}
                      </span>
                    </td>
                    <td className="p-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                      {r.durationMs != null ? `${r.durationMs}ms` : "—"}
                    </td>
                    <td className="p-3 text-xs text-neutral-600 dark:text-neutral-400 max-w-[420px] truncate" title={r.error ?? JSON.stringify(r.result)}>
                      {summarize(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs border ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
          : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
      }`}
    >
      {label}
    </Link>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cron");
  return { title: t("title") };
}
