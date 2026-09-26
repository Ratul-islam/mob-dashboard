import { datetime, index, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { users } from "../user/user.model.js";

export const refreshTokens = mysqlTable(
  "refresh_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    replacedByTokenHash: varchar("replaced_by_token_hash", { length: 64 }),
    revokedAt: datetime("revoked_at"),
    expiresAt: datetime("expires_at").notNull(),
    createdByIp: varchar("created_by_ip", { length: 64 }),
    revokedByIp: varchar("revoked_by_ip", { length: 64 }),
    createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId), index("refresh_tokens_expires_idx").on(t.expiresAt)],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
