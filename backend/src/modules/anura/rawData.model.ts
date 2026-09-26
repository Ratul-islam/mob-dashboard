import {
  bigint,
  boolean,
  customType,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "../user/user.model.js";

/** A string array stored as JSON text (MySQL 5.5 has no JSON column type). */
const jsonText = customType<{ data: string[]; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => JSON.stringify(value),
  // Databases created before this change use a native JSON column, which mysql2 already parses.
  fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value),
});

/** Tracks a raw data report that has been pulled from Anura into MySQL. */
export const rawImports = mysqlTable("raw_imports", {
  reportId: varchar("report_id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  type: varchar("type", { length: 32 }),
  instanceName: varchar("instance_name", { length: 255 }),
  start: int("start"),
  end: int("end"),
  status: mysqlEnum("status", ["importing", "ready", "failed"]).notNull(),
  rows: int("rows").notNull().default(0),
  columns: jsonText("columns"),
  error: text("error"),
  importedBy: int("imported_by").references(() => users.id, { onDelete: "set null" }),
  importedAt: datetime("imported_at"),
  startedAt: datetime("started_at").notNull().$defaultFn(() => new Date()),
  createdAt: datetime("created_at").notNull().$defaultFn(() => new Date()),
});

export type RawImportRow = typeof rawImports.$inferSelect;

const str = (name: string, length = 512) => varchar(name, { length });

/**
 * One row of a "direct" raw data report. Column names match Anura's CSV headers
 * (e.g. "RULE SETS" -> rule_sets) so they can be filtered and sorted server side.
 */
export const rawRows = mysqlTable(
  "raw_rows",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    reportId: varchar("report_id", { length: 64 }).notNull(),
    timestamp: datetime("timestamp"),
    source: str("source"),
    campaign: str("campaign"),
    result: str("result", 32),
    rule_sets: str("rule_sets"),
    invalid_traffic_type: str("invalid_traffic_type", 32),
    remote_address: str("remote_address", 64),
    network: str("network"),
    connection: str("connection", 128),
    city: str("city", 255),
    region: str("region", 255),
    country: str("country", 255),
    user_agent: text("user_agent"),
    browser_name: str("browser_name", 255),
    browser_version: str("browser_version", 128),
    os_name: str("os_name", 255),
    os_version: str("os_version", 128),
    device_type: str("device_type", 128),
    device_manufacturer: str("device_manufacturer", 255),
    device_model: str("device_model", 255),
    mobile: boolean("mobile"),
    app_id: str("app_id"),
    device_id: str("device_id"),
    requesting_remote_address: str("requesting_remote_address", 64),
    requesting_user_agent: text("requesting_user_agent"),
    additional_data_01: text("additional_data_01"),
    additional_data_02: text("additional_data_02"),
    additional_data_03: text("additional_data_03"),
    additional_data_04: text("additional_data_04"),
    additional_data_05: text("additional_data_05"),
    additional_data_06: text("additional_data_06"),
    additional_data_07: text("additional_data_07"),
    additional_data_08: text("additional_data_08"),
    additional_data_09: text("additional_data_09"),
    additional_data_10: text("additional_data_10"),
  },
  (t) => [
    index("raw_rows_report_ts_idx").on(t.reportId, t.timestamp),
    index("raw_rows_report_result_idx").on(t.reportId, t.result),
  ],
);

export type RawRowColumn = Exclude<keyof typeof rawRows.$inferSelect, "id" | "reportId">;
