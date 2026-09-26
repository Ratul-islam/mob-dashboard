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

export const daysBetween = (start: string, end: string) =>
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

/**
 * Anura's source/campaign lists accept at most 7 days, so longer ranges are fetched in 7-day
 * pieces and merged (first-seen order, no duplicates).
 */
const listAcrossRange = async (f: ScopeFilters, fetchPiece: (piece: { start: string; end: string }) => Promise<string[]>) => {
  const pieces = splitRange(f.start, f.end, LIMITS.tableDays);
  const lists = await Promise.all(pieces.map(fetchPiece));
  return [...new Set(lists.flat())];
};

export const getSources = async (f: ScopeFilters, search?: string) => {
  assertRange(f.start, f.end, LIMITS.overviewDays);
  return listAcrossRange(f, async (piece) => {
    const { start, end, instance } = scopeParams({ ...f, ...piece });
    const res = await anuraRequest(
      "/interface/sources",
      { start, end, instance, source: search, all: false, limit: 1000 },
      { ttlMs: 60_000 },
    );
    return (res.sources ?? []).map(String) as string[];
  });
};

export const getCampaigns = async (f: ScopeFilters, search?: string) => {
  assertRange(f.start, f.end, LIMITS.overviewDays);
  return listAcrossRange(f, async (piece) => {
    const { start, end, instance, source } = scopeParams({ ...f, ...piece });
    const res = await anuraRequest(
      "/interface/campaigns",
      { start, end, instance, source, campaign: search, all: false, limit: 1000 },
      { ttlMs: 60_000 },
    );
    return (res.campaigns ?? []).map(String) as string[];
  });
};

/**
 * Sources that sent traffic for a campaign, busiest first. Anura has no direct lookup, but the
 * sessions report filtered by campaign (and no source) breaks that campaign down by source.
 */
export const getCampaignSources = async (f: ScopeFilters, campaign: string) => {
  const report = await getReport("sessions", { ...f, source: undefined, campaign }, { sort: "1:desc", limit: 50 });
  return report.rows.map((row) => ({ source: row.key, requests: Number(row.cells[1] ?? 0) }));
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

/** Splits a date range into consecutive pieces of at most `days` days. */
const splitRange = (start: string, end: string, days: number) => {
  const chunks: { start: string; end: string }[] = [];
  for (let s = start; s <= end; s = addDays(s, days)) {
    const e = addDays(s, days - 1);
    chunks.push({ start: s, end: e < end ? e : end });
  }
  return chunks;
};

type ReportRow = { key: string; cells: Cell[] };

const parseTable = (res: any) => {
  const table = res.table ?? { headers: [], rows: [] };
  const rows: ReportRow[] = ((table.rows ?? []) as unknown[][]).map((row) => {
    const [first, ...rest] = row;
    const { key, label } = parseLabelCell(first);
    return { key, cells: [label, ...rest.map(normalizeCell)] };
  });
  const all: Cell[] | null = Array.isArray(table.all)
    ? [parseLabelCell(table.all[0]).label ?? "All", ...table.all.slice(1).map(normalizeCell)]
    : null;
  return { headers: (table.headers ?? []).map(String) as string[], rows, all };
};

const drillFor = (name: DirectReportName, requested?: Record<string, string | undefined>) => {
  // Anura requires each drill parameter's parent, so only pass a contiguous prefix of the chain.
  const drill: Record<string, string> = {};
  for (const param of DIRECT_REPORTS[name].drill) {
    const value = requested?.[param];
    if (!value) break;
    drill[param] = value;
  }
  return drill;
};

export const getReport = async (name: DirectReportName, f: ScopeFilters, o: ReportOptions) => {
  assertRange(f.start, f.end, LIMITS.overviewDays);
  const def = DIRECT_REPORTS[name];
  const drill = drillFor(name, o.drill);

  // Longer than Anura's table window: combine 7-day pieces on our side.
  if (daysBetween(f.start, f.end) + 1 > LIMITS.tableDays) return getCombinedReport(name, f, o, drill);

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

  const { headers, rows, all } = parseTable(res);
  const q = res.query ?? {};
  return {
    report: name,
    headers,
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

const RATE_SUFFIX = " Rate";
const MAX_PAGES_PER_CHUNK = 20;

/**
 * Builds a breakdown table for up to 31 days from 7-day pieces: every row of every piece is fetched,
 * counts are summed per row, rate columns are recomputed from the sums, and search/sort/paging
 * are applied here instead of by Anura.
 */
const getCombinedReport = async (
  name: DirectReportName,
  f: ScopeFilters,
  o: ReportOptions,
  drill: Record<string, string>,
) => {
  const def = DIRECT_REPORTS[name];
  const today = todayUtc();

  const fetchChunk = async (chunk: { start: string; end: string }) => {
    // Settled days don't change, so pieces that end before today are cached for longer.
    const ttl = chunk.end < today ? { ttlMs: 10 * 60_000 } : {};
    const params = {
      ...scopeParams({ ...f, ...chunk }),
      ...drill,
      rules: o.rules || undefined,
      search: o.search,
      startswith: o.search && o.startswith ? true : undefined,
      sort: "1:desc",
      limit: 1000,
    };
    const first = await anuraRequest(def.path, { ...params, page: 1 }, ttl);
    const pages = Math.min(Number(first.query?.pages ?? 1), MAX_PAGES_PER_CHUNK);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => anuraRequest(def.path, { ...params, page: i + 2 }, ttl)),
    );
    return [first, ...rest];
  };

  const responses = (await Promise.all(splitRange(f.start, f.end, LIMITS.tableDays).map(fetchChunk))).flat();

  // Union of count headers across pieces (rule set columns can differ from week to week).
  const countHeaders: string[] = [];
  let labelHeader = "";
  const byKey = new Map<string, { label: Cell; counts: Map<string, number> }>();
  const allCounts = new Map<string, number>();
  let allLabel: Cell = "All";
  const total = { nonsuspect: 0, suspect: 0, mobile: 0 };

  responses.forEach((res) => {
    const { headers, rows, all } = parseTable(res);
    labelHeader ||= headers[0] ?? "";
    for (const h of headers.slice(1)) if (!countHeaders.includes(h)) countHeaders.push(h);

    for (const row of rows) {
      const entry = byKey.get(row.key) ?? { label: row.cells[0], counts: new Map<string, number>() };
      headers.forEach((h, i) => i > 0 && entry.counts.set(h, (entry.counts.get(h) ?? 0) + Number(row.cells[i] ?? 0)));
      byKey.set(row.key, entry);
    }
    // Each piece repeats its "all" row and totals on every page; count them once per piece.
    if (Number(res.query?.page ?? 1) === 1) {
      if (all) {
        allLabel = all[0];
        headers.forEach((h, i) => i > 0 && allCounts.set(h, (allCounts.get(h) ?? 0) + Number(all[i] ?? 0)));
      }
      const t = normalizeTotal(res.total);
      total.nonsuspect += t.nonsuspect;
      total.suspect += t.suspect;
      total.mobile += t.mobile;
    }
  });

  // Same column layout Anura uses with rates on: each count followed by its share of requests.
  const headers = [labelHeader];
  for (const h of countHeaders) {
    headers.push(h);
    if (o.rates && ["Non-Suspect", "Suspect", "Mobile"].includes(h)) headers.push(`${h}${RATE_SUFFIX}`);
  }
  const toCells = (label: Cell, counts: Map<string, number>): Cell[] => {
    const requests = counts.get("Requests") ?? 0;
    return headers.map((h, i) => {
      if (i === 0) return label;
      if (h.endsWith(RATE_SUFFIX)) {
        const base = counts.get(h.slice(0, -RATE_SUFFIX.length)) ?? 0;
        return requests ? Math.round((base / requests) * 10000) / 100 : 0;
      }
      return counts.get(h) ?? 0;
    });
  };

  let rows: ReportRow[] = [...byKey].map(([key, e]) => ({ key, cells: toCells(e.label, e.counts) }));

  const sort = o.sort ?? "1:desc";
  const keys = sort.split(",").map((part) => {
    const [col, dir] = part.split(":");
    return { col: Number(col), dir: dir === "asc" ? 1 : -1 };
  });
  rows.sort((a, b) => {
    for (const { col, dir } of keys) {
      const x = a.cells[col];
      const y = b.cells[col];
      const cmp =
        typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
      if (cmp) return cmp * dir;
    }
    return 0;
  });

  const limit = o.limit ?? 20;
  const results = rows.length;
  const pages = Math.max(1, Math.ceil(results / limit));
  const page = Math.min(o.page ?? 1, pages);
  rows = rows.slice((page - 1) * limit, page * limit);

  return {
    report: name,
    headers,
    rows,
    all: allCounts.size ? toCells(allLabel, allCounts) : null,
    total: normalizeTotal(total),
    drill,
    drillParams: def.drill,
    pagination: { page, limit, results, pages },
    sort,
  };
};

