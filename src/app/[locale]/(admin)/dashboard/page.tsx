import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const stats = [
    { label: t("todaySent"), value: "0" },
    { label: t("todayReplies"), value: "0" },
    { label: t("activeCampaigns"), value: "0" },
    { label: t("replyRate"), value: "—" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-8">{t("title")}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
            <div className="text-xs uppercase tracking-wide text-neutral-500">{s.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
