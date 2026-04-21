import Link from "next/link";
import { desc, eq, sql as dsql } from "drizzle-orm";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const PROSPECT_STATUSES = schema.prospectStatusEnum.enumValues;

type StatusFilter = (typeof PROSPECT_STATUSES)[number] | "all";

function isStatusFilter(v: string | undefined): v is StatusFilter {
  if (!v) return false;
  return v === "all" || (PROSPECT_STATUSES as readonly string[]).includes(v);
}

export default async function ProspectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("prospects");
  const tStatus = await getTranslations("prospects.statusFilter");
  const format = await getFormatter();

  const status: StatusFilter = isStatusFilter(sp.status) ? sp.status : "all";

  const base = db
    .select({
      id: schema.prospects.id,
      email: schema.prospects.email,
      firstName: schema.prospects.firstName,
      lastName: schema.prospects.lastName,
      role: schema.prospects.role,
      status: schema.prospects.status,
      score: schema.prospects.score,
      updatedAt: schema.prospects.updatedAt,
      companyId: schema.companies.id,
      companyName: schema.companies.name,
      vertical: schema.companies.vertical,
      city: schema.companies.city,
      region: schema.companies.region,
    })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .orderBy(desc(schema.prospects.updatedAt))
    .limit(200);

  const rows =
    status === "all" ? await base : await base.where(eq(schema.prospects.status, status));

  const counts = await db
    .select({ status: schema.prospects.status, c: dsql<number>`count(*)::int` })
    .from(schema.prospects)
    .groupBy(schema.prospects.status);
  const countsByStatus = new Map(counts.map((r) => [r.status, r.c]));
  const totalCount = counts.reduce((s, r) => s + r.c, 0);

  const tabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: tStatus("all"), count: totalCount },
    ...PROSPECT_STATUSES.map((s) => ({
      value: s as StatusFilter,
      label: tStatus(s),
      count: countsByStatus.get(s) ?? 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>

      <nav className="flex flex-wrap gap-1 text-xs overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.value === status;
          const href = tab.value === "all" ? "/prospects" : `/prospects?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 whitespace-nowrap"
                  : "rounded px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 whitespace-nowrap"
              }
            >
              {tab.label}
              <span className="ml-1.5 opacity-60 tabular-nums">{tab.count}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-sm text-neutral-500">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t("columns.company")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.vertical")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.contact")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.score")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
                return (
                  <tr
                    key={p.id}
                    className="border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <td className="px-3 py-2">
                      <Link href={`/prospects/${p.id}`} className="font-medium hover:underline">
                        {p.companyName}
                      </Link>
                      {(p.city || p.region) && (
                        <div className="text-xs text-neutral-500">
                          {[p.city, p.region].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">{p.vertical}</td>
                    <td className="px-3 py-2">
                      <div>{name || "—"}</div>
                      <div className="text-xs text-neutral-500">
                        {p.email}
                        {p.role ? ` · ${p.role}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {p.score != null ? <ScoreBadge score={p.score} /> : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={p.status} label={tStatus(p.status)} />
                    </td>
                    <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                      {format.dateTime(p.updatedAt, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : score >= 60
        ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${cls}`}>{score}</span>;
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const cls: Record<string, string> = {
    discovered: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
    enriching: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
    enriched: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    ready: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    sending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    replied: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    bounced: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    suppressed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    unsubscribed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs whitespace-nowrap ${cls[status] ?? ""}`}>
      {label}
    </span>
  );
}
