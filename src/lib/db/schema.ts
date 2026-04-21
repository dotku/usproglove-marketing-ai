import { pgTable, pgEnum, text, varchar, integer, timestamp, jsonb, uuid, boolean, index } from "drizzle-orm/pg-core";

export const verticalEnum = pgEnum("vertical", [
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
]);

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "archived"]);
export const prospectStatusEnum = pgEnum("prospect_status", [
  "discovered",
  "enriching",
  "enriched",
  "ready",
  "sending",
  "sent",
  "replied",
  "bounced",
  "suppressed",
  "unsubscribed",
]);
export const messageDirectionEnum = pgEnum("message_direction", ["outbound", "inbound"]);
export const messageKindEnum = pgEnum("message_kind", ["first_touch", "follow_up_1", "follow_up_2", "reply", "handoff"]);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    website: text("website"),
    phone: text("phone"),
    addressLine: text("address_line"),
    city: text("city"),
    region: varchar("region", { length: 32 }),
    countryCode: varchar("country_code", { length: 2 }).default("US"),
    vertical: verticalEnum("vertical").notNull(),
    subVertical: varchar("sub_vertical", { length: 64 }),
    googlePlaceId: text("google_place_id").unique(),
    rating: integer("rating"),
    reviewCount: integer("review_count"),
    discoverySourceId: varchar("discovery_source_id", { length: 32 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    verticalIdx: index("companies_vertical_idx").on(t.vertical),
    regionIdx: index("companies_region_idx").on(t.region),
  }),
);

export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: text("role"),
    status: prospectStatusEnum("status").default("discovered").notNull(),
    score: integer("score"),
    enrichmentSourceId: varchar("enrichment_source_id", { length: 32 }),
    enrichmentConfidence: integer("enrichment_confidence"),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
    suppressionReason: text("suppression_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("prospects_email_idx").on(t.email),
    statusIdx: index("prospects_status_idx").on(t.status),
  }),
);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vertical: verticalEnum("vertical").notNull(),
  heroSkuId: varchar("hero_sku_id", { length: 32 }).notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  dailyCap: integer("daily_cap").default(10).notNull(),
  promptTemplate: text("prompt_template").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name").notNull(),
  replyToEmail: text("reply_to_email").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    direction: messageDirectionEnum("direction").notNull(),
    kind: messageKindEnum("kind").notNull(),
    subject: text("subject"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    messageId: text("message_id").unique(),
    inReplyTo: text("in_reply_to"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    prospectIdx: index("messages_prospect_idx").on(t.prospectId),
    inReplyToIdx: index("messages_in_reply_to_idx").on(t.inReplyTo),
  }),
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    kindIdx: index("events_kind_idx").on(t.kind),
  }),
);

export const contentPieces = pgTable("content_pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  vertical: verticalEnum("vertical").notNull(),
  locale: varchar("locale", { length: 8 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  bodyMdx: text("body_mdx").notNull(),
  heroSkuId: varchar("hero_sku_id", { length: 32 }),
  keywords: jsonb("keywords").$type<string[]>(),
  published: boolean("published").default(false).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppressions = pgTable("suppressions", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  reason: varchar("reason", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
