"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { refineDraftAction, saveDraftAction, sendDraftAction } from "../actions";

interface DraftEditorProps {
  prospectId: string;
  initialSubject: string;
  initialBody: string;
  from?: string;
  to?: string;
  replyTo?: string;
}

export function DraftEditor({
  prospectId,
  initialSubject,
  initialBody,
  from,
  to,
  replyTo,
}: DraftEditorProps) {
  const t = useTranslations("prospects.detail");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [subject, setSubject] = useState(initialSubject);
  const [textBody, setTextBody] = useState(initialBody);
  const [userPrompt, setUserPrompt] = useState("");
  const [pending, startTransition] = useTransition();
  const [refining, startRefineTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const showReplyTo = replyTo && from && !from.includes(replyTo);

  function onRefine(useUserPrompt: boolean) {
    setMessage(null);
    const promptArg = useUserPrompt ? userPrompt.trim() : undefined;
    if (useUserPrompt && !promptArg) {
      setMessage({ kind: "error", text: t("refinePromptEmpty") });
      return;
    }
    startRefineTransition(async () => {
      const res = await refineDraftAction({
        prospectId,
        subject,
        textBody,
        userPrompt: promptArg,
      });
      if (res.ok) {
        setSubject(res.subject);
        setTextBody(res.textBody);
        setMessage({ kind: "success", text: t("refineSuccess") });
        if (useUserPrompt) setUserPrompt("");
      } else {
        setMessage({ kind: "error", text: `${t("refineError")}: ${res.error}` });
      }
    });
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveDraftAction({ prospectId, subject, textBody });
      if (res.ok) {
        setMode("view");
        setMessage({ kind: "success", text: t("editSaved") });
      } else {
        setMessage({ kind: "error", text: `${t("editError")}: ${res.error}` });
      }
    });
  }

  function onSend() {
    const confirmed = window.confirm(t("sendConfirm"));
    if (!confirmed) return;
    setMessage(null);
    startTransition(async () => {
      const res = await sendDraftAction({ prospectId });
      if (res.ok) {
        setMessage({ kind: "success", text: t("sendSuccess") });
      } else {
        setMessage({ kind: "error", text: `${t("sendError")}: ${res.error}` });
      }
    });
  }

  function onCancel() {
    setSubject(initialSubject);
    setTextBody(initialBody);
    setMode("view");
    setMessage(null);
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 overflow-hidden">
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-sm">
        {from && <HeaderRow label={t("from")} value={from} />}
        {to && <HeaderRow label={t("to")} value={to} />}
        {showReplyTo && replyTo && <HeaderRow label={t("replyTo")} value={replyTo} />}
        <div className="px-4 py-2">
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-medium text-neutral-500 w-20 shrink-0 uppercase tracking-wide">
              {t("subject")}
            </span>
            {mode === "edit" ? (
              <input
                className="flex-1 text-sm bg-transparent border-b border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-200 py-0.5"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={80}
              />
            ) : (
              <span className="text-sm">{subject}</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-800 p-4">
        {mode === "edit" ? (
          <>
            <textarea
              className="w-full min-h-60 text-sm font-sans leading-relaxed bg-transparent border border-neutral-300 dark:border-neutral-700 rounded p-3 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-200"
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              disabled={refining}
            />
            <div className="mt-3 rounded border border-neutral-200 dark:border-neutral-800 p-3 space-y-2 bg-neutral-50 dark:bg-neutral-900">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {t("refineTitle")}
                </div>
                <button
                  type="button"
                  onClick={() => onRefine(false)}
                  disabled={refining || pending}
                  className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {refining ? t("refining") : t("refineOneClick")}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 text-sm bg-transparent border border-neutral-300 dark:border-neutral-700 rounded px-3 py-1.5 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-200"
                  placeholder={t("refinePromptPlaceholder")}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  disabled={refining}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && userPrompt.trim() && !refining) {
                      e.preventDefault();
                      onRefine(true);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => onRefine(true)}
                  disabled={refining || pending || !userPrompt.trim()}
                  className="rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {refining ? t("refining") : t("refineApply")}
                </button>
              </div>
              <div className="text-[11px] text-neutral-500 leading-snug">{t("refineHint")}</div>
            </div>
          </>
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{textBody}</pre>
        )}
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900">
        <div className="text-xs min-h-5">
          {message && (
            <span
              className={
                message.kind === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {message.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "view" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setMode("edit");
                }}
                disabled={pending}
                className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={pending}
                className="rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {pending ? t("sending") : t("sendNow")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={pending}
                className="rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {pending ? t("saving") : t("save")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2">
      <span className="text-xs font-medium text-neutral-500 w-20 shrink-0 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-mono break-all">{value}</span>
    </div>
  );
}
