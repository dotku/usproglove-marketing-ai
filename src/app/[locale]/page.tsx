import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 flex-1">
      <section className="mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">{t("brand.name")}</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">
          {t("brand.tagline")}
        </p>
      </section>

      <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminCard href="/dashboard" label={t("nav.dashboard")} />
        <AdminCard href="/campaigns" label={t("nav.campaigns")} />
        <AdminCard href="/prospects" label={t("nav.prospects")} />
        <AdminCard href="/replies" label={t("nav.replies")} />
        <AdminCard href="/content" label={t("nav.content")} />
      </nav>
    </main>
  );
}

function AdminCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 hover:border-neutral-400 dark:hover:border-neutral-600 transition"
    >
      <div className="text-sm font-medium">{label}</div>
    </Link>
  );
}
