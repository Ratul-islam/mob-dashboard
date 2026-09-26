import { getConfig } from "../../config/config.js";
import { AppError } from "../../utils/AppError.js";
import { anuraRequest } from "./anura.client.js";
import { DIRECT_REPORTS, DirectReportName, LIMITS } from "./anura.constants.js";

/* ----------------------------------------------------------------------------------------------
 * Dates. Anura takes YYYYMMDD integers and reports in UTC.
 * -------------------------------------------------------------------------------------------- */

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export const toAnuraDate = (isoDate: string) => Number(isoDate.replaceAll("-", ""));

export const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);

export const assertRange = (start: string, end: string, maxDays: number) => {
  if (daysBetween(start, end) < 0) throw new AppError("Start date must be on or before end date", 400);
  if (end > todayUtc()) throw new AppError("End date cannot be in the future (dates are UTC)", 400);
  if (daysBetween(start, end) + 1 > maxDays) {
    throw new AppError(`This view supports at most ${maxDays} days per request`, 400);
  }
};

/* ----------------------------------------------------------------------------------------------
 * Interface (instances / sources / campaigns)
 * -------------------------------------------------------------------------------------------- */

export type ScopeFilters = {
  start: string;
  end: string;
  instance?: string;
  source?: string;
  campaign?: string;
};

const scopeParams = (f: ScopeFilters) => ({
  start: toAnuraDate(f.start),
  end: toAnuraDate(f.end),
  instance: f.instance || getConfig().ANURA_INSTANCE_ID || undefined,
  source: f.source,
  campaign: f.campaign,
});

const INTERFACE_TTL = 5 * 60_000;

export const getInstances = async () => {
  const res = await anuraRequest("/interface/instances", { all: false, limit: 1000 }, { ttlMs: INTERFACE_TTL });
  return (res.instances ?? []) as { id: string | number; name: string; status?: number }[];
};

export const getSources = async (f: ScopeFilters, search?: string) => {
  const { start, end, instance } = scopeParams(f);
  const res = await anuraRequest(
    "/interface/sources",
    { start, end, instance, source: search, all: false, limit: 1000 },
    { ttlMs: 60_000 },
  );
  return (res.sources ?? []).map(String) as string[];
};

export const getCampaigns = async (f: ScopeFilters, search?: string) => {
  const { start, end, instance, source } = scopeParams(f);
  const res = await anuraRequest(
    "/interface/campaigns",
    { start, end, instance, source, campaign: search, all: false, limit: 1000 },
    { ttlMs: 60_000 },
  );
  return (res.campaigns ?? []).map(String) as string[];
};

/* ----------------------------------------------------------------------------------------------
 * Overview + daily trend
 * -------------------------------------------------------------------------------------------- */

type DirectTotal = { nonsuspect?: number; suspect?: number; mobile?: number };

const normalizeTotal = (total: DirectTotal | undefined) => {
  const nonsuspect = Number(total?.nonsuspect ?? 0);
  const suspect = Number(total?.suspect ?? 0);
  return { total: nonsuspect + suspect, nonsuspect, suspect, mobile: Number(total?.mobile ?? 0) };
};

export const getOverview = async (f: ScopeFilters) => {
  assertRange(f.start, f.end, LIMITS.overviewDays);
  const res = await anuraRequest("/direct/overview", scopeParams(f));
  return normalizeTotal(res.total);
};

/** Daily suspect / non-suspect totals from the overview endpoint's chart breakdown. */
export const getTrend = async (f: ScopeFilters) => {
  assertRange(f.start, f.end, LIMITS.overviewDays);
  const res = await anuraRequest("/direct/overview", { ...scopeParams(f), chart: true });

  // chart: [["Date", "Suspect", "Non-Suspect"], ["20260924", 2408, 3483], ...]
  const [header = [], ...rows] = (res.chart ?? []) as unknown[][];
  const col = (name: string) => header.findIndex((h) => String(h).toLowerCase() === name);
  const iDate = col("date");
  const iSuspect = col("suspect");
  const iNonSuspect = col("non-suspect");

  return rows.map((row) => {
    const d = String(row[iDate]);
    const suspect = Number(row[iSuspect] ?? 0);
    const nonsuspect = Number(row[iNonSuspect] ?? 0);
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      total: suspect + nonsuspect,
      suspect,
      nonsuspect,
    };
  });
};

/* ----------------------------------------------------------------------------------------------
 * Breakdown tables (/direct/sessions, /direct/browsers, ...)
 * -------------------------------------------------------------------------------------------- */

export type ReportOptions = {
  drill?: Record<string, string | undefined>;
  rates?: boolean;
  rules?: boolean;
  search?: string;
  startswith?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
};

type Cell = string | number | null;

/** Instance cells arrive as JSON objects ({"id":..,"name":..}) after URL decoding. */
const parseLabelCell = (cell: unknown): { key: string; label: Cell } => {
  if (typeof cell === "string" && cell.startsWith("{")) {
    try {
      const obj = JSON.parse(cell);
      if (obj && typeof obj === "object" && "id" in obj) {
        return { key: String(obj.id), label: String(obj.name ?? obj.id) };
      }
    } catch {
      /* plain string */
    }
  }
  // Labels stay text: source/campaign IDs like "9569" must not become numbers.
  const text = cell == null || cell === false ? "" : String(cell);
  return { key: text, label: text || null };
};

const normalizeCell = (cell: unknown): Cell => {
  if (cell === null || cell === undefined || cell === false) return null;
  if (typeof cell === "number") return cell;
  if (typeof cell === "string") {
    // Rates may come back as numeric strings.
    return cell.trim() !== "" && !Number.isNaN(Number(cell)) && /^-?\d+(\.\d+)?$/.test(cell.trim())
      ? Number(cell)
      : cell;
  }
  if (typeof cell === "boolean") return String(cell);
  return JSON.stringify(cell);
};

export const getReport = async (name: DirectReportName, f: ScopeFilters, o: ReportOptions) => {
  assertRange(f.start, f.end, LIMITS.tableDays);
  const def = DIRECT_REPORTS[name];

  // Anura requires each drill parameter's parent, so only pass a contiguous prefix of the chain.
  const drill: Record<string, string> = {};
  for (const param of def.drill) {
    const value = o.drill?.[param];
    if (!value) break;
    drill[param] = value;
  }

  const res = await anuraRequest(def.path, {
    ...scopeParams(f),
    ...drill,
    rates: o.rates || undefined,
    rules: o.rules || undefined,
    search: o.search,
    startswith: o.search && o.startswith ? true : undefined,
    sort: o.sort,
    page: o.page,
    limit: o.limit,
  });

  const table = res.table ?? { headers: [], rows: [] };
  const rows = ((table.rows ?? []) as unknown[][]).map((row) => {
    const [first, ...rest] = row;
    const { key, label } = parseLabelCell(first);
    return { key, cells: [label, ...rest.map(normalizeCell)] };
  });
  const all = Array.isArray(table.all)
    ? [parseLabelCell(table.all[0]).label ?? "All", ...table.all.slice(1).map(normalizeCell)]
    : null;

  const q = res.query ?? {};
  return {
    report: name,
    headers: (table.headers ?? []).map(String) as string[],
    rows,
    all,
    total: normalizeTotal(res.total),
    drill,
    drillParams: def.drill,
    pagination: {
      page: Number(q.page ?? o.page ?? 1),
      limit: Number(q.limit ?? o.limit ?? 20),
      results: Number(q.results ?? rows.length),
      pages: Number(q.pages ?? 1),
    },
    sort: q.sort ?? o.sort ?? "1:desc",
  };
};

