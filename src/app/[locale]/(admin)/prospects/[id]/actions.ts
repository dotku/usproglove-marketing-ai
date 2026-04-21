"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { checkAdmin } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email/brevo";
import { trackedGenerateObject, trackEmailSent } from "@/lib/ai/track";

type ActionResult = { ok: true } | { ok: false; error: string };

type RefineResult =
  | { ok: true; subject: string; textBody: string }
  | { ok: false; error: string };

const RefineSchema = z.object({
  subject: z.string().min(6).max(80),
  textBody: z.string().min(40).max(2000),
});

function textToSimpleHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1">$1</a>',
  );
  const paragraphs = linked.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("\n");
}

interface DraftMetadata {
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  from?: string;
  to?: string;
  replyTo?: string;
  signatureText?: string;
  signatureHtml?: string;
}

export async function refineDraftAction(args: {
  prospectId: string;
  subject: string;
  textBody: string;
  userPrompt?: string;
}): Promise<RefineResult> {
  const auth = await checkAdmin();
  if (!auth.ok) return { ok: false, error: "unauthorized" };

  const rows = await db
    .select({ prospect: schema.prospects, company: schema.companies })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(eq(schema.prospects.id, args.prospectId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "not_found" };

  const { prospect, company } = rows[0];
  const userPrompt = args.userPrompt?.trim();
  const prompt = buildRefinePrompt({
    currentSubject: args.subject,
    currentBody: args.textBody,
    companyName: company.name,
    vertical: company.vertical,
    contactName: prospect.firstName ?? undefined,
    userInstruction: userPrompt,
  });

  try {
    const result = await trackedGenerateObject({
      task: "draft",
      modelKey: "primary",
      schema: RefineSchema,
      prompt,
      prospectId: args.prospectId,
      metadata: { refine: true, editedBy: auth.email, userPrompt: userPrompt ?? null },
    });
    return { ok: true, subject: result.object.subject, textBody: result.object.textBody };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function buildRefinePrompt(args: {
  currentSubject: string;
  currentBody: string;
  companyName: string;
  vertical: string;
  contactName?: string;
  userInstruction?: string;
}): string {
  const defaultInstruction =
    "Improve clarity and specificity. Tighten length. Keep the opener personal and tied to the recipient's work. Keep the CTA soft. No emojis, no 'Dear', no 'Hope this finds you well'.";
  const instruction = args.userInstruction || defaultInstruction;

  return `You are refining a B2B cold outreach email for a disposable nitrile glove brand.

Recipient company: ${args.companyName}
Vertical: ${args.vertical}
Contact first name: ${args.contactName ?? "unknown"}

Current subject:
${args.currentSubject}

Current body (plain text, may include a signature block at the bottom — preserve signature verbatim):
${args.currentBody}

Edit instruction from user:
${instruction}

Rules:
- Return the full improved subject (≤ 55 chars ideal, ≤ 80 max)
- Return the full improved plain-text body, including the signature block unchanged at the bottom
- Keep it under 1200 chars total
- Do not invent facts about the recipient's business
- Do not add marketing adjectives (best, amazing, revolutionary)`;
}

export async function saveDraftAction(args: {
  prospectId: string;
  subject: string;
  textBody: string;
}): Promise<ActionResult> {
  const auth = await checkAdmin();
  if (!auth.ok) return { ok: false, error: "unauthorized" };

  const subject = args.subject.trim();
  const textBody = args.textBody.trim();
  if (subject.length < 3) return { ok: false, error: "subject_too_short" };
  if (textBody.length < 20) return { ok: false, error: "body_too_short" };

  const [row] = await db
    .select({ metadata: schema.prospects.metadata, status: schema.prospects.status })
    .from(schema.prospects)
    .where(eq(schema.prospects.id, args.prospectId))
    .limit(1);
  if (!row) return { ok: false, error: "not_found" };

  const meta = (row.metadata ?? {}) as { draft?: DraftMetadata };
  const existingDraft = meta.draft ?? {};

  const htmlBody = textToSimpleHtml(textBody);

  const nextMeta = {
    ...meta,
    draft: {
      ...existingDraft,
      subject,
      textBody,
      htmlBody,
    },
  };

  await db
    .update(schema.prospects)
    .set({ metadata: nextMeta, updatedAt: new Date() })
    .where(eq(schema.prospects.id, args.prospectId));

  await db.insert(schema.events).values({
    prospectId: args.prospectId,
    kind: "draft.edited",
    payload: { editedBy: auth.email, subject },
  });

  revalidatePath(`/[locale]/prospects/${args.prospectId}`, "page");
  return { ok: true };
}

export async function sendDraftAction(args: { prospectId: string }): Promise<ActionResult> {
  const auth = await checkAdmin();
  if (!auth.ok) return { ok: false, error: "unauthorized" };

  const rows = await db
    .select({ prospect: schema.prospects, company: schema.companies })
    .from(schema.prospects)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.prospects.companyId))
    .where(eq(schema.prospects.id, args.prospectId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "not_found" };

  const { prospect } = rows[0];
  if (prospect.status === "sent") return { ok: false, error: "already_sent" };
  if (prospect.status === "suppressed" || prospect.status === "unsubscribed") {
    return { ok: false, error: "prospect_suppressed" };
  }

  const meta = (prospect.metadata ?? {}) as { draft?: DraftMetadata };
  const draft = meta.draft;
  if (!draft?.subject || !draft.textBody) return { ok: false, error: "no_draft" };

  // Daily cap check
  const dailyCap = Number(process.env.DAILY_SEND_CAP ?? 10);
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sentTodayRes = await db
    .select({ count: sql<string>`COUNT(*)::text` })
    .from(schema.messages)
    .where(and(eq(schema.messages.direction, "outbound"), gte(schema.messages.sentAt, startOfDay)));
  const sentToday = Number(sentTodayRes[0]?.count ?? 0);
  if (sentToday >= dailyCap) return { ok: false, error: "daily_cap_reached" };

  const senderEmail = process.env.SENDER_EMAIL;
  if (!senderEmail) return { ok: false, error: "sender_not_configured" };
  const senderName = process.env.SENDER_NAME ?? "Sender";
  const replyTo = process.env.SENDER_REPLY_TO ?? senderEmail;

  // Fetch active campaign for this prospect (if any) — used for tagging only.
  let campaignId: string | null = null;
  try {
    const latestMessage = await db
      .select({ campaignId: schema.messages.campaignId })
      .from(schema.messages)
      .where(eq(schema.messages.prospectId, prospect.id))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1);
    campaignId = latestMessage[0]?.campaignId ?? null;
  } catch {
  }

  let sent: Awaited<ReturnType<typeof sendEmail>>;
  try {
    sent = await sendEmail({
      to: {
        email: prospect.email,
        name: [prospect.firstName, prospect.lastName].filter(Boolean).join(" ") || undefined,
      },
      from: { email: senderEmail, name: senderName },
      replyTo: { email: replyTo },
      subject: draft.subject,
      textContent: draft.textBody,
      htmlContent: draft.htmlBody ?? textToSimpleHtml(draft.textBody),
      tags: [`manual`, ...(campaignId ? [`campaign:${campaignId}`] : [])],
    });
  } catch (err) {
    await db.insert(schema.events).values({
      prospectId: prospect.id,
      campaignId,
      kind: "message.failed",
      payload: { sentBy: auth.email, trigger: "manual", error: (err as Error).message },
    });
    return { ok: false, error: (err as Error).message };
  }

  await db.insert(schema.messages).values({
    prospectId: prospect.id,
    campaignId,
    direction: "outbound",
    kind: "first_touch",
    subject: draft.subject,
    bodyText: draft.textBody,
    bodyHtml: draft.htmlBody ?? textToSimpleHtml(draft.textBody),
    messageId: sent.messageId,
    providerMessageId: sent.providerMessageId,
    sentAt: new Date(),
  });

  await db
    .update(schema.prospects)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(schema.prospects.id, prospect.id));

  await db.insert(schema.events).values({
    prospectId: prospect.id,
    campaignId,
    kind: "message.sent",
    payload: {
      sentBy: auth.email,
      trigger: "manual",
      messageId: sent.messageId,
      email: prospect.email,
    },
  });

  try {
    await trackEmailSent({
      campaignId: campaignId ?? "manual",
      prospectId: prospect.id,
      vertical: "manual",
      messageId: sent.messageId,
    });
  } catch {
  }

  revalidatePath(`/[locale]/prospects/${prospect.id}`, "page");
  revalidatePath(`/[locale]/prospects`, "page");
  return { ok: true };
}
