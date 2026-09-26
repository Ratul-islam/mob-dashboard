import { boolean, datetime, int, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const USER_ROLES = ["root", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", USER_ROLES).notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  credentialsChangedAt: datetime("credentials_changed_at", { fsp: 3 }),
  lastLoginAt: datetime("last_login_at"),
  createdBy: int("created_by"),
  createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: datetime("updated_at").notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

export type UserRow = typeof users.$inferSelect;
/** A user as loaded by the services: the password hash is only present when explicitly requested. */
export type UserRecord = Omit<UserRow, "password"> & { password?: string };

export const toPublicUser = (user: UserRecord) => ({
  id: String(user.id),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt ?? null,
});
