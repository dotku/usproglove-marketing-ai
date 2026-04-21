import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import {
  getTodayTokenUsage,
  getTodaySentCount,
  getTodayReplyCount,
  getActiveCampaignCount,
  getLatestSnapshotsByKind,
  type LatestSnapshot,
} from "@/lib/usage/queries";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(2)} ${units[i]}`;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const format = await getFormatter();

  const [tokens, sentToday, repliesToday, activeCampaigns, snapshots] = await Promise.all([
    getTodayTokenUsage().catch(() => null),
    getTodaySentCount().catch(() => 0),
    getTodayReplyCount().catch(() => 0),
    getActiveCampaignCount().catch(() => 0),
    getLatestSnapshotsByKind().catch(() => ({} as Record<string, LatestSnapshot>)),
  ]);

  const dbSize = snapshots["db_total_size_bytes"]?.value ?? 0;
  const brevoDaily = snapshots["brevo_credits_remaining:email_campaigns"] ?? snapshots["brevo_credits_remaining:sendLimit"];
  const brevoCredits = snapshots["brevo_credits_remaining:sms"] ?? snapshots["brevo_credits_remaining:transactional"];
  const hunterSearches = snapshots["hunter_searches_remaining"];
  const hunterVerifications = snapshots["hunter_verifications_remaining"];
  const snovCredits = snapshots["snov_credits_remaining"];

  const campaignStats = [
    { label: t("todaySent"), value: String(sentToday) },
    { label: t("todayReplies"), value: String(repliesToday) },
    { label: t("activeCampaigns"), value: String(activeCampaigns) },
    { label: t("replyRate"), value: "—" },
  ];

  const usageStats = [
    {
      label: t("tokensToday"),
      value: tokens ? format.number(tokens.inputTokens + tokens.outputTokens) : "—",
      sub: tokens ? `in ${format.number(tokens.inputTokens)} · out ${format.number(tokens.outputTokens)}` : undefined,
    },
    { label: t("aiCostToday"), value: tokens ? formatUsd(tokens.costUsd) : "—" },
    { label: t("aiCallsToday"), value: tokens ? String(tokens.callCount) : "—" },
    { label: t("dbSize"), value: formatBytes(dbSize) },
  ];

  const quotaStats = [
    { label: t("emailQuota"), value: brevoDaily ? format.number(brevoDaily.value) : "—" },
    { label: t("emailCredits"), value: brevoCredits ? format.number(brevoCredits.value) : "—" },
    { label: t("discoveryQuota"), value: hunterSearches ? format.number(hunterSearches.value) : "—" },
    { label: t("verificationQuota"), value: hunterVerifications ? format.number(hunterVerifications.value) : "—" },
    { label: t("enrichmentCredits"), value: snovCredits ? format.number(snovCredits.value) : "—" },
  ];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {campaignStats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">{t("usageTitle")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {usageStats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">{t("quotaTitle")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {quotaStats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500 tabular-nums">{sub}</div>}
    </div>
  );
}
