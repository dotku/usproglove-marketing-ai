"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { checkAdmin } from "@/lib/auth/admin";
import { verticalEnum, campaignStatusEnum } from "@/lib/db/schema";
import { products, heroSkuByVertical, type Vertical } from "@/../content/catalog/products";

const VERTICALS = verticalEnum.enumValues;
const STATUSES = campaignStatusEnum.enumValues;
const PRODUCT_IDS = products.map((p) => p.id) as [string, ...string[]];

const CreateCampaignSchema = z.object({
  name: z.string().min(2).max(120),
  vertical: z.enum(VERTICALS as unknown as [string, ...string[]]),
  heroSkuId: z.enum(PRODUCT_IDS),
  dailyCap: z.coerce.number().int().min(1).max(500),
  contactsPerCompany: z.coerce.number().int().min(1).max(10),
  senderEmail: z.email(),
  senderName: z.string().min(1).max(120),
  replyToEmail: z.email(),
  status: z.enum(STATUSES as unknown as [string, ...string[]]),
});

export type CreateCampaignState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const DEFAULT_PROMPT_TEMPLATE =
  "(workflow uses built-in draft prompt; this field is reserved for future per-campaign overrides)";

export async function createCampaign(
  _prev: CreateCampaignState,
  formData: FormData,
): Promise<CreateCampaignState> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "forbidden" };

  const parsed = CreateCampaignSchema.safeParse({
    name: formData.get("name"),
    vertical: formData.get("vertical"),
    heroSkuId: formData.get("heroSkuId"),
    dailyCap: formData.get("dailyCap"),
    contactsPerCompany: formData.get("contactsPerCompany"),
    senderEmail: formData.get("senderEmail"),
    senderName: formData.get("senderName"),
    replyToEmail: formData.get("replyToEmail"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const v = parsed.data;
  await db.insert(schema.campaigns).values({
    name: v.name,
    vertical: v.vertical as Vertical,
    heroSkuId: v.heroSkuId || heroSkuByVertical[v.vertical as Vertical],
    status: v.status as (typeof STATUSES)[number],
    dailyCap: v.dailyCap,
    contactsPerCompany: v.contactsPerCompany,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    senderEmail: v.senderEmail,
    senderName: v.senderName,
    replyToEmail: v.replyToEmail,
  });

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect("/campaigns");
}
