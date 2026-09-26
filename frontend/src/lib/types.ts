export type Role = "root" | "user";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface AuthPayload {
  accessToken: string;
  user: User;
}

export interface Meta {
  configured: boolean;
  defaultInstance: string | null;
  today: string;
  limits: { tableDays: number; overviewDays: number; rawMaxAgeDays: number };
  reports: { key: ReportKey; label: string; drill: string[] }[];
  rawColumns: string[];
  rawFilterOperators: string[];
  liveRefreshSeconds: number;
}

export type ReportKey =
  | "sessions"
  | "browsers"
  | "operating-systems"
  | "devices"
  | "device-types"
  | "geography"
  | "networks"
  | "connections";

export interface Instance {
  id: string | number;
  name: string;
  status?: number;
}

export interface Scope {
  start: string;
  end: string;
  instance?: string;
  source?: string;
  campaign?: string;
}

export interface Totals {
  total: number;
  nonsuspect: number;
  suspect: number;
  mobile: number;
}

export interface TrendPoint {
  date: string;
  total: number;
  suspect: number;
  nonsuspect: number;
}

export type Cell = string | number | null;

export interface ReportData {
  report: ReportKey;
  headers: string[];
  rows: { key: string; cells: Cell[] }[];
  all: Cell[] | null;
  total: Totals;
  drill: Record<string, string>;
  drillParams: string[];
  pagination: { page: number; limit: number; results: number; pages: number };
  sort: string;
}

export interface RawImportInfo {
  status: "importing" | "ready" | "failed";
  rows: number;
  columns: string[];
  error: string | null;
  importedAt: string | null;
}

export interface RawReportSummary {
  id: string;
  name: string;
  instance: string;
  type: string;
  requested: string;
  created: string | null;
  failed: string | null;
  timed_out: string | null;
  cancelled: string | null;
  status: string;
  expires: string;
  autoImport: boolean;
  import: RawImportInfo | null;
}

export interface RawReportList {
  limits: { minutes_total: number; minutes_available: number; api_concurrent: number; dashboard_concurrent: number } | null;
  reports: RawReportSummary[];
  pagination: { page: number; pages: number; results: number };
}

export interface RawReportDetail {
  id: string;
  type: string;
  name: string;
  start: number;
  end: number;
  instance_name: string;
  status: string;
  rows?: number;
  file_size?: number;
  processing_minutes?: number;
  autoImport: boolean;
  import: RawImportInfo | null;
}

export type RowValue = string | number | boolean | null;
export type RawRow = Record<string, RowValue> & { id: number };

export interface RowFilter {
  column: string;
  operator: string;
  value?: string | string[];
}

export interface RawRowsResponse {
  columns: string[];
  rows: RawRow[];
  pagination: { page: number; limit: number; results: number; pages: number; total: number };
  sort: { column: string; dir: "asc" | "desc" };
}

export interface RawFacets {
  total: number;
  facets: Record<string, { value: string | boolean | null; count: number }[]>;
  timeline: { hour: string; total: number; suspect: number; nonsuspect: number }[];
}
