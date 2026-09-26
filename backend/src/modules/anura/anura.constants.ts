/**
 * Anura "Direct" reporting endpoints (https://docs.anura.io/api).
 * `drill` lists the parameters that narrow a table one level deeper, in order:
 * with no drill params set the table lists e.g. countries, with `country` set it
 * lists that country's regions, and so on.
 */
export const DIRECT_REPORTS = {
  sessions: { path: "/direct/sessions", label: "Sessions", drill: [] as string[] },
  browsers: { path: "/direct/browsers", label: "Browsers", drill: ["browser", "browser_version"] },
  "operating-systems": { path: "/direct/operating-systems", label: "Operating Systems", drill: ["os", "os_version"] },
  devices: { path: "/direct/devices", label: "Devices", drill: ["manufacturer", "model"] },
  "device-types": { path: "/direct/device-types", label: "Device Types", drill: ["type"] },
  geography: { path: "/direct/geography", label: "Geography", drill: ["country", "region", "city"] },
  networks: { path: "/direct/networks", label: "Networks", drill: ["network"] },
  connections: { path: "/direct/connections", label: "Connections", drill: ["connection"] },
} as const;

export type DirectReportName = keyof typeof DIRECT_REPORTS;
export const DIRECT_REPORT_NAMES = Object.keys(DIRECT_REPORTS) as DirectReportName[];

export const ALL_DRILL_PARAMS = [
  ...new Set(Object.values(DIRECT_REPORTS).flatMap((r) => r.drill as readonly string[])),
];

/** Rolling windows enforced by Anura (UTC days, inclusive). */
export const LIMITS = {
  tableDays: 7,
  overviewDays: 31,
  rawMaxAgeDays: 90,
};

/** Standard columns for a "direct" raw data report, in the same order as Anura's CSV export. */
export const DIRECT_RAW_COLUMNS = [
  "source",
  "campaign",
  "result",
  "rule_sets",
  "invalid_traffic_type",
  "remote_address",
  "network",
  "connection",
  "city",
  "region",
  "country",
  "user_agent",
  "browser_name",
  "browser_version",
  "os_name",
  "os_version",
  "device_type",
  "device_manufacturer",
  "device_model",
  "mobile",
  "app_id",
  "device_id",
  "requesting_remote_address",
  "requesting_user_agent",
] as const;

export const RAW_FILTER_OPERATORS = [
  "equals",
  "not_equals",
  "starts_with",
  "ends_with",
  "contains",
  "not_contains",
  "empty",
  "not_empty",
] as const;

/** Columns that get a value breakdown (facet) in the raw rows view. */
export const RAW_FACET_COLUMNS = [
  "result",
  "invalid_traffic_type",
  "rule_sets",
  "source",
  "campaign",
  "country",
  "region",
  "network",
  "connection",
  "device_type",
  "browser_name",
  "os_name",
  "mobile",
];
