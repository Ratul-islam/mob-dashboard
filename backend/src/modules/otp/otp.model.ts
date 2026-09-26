import { datetime, index, int, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { users } from "../user/user.model.js";

export const OTP_TYPES = ["EMAIL_VERIFICATION", "PASSWORD_RESET", "TWO_FA"] as const;

export interface IOTP {
  userId: number;
  otp: string;
  type: (typeof OTP_TYPES)[number];
  expiresAt: Date;
}

export const otps = mysqlTable(
  "otps",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    otp: varchar("otp", { length: 12 }).notNull(),
    type: mysqlEnum("type", OTP_TYPES).notNull(),
    expiresAt: datetime("expires_at").notNull(),
  },
  (t) => [index("otps_user_type_idx").on(t.userId, t.type)],
);
