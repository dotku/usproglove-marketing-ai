import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("prospects.detail");
  const tStatus = await getTranslations("prospects.statusFilter");
  const format = await getFormatter();

  const rows = await db
    .select({
      prospect: schema.prospects,
      company: schema.companies,
    })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(eq(schema.prospects.id, id))
    .limit(1);

  if (rows.length === 0) notFound();
  const { prospect, company } = rows[0];

  const [messages, eventRows] = await Promise.all([
    db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.prospectId, id))
      .orderBy(desc(schema.messages.createdAt)),
    db
      .select()
      .from(schema.events)
      .where(eq(schema.events.prospectId, id))
      .orderBy(asc(schema.events.createdAt)),
  ]);

  const meta = (prospect.metadata ?? {}) as {
    verification?: { deliverable: boolean; score: number; threshold: number };
    score?: { fit: number; reasoning: string; suggestedSkuId: string };
    draft?: { subject: string; textBody: string; htmlBody: string };
  };

  const contactName = [prospect.firstName, prospect.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <Link href="/prospects" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          ← {t("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <StatusPill status={prospect.status} label={tStatus(prospect.status)} />
          {prospect.score != null && <ScoreBadge score={prospect.score} />}
        </div>
        <div className="text-sm text-neutral-500 mt-1">
          {company.vertical} · {[company.city, company.region].filter(Boolean).join(", ")}
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title={t("company")}>
          <Row label={t("website")}>
            {company.website ? (
              <a href={company.website} target="_blank" rel="noreferrer noopener" className="underline">
                {company.website}
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label={t("location")}>{[company.city, company.region].filter(Boolean).join(", ") || "—"}</Row>
        </Card>

        <Card title={t("contact")}>
          <Row label={t("email")}>{prospect.email}</Row>
          <Row label={t("role")}>{prospect.role || "—"}</Row>
          <Row label={t("confidence")}>
            {prospect.enrichmentConfidence != null ? `${prospect.enrichmentConfidence}` : "—"}
          </Row>
          {contactName && <Row label="Name">{contactName}</Row>}
        </Card>

        {meta.verification && (
          <Card title={t("verification")}>
            <Row label={t("verificationDeliverable")}>{meta.verification.deliverable ? "✓" : "✗"}</Row>
            <Row label={t("verificationScore")}>
              {meta.verification.score} / {meta.verification.threshold}
            </Row>
          </Card>
        )}

        {meta.score && (
          <Card title={t("aiScoreTitle")}>
            <Row label="Fit">
              <ScoreBadge score={meta.score.fit} />
            </Row>
            <Row label={t("suggestedSku")}>{meta.score.suggestedSkuId}</Row>
            <div className="pt-2 text-sm text-neutral-600 dark:text-neutral-400">
              <div className="text-xs font-medium text-neutral-500 mb-1">{t("aiReasoning")}</div>
              {meta.score.reasoning}
            </div>
          </Card>
        )}
      </section>

      {meta.draft && messages.length === 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">{t("draftTitle")}</h2>
          <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4 space-y-3">
            <div>
              <div className="text-xs font-medium text-neutral-500">{t("subject")}</div>
              <div className="text-sm">{meta.draft.subject}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-neutral-500">{t("body")}</div>
              <pre className="text-sm whitespace-pre-wrap font-sans">{meta.draft.textBody}</pre>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">{t("messagesTitle")}</h2>
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            {t("messagesEmpty")}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <details
                key={m.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
              >
                <summary className="px-4 py-3 cursor-pointer flex items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <div className="min-w-0">
                    <div className="text-xs text-neutral-500 uppercase tracking-wide">
                      {m.direction} · {m.kind}
                    </div>
                    <div className="font-medium truncate">{m.subject}</div>
                  </div>
                  <div className="text-xs text-neutral-500 whitespace-nowrap">
                    {m.sentAt
                      ? format.dateTime(m.sentAt, { dateStyle: "short", timeStyle: "short" })
                      : format.dateTime(m.createdAt, { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </summary>
                <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                  <pre className="text-sm whitespace-pre-wrap font-sans">{m.bodyText}</pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t("timelineTitle")}</h2>
        {eventRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            {t("timelineEmpty")}
          </div>
        ) : (
          <ol className="relative border-l border-neutral-200 dark:border-neutral-800 ml-2 space-y-4">
            {eventRows.map((e) => (
              <li key={e.id} className="pl-4 relative">
                <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-neutral-400 dark:bg-neutral-600" />
                <div className="text-xs text-neutral-500">
                  {format.dateTime(e.createdAt, { dateStyle: "short", timeStyle: "medium" })}
                </div>
                <div className="text-sm font-medium">{e.kind}</div>
                {e.payload && Object.keys(e.payload).length > 0 && (
                  <pre className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap font-mono overflow-x-auto">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {prospect.suppressionReason && (
        <section className="rounded-lg border border-red-200 dark:border-red-900 p-4">
          <div className="text-xs font-medium text-red-700 dark:text-red-400">{t("suppressionReason")}</div>
          <div className="text-sm mt-1">{prospect.suppressionReason}</div>
        </section>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm py-1">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <span className="text-right break-all">{children}</span>
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
