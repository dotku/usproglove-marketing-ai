"use client";

import { useState, useTransition } from "react";
import { retryCronJob } from "./actions";

export function RetryButton({ job, label, pendingLabel }: { job: string; label: string; pendingLabel: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await retryCronJob(job);
            if (!res.ok) setError(res.error ?? `HTTP ${res.status}`);
          })
        }
        className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
      >
        {pending ? pendingLabel : label}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
