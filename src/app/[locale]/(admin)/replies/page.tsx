import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function RepliesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("replies");

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-8">{t("title")}</h1>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-16 text-center text-neutral-500">
        {t("empty")}
      </div>
    </div>
  );
}
