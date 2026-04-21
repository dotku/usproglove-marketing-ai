import { generateObject } from "ai";
import { z } from "zod";
import { models, pickModel } from "@/lib/ai/gateway";
import { findContacts, verifyEmail } from "@/lib/prospects/enrichment";
import { googlePlacesSource } from "@/lib/prospects/sources/google-places";
import { sendEmail } from "@/lib/email/brevo";
import type { Vertical } from "@/../content/catalog/products";
import { products, heroSkuByVertical } from "@/../content/catalog/products";

const DraftSchema = z.object({
  subject: z.string().min(6).max(80),
  textBody: z.string().min(40).max(1200),
  htmlBody: z.string().min(40),
});

const ScoreSchema = z.object({
  fit: z.number().min(0).max(100),
  reasoning: z.string(),
  suggestedSkuId: z.string(),
});

export interface OutboundContext {
  vertical: Vertical;
  city?: string;
  region?: string;
  dailyCap: number;
  senderEmail: string;
  senderName: string;
  replyToEmail: string;
  campaignId: string;
}

/**
 * Outbound loop skeleton — wire into Vercel Workflow DevKit once the package is installed.
 * Each step below becomes a `step.do(...)` call so the workflow is crash-safe and resumable.
 *
 * Flow:
 *   1. research  → Google Places discovery by vertical+region
 *   2. enrich    → Hunter primary, Snov fallback, find owner/GM emails
 *   3. verify    → drop anything not deliverable
 *   4. score     → AI fit/risk score; drop < threshold
 *   5. draft     → AI personalized first-touch email keyed to vertical + hero SKU
 *   6. send      → Brevo transactional API
 *   7. wait      → workflow pauses until reply-poller resumes with inbound webhook
 *   8. branch    → positive → handoff; no-reply after 5d → follow-up; negative → suppress
 */
export async function runOutboundStep(ctx: OutboundContext) {
  const discovered = await googlePlacesSource.discover({
    vertical: ctx.vertical,
    city: ctx.city,
    region: ctx.region,
    limit: ctx.dailyCap * 3,
  });

  const results = [];
  for (const company of discovered) {
    if (!company.website) continue;
    const domain = extractDomain(company.website);
    if (!domain) continue;

    const contacts = await findContacts({
      companyName: company.name,
      domain,
      rolesOfInterest: rolesFor(ctx.vertical),
    });
    if (contacts.length === 0) continue;

    const contact = contacts[0];
    const verification = await verifyEmail(contact.email);
    if (!verification.deliverable || verification.score < 70) continue;

    const score = await generateObject({
      model: models[pickModel("score")],
      schema: ScoreSchema,
      prompt: scorePrompt(company.name, company.vertical, ctx.vertical, contact.role),
    });
    if (score.object.fit < 60) continue;

    const heroSkuId = score.object.suggestedSkuId || heroSkuByVertical[ctx.vertical];
    const heroSku = products.find((p) => p.id === heroSkuId) ?? products.find((p) => p.id === heroSkuByVertical[ctx.vertical])!;

    const draft = await generateObject({
      model: models[pickModel("draft")],
      schema: DraftSchema,
      prompt: draftPrompt({
        company: company.name,
        vertical: ctx.vertical,
        contactName: contact.firstName,
        heroSkuName: heroSku.name,
        positioning: heroSku.positioning,
      }),
    });

    const sent = await sendEmail({
      to: { email: contact.email, name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || undefined },
      from: { email: ctx.senderEmail, name: ctx.senderName },
      replyTo: { email: ctx.replyToEmail },
      subject: draft.object.subject,
      textContent: draft.object.textBody,
      htmlContent: draft.object.htmlBody,
      tags: [`vertical:${ctx.vertical}`, `campaign:${ctx.campaignId}`],
    });

    results.push({ company, contact, sent });
    if (results.length >= ctx.dailyCap) break;
  }

  return results;
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function rolesFor(vertical: Vertical): string[] {
  switch (vertical) {
    case "tattoo":
      return ["owner", "artist"];
    case "beauty":
      return ["owner", "manager"];
    case "restaurant":
      return ["owner", "general manager", "procurement"];
    default:
      return ["owner", "manager", "procurement"];
  }
}

function scorePrompt(
  companyName: string,
  companyVertical: string,
  targetVertical: Vertical,
  role?: string,
): string {
  return `Score this prospect for a disposable nitrile glove cold outreach. Return fit 0-100.

Company: ${companyName}
Vertical tag: ${companyVertical}
Target vertical for campaign: ${targetVertical}
Contact role: ${role ?? "unknown"}

Rubric:
- 80-100: exact match vertical, owner/manager contact, clear glove usage
- 60-79: adjacent vertical or ops role
- 0-59: mismatch or unclear

Also suggest a SKU id from our catalog (e.g., "5.0-black", "3.0", "3.5-ice-blue").`;
}

function draftPrompt(args: {
  company: string;
  vertical: Vertical;
  contactName?: string;
  heroSkuName: string;
  positioning: string[];
}): string {
  return `Draft a short B2B cold outreach email — 3 short paragraphs, plainspoken, no marketing fluff, no emojis.

Company: ${args.company}
Vertical: ${args.vertical}
Contact: ${args.contactName ?? "there"}
Hero product: ${args.heroSkuName}
Product positioning: ${args.positioning.join(", ")}

Rules:
- Subject < 55 chars, curiosity over claim
- Open line references something specific to ${args.vertical} work (not "I was looking at your website")
- One concrete value bullet tied to the product positioning
- Close with a single soft CTA (reply to get a sample pack)
- Plaintext + HTML variants. HTML is semantic, no inline styles beyond <b> and <a>.
- No "Dear", no "I hope this finds you well".`;
}
