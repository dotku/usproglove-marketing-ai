import { desc } from "drizzle-orm";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { db, schema } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { parseIcp } from "@/lib/workflow/icp";
import { RunButtons } from "./_components/RunButtons";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("campaigns");
  const format = await getFormatter();

  const rows = await db
    .select()
    .from(schema.campaigns)
    .orderBy(desc(schema.campaigns.createdAt));

  const statusClass: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    draft: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
    paused: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    archived: "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link
          href="/campaigns/new"
          className="rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2 text-sm"
        >
          {t("newButton")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-sm text-neutral-500">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t("columns.name")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.vertical")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.sku")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.dailyCap")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.contactsPerCompany")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.createdAt")}</th>
                <th className="px-3 py-2 font-medium text-right">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const icp = parseIcp(c.icp);
                const icpConfigured = !!(
                  icp &&
                  (icp.description ||
                    icp.cities?.length ||
                    icp.excludeKeywords?.length ||
                    icp.preferredRoles?.length ||
                    icp.minReviewCount != null ||
                    icp.minRating != null)
                );
                return (
                  <tr key={c.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <IcpBadge
                          configured={icpConfigured}
                          setLabel={t("icp.configured")}
                          defaultLabel={t("icp.default")}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-500">{c.vertical}</td>
                    <td className="px-3 py-2 text-neutral-500 tabular-nums">{c.heroSkuId}</td>
                    <td className="px-3 py-2 tabular-nums">{c.dailyCap}</td>
                    <td className="px-3 py-2 tabular-nums">{c.contactsPerCompany}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs ${statusClass[c.status] ?? ""}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                      {format.dateTime(c.createdAt, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Link
                          href={`/campaigns/${c.id}/edit`}
                          className="rounded border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900 whitespace-nowrap"
                        >
                          ✎ {t("edit")}
                        </Link>
                        <RunButtons campaignId={c.id} />
                      </div>
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

function IcpBadge({
  configured,
  setLabel,
  defaultLabel,
}: {
  configured: boolean;
  setLabel: string;
  defaultLabel: string;
}) {
  const cls = configured
    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
    : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      ICP · {configured ? setLabel : defaultLabel}
    </span>
  );
}
