import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  const links: Array<[string, string]> = [
    ["/dashboard", t("dashboard")],
    ["/prospects", t("prospects")],
    ["/replies", t("replies")],
    ["/content", t("content")],
  ];

  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <aside className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
        <nav className="flex sm:flex-col gap-1 overflow-x-auto">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900 whitespace-nowrap"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 sm:p-10">{children}</main>
    </div>
  );
}
