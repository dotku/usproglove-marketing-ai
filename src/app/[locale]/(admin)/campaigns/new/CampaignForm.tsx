"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createCampaign, type CreateCampaignState } from "../actions";
import { products, heroSkuByVertical, type Vertical } from "@/../content/catalog/products";

type Option = { value: string; label: string };

const VERTICAL_OPTIONS: Vertical[] = [
  "tattoo",
  "beauty",
  "restaurant",
  "medical",
  "industrial",
  "automotive",
  "agriculture",
  "janitorial",
  "cannabis",
  "veterinary",
];

const STATUS_OPTIONS = ["draft", "active", "paused"] as const;

export function CampaignForm({
  defaults,
}: {
  defaults: {
    senderEmail: string;
    senderName: string;
    replyToEmail: string;
    dailyCap: number;
    contactsPerCompany: number;
  };
}) {
  const t = useTranslations("campaigns.form");
  const tv = useTranslations("verticals");
  const ts = useTranslations("campaigns.status");

  const [state, action, pending] = useActionState<CreateCampaignState, FormData>(
    createCampaign,
    { ok: false },
  );

  const [vertical, setVertical] = useState<Vertical>("restaurant");
  const [heroSkuId, setHeroSkuId] = useState<string>(heroSkuByVertical["restaurant"]);

  const verticalOpts: Option[] = VERTICAL_OPTIONS.map((v) => ({
    value: v,
    label: safeT(tv, v, v),
  }));
  const skuOpts: Option[] = products.map((p) => ({ value: p.id, label: `${p.id} — ${p.name}` }));
  const statusOpts: Option[] = STATUS_OPTIONS.map((s) => ({ value: s, label: safeT(ts, s, s) }));

  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6 max-w-2xl">
      <Field label={t("name")} error={err.name?.[0]}>
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder={t("namePlaceholder")}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("vertical")} error={err.vertical?.[0]}>
          <select
            name="vertical"
            value={vertical}
            onChange={(e) => {
              const v = e.target.value as Vertical;
              setVertical(v);
              setHeroSkuId(heroSkuByVertical[v]);
            }}
            className={inputClass}
          >
            {verticalOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("sku")} error={err.heroSkuId?.[0]}>
          <select
            name="heroSkuId"
            value={heroSkuId}
            onChange={(e) => setHeroSkuId(e.target.value)}
            className={inputClass}
          >
            {skuOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label={t("dailyCap")} error={err.dailyCap?.[0]}>
          <input
            type="number"
            name="dailyCap"
            defaultValue={defaults.dailyCap}
            min={1}
            max={500}
            className={inputClass}
          />
        </Field>

        <Field label={t("contactsPerCompany")} error={err.contactsPerCompany?.[0]}>
          <input
            type="number"
            name="contactsPerCompany"
            defaultValue={defaults.contactsPerCompany}
            min={1}
            max={10}
            className={inputClass}
          />
        </Field>

        <Field label={t("status")} error={err.status?.[0]}>
          <select name="status" defaultValue="draft" className={inputClass}>
            {statusOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t("senderEmail")} error={err.senderEmail?.[0]}>
          <input type="email" name="senderEmail" defaultValue={defaults.senderEmail} required className={inputClass} />
        </Field>
        <Field label={t("senderName")} error={err.senderName?.[0]}>
          <input name="senderName" defaultValue={defaults.senderName} required className={inputClass} />
        </Field>
      </div>

      <Field label={t("replyToEmail")} error={err.replyToEmail?.[0]}>
        <input type="email" name="replyToEmail" defaultValue={defaults.replyToEmail} required className={inputClass} />
      </Field>

      {state.error === "forbidden" && (
        <p className="text-sm text-red-600">{t("errorForbidden")}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending ? t("saving") : t("submit")}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function safeT(
  t: (k: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const v = t(key);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}
