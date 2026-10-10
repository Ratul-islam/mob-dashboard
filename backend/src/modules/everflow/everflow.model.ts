import { boolean, datetime, double, index, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { users } from "../user/user.model.js";

/**
 * Every Everflow conversion and post-conversion event uploaded from a conversions export. The
 * conversion ID makes re-uploading an overlapping export update rows instead of duplicating them.
 */
export const everflowConversions = mysqlTable(
  "everflow_conversions",
  {
    conversionId: varchar("conversion_id", { length: 64 }).primaryKey(),
    transactionId: varchar("transaction_id", { length: 64 }).notNull(),
    // approved, pending, rejected or invalid
    status: varchar("status", { length: 32 }),
    isEvent: boolean("is_event").notNull().default(false),
    event: varchar("event", { length: 255 }),
    revenue: double("revenue").notNull().default(0),
    payout: double("payout").notNull().default(0),
    offer: varchar("offer", { length: 512 }),
    affiliate: varchar("affiliate", { length: 255 }),
    clickAt: datetime("click_at"),
    convertedAt: datetime("converted_at"),
    // When it was last uploaded
    receivedAt: datetime("received_at").notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("everflow_conversions_transaction_idx").on(t.transactionId)],
);

export type EverflowConversionRow = typeof everflowConversions.$inferInsert;

/**
 * Conversions rolled up per click (transaction ID), rebuilt from everflow_conversions, so a raw
 * row joins to at most one row through the additional data field carrying the transaction ID.
 * Counts and money only include valid (approved or pending) conversions.
 */
export const everflowTransactions = mysqlTable("everflow_transactions", {
  transactionId: varchar("transaction_id", { length: 64 }).primaryKey(),
  // Best status across the click's conversions: approved > pending > rejected > invalid
  status: varchar("status", { length: 32 }),
  conversions: int("conversions").notNull().default(0),
  events: int("events").notNull().default(0),
  // Distinct event names, e.g. "Base, Upsell"
  eventNames: varchar("event_names", { length: 512 }),
  revenue: double("revenue").notNull().default(0),
  payout: double("payout").notNull().default(0),
  offer: varchar("offer", { length: 512 }),
  affiliate: varchar("affiliate", { length: 255 }),
  clickAt: datetime("click_at"),
  firstConversionAt: datetime("first_conversion_at"),
  lastConversionAt: datetime("last_conversion_at"),
  syncedAt: datetime("synced_at").notNull().$defaultFn(() => new Date()),
});

/** One uploaded Everflow conversions export. */
export const everflowUploads = mysqlTable("everflow_uploads", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 255 }),
  // Data rows in the file, and how many of them were stored (the rest lacked a transaction ID)
  rows: int("rows").notNull().default(0),
  conversions: int("conversions").notNull().default(0),
  firstConversionAt: datetime("first_conversion_at"),
  lastConversionAt: datetime("last_conversion_at"),
  uploadedBy: int("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: datetime("uploaded_at").notNull().$defaultFn(() => new Date()),
});

export type EverflowUploadRow = typeof everflowUploads.$inferSelect;
