import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { CampaignForm } from "./CampaignForm";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("campaigns");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← {t("title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("newTitle")}</h1>
      </div>

      <CampaignForm
        defaults={{
          senderEmail: process.env.SENDER_EMAIL ?? "",
          senderName: process.env.SENDER_NAME ?? "",
          replyToEmail: process.env.SENDER_REPLY_TO ?? process.env.SENDER_EMAIL ?? "",
          dailyCap: Number(process.env.DAILY_SEND_CAP ?? 10),
          contactsPerCompany: 3,
        }}
      />
    </div>
  );
}
