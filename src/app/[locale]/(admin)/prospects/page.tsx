import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function ProspectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("prospects");

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-8">{t("title")}</h1>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-900">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("columns.company")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("columns.vertical")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("columns.contact")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("columns.score")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="text-center py-16 text-neutral-500">
                {t("empty")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
