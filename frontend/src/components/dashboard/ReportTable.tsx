"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  EyeOff,
  Search,
  X,
} from "lucide-react";
import { useReport } from "@/lib/queries";
import { useStoredState } from "@/lib/useStoredState";
import { useDebounced } from "@/lib/useDebounced";
import { downloadCsv } from "@/lib/csv";
import { formatCell, formatInt, formatPct } from "@/lib/format";
import type { Cell, ReportKey, Scope } from "@/lib/types";
import { Alert, Card, Checkbox, IconButton, Popover, Select, Spinner, Switch } from "@/components/ui";

interface TableSettings {
  hidden: string[];
  rates: boolean;
  rules: boolean;
  startswith: boolean;
  share: boolean;
  limit: number;
}

const DEFAULT_SETTINGS: TableSettings = { hidden: [], rates: false, rules: false, startswith: false, share: true, limit: 10 };
// Anura's sort uses 0-based column indexes: "1:desc" is Requests, descending.
const DEFAULT_SORT = [{ col: 1, dir: "desc" as const }];
const SHARE_COLUMN = "Suspect share";

/** Label for the top level of each drill chain, used as the first breadcrumb. */
const ROOT_LABEL: Partial<Record<ReportKey, string>> = {
  browsers: "All browsers",
  "operating-systems": "All operating systems",
  devices: "All manufacturers",
  geography: "All countries",
};

type SortKey = { col: number; dir: "asc" | "desc" };

export function ReportTable({
  report,
  label,
  drillParams,
  scope,
  refetchMs,
  onScopeDrill,
  onHide,
}: {
  report: ReportKey;
  label: string;
  drillParams: string[];
  scope: Scope;
  refetchMs: number | false;
  /** Sessions rows narrow the whole dashboard (instance → source → campaign). */
  onScopeDrill?: (level: string, value: string, label: string) => void;
  onHide: () => void;
}) {
  const [settings, setSettings] = useStoredState<TableSettings>(`table:${report}`, DEFAULT_SETTINGS);
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const update = (patch: Partial<TableSettings>) => setSettings({ ...s, ...patch });

  const [drill, setDrill] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey[]>(DEFAULT_SORT);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 400);

  // New scope → start again from the first page of the top level.
  const scopeKey = JSON.stringify(scope);
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey);
  if (scopeKey !== prevScopeKey) {
    setPrevScopeKey(scopeKey);
    setPage(1);
    setDrill({});
  }

  const query = useReport(
    report,
    scope,
    {
      drill,
      rates: s.rates,
      rules: s.rules,
      search,
      startswith: s.startswith,
      sort: sort.map((k) => `${k.col}:${k.dir}`).join(","),
      page,
      limit: s.limit,
    },
    refetchMs,
  );
  const data = query.data;
  const headers = data?.headers ?? [];
  const allRow = data?.all ?? null;

  const iRequests = headers.indexOf("Requests");
  const iSuspect = headers.indexOf("Suspect");
  const canShare = iRequests > 0 && iSuspect > 0;
  const visible = headers.map((h, i) => ({ h, i })).filter(({ h, i }) => i === 0 || !s.hidden.includes(h));

  const depth = Object.keys(drill).length;
  const firstHeader = headers[0] ?? "";
  const sessionLevel = report === "sessions" ? firstHeader.toLowerCase() : "";
  const canDrill =
    report === "sessions"
      ? ["instance", "source", "campaign"].includes(sessionLevel) && !(sessionLevel === "campaign" && scope.campaign)
      : depth < drillParams.length - 1;

  const title = report === "sessions" && firstHeader ? `Traffic by ${firstHeader.toLowerCase()}` : label;

  const onHeaderClick = (col: number, e: React.MouseEvent) => {
    const existing = sort.find((k) => k.col === col);
    const dir: SortKey["dir"] = existing ? (existing.dir === "desc" ? "asc" : "desc") : col === 0 ? "asc" : "desc";
    if (e.shiftKey) {
      // Multi-column sort (Anura allows up to three).
      const others = sort.filter((k) => k.col !== col);
      setSort(existing ? sort.map((k) => (k.col === col ? { col, dir } : k)) : [...others, { col, dir }].slice(-3));
    } else {
      setSort([{ col, dir }]);
    }
    setPage(1);
  };

  const onRowClick = (key: string, cellLabel: Cell) => {
    if (!canDrill || !key) return;
    if (report === "sessions") {
      onScopeDrill?.(sessionLevel, key, String(cellLabel ?? key));
      return;
    }
    setDrill({ ...drill, [drillParams[depth]]: key });
    setPage(1);
    setSearchInput("");
  };

  const crumbTo = (level: number) => {
    setDrill(Object.fromEntries(drillParams.slice(0, level).map((p) => [p, drill[p]])));
    setPage(1);
    setSearchInput("");
  };

  const renderCell = (value: Cell, header: string) => {
    if (typeof value === "number" && /rate$/i.test(header)) return `${value.toFixed(2)}%`;
    return formatCell(value);
  };

  const exportCsv = () => {
    if (!data) return;
    const cols = visible.map((v) => v.h);
    const rows = [
      ...(allRow ? [visible.map((v) => allRow[v.i])] : []),
      ...data.rows.map((r) => visible.map((v) => r.cells[v.i])),
    ];
    const suffix = Object.values(drill).join("-");
    downloadCsv(`${report}${suffix ? `-${suffix}` : ""}-${scope.start}_${scope.end}.csv`, cols, rows);
  };

  const pag = data?.pagination;
  const from = pag && pag.results ? (pag.page - 1) * pag.limit + 1 : 0;
  const to = pag ? Math.min(pag.page * pag.limit, pag.results) : 0;
  const showShare = s.share && canShare;

  return (
    <Card className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            {title}
            {query.isFetching && <Spinner className="size-3.5" />}
          </h2>
          {report !== "sessions" && drillParams.length > 1 && (
            <nav aria-label="Drill-down path" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
              <button className={clsx(depth && "text-accent hover:underline")} disabled={!depth} onClick={() => crumbTo(0)}>
                {ROOT_LABEL[report] ?? "All"}
              </button>
              {drillParams.slice(0, depth).map((p, i) => (
                <span key={p} className="flex items-center gap-1">
                  <ChevronRight className="size-3" aria-hidden />
                  <button
                    className={clsx(i < depth - 1 && "text-accent hover:underline")}
                    disabled={i === depth - 1}
                    onClick={() => crumbTo(i + 1)}
                  >
                    {drill[p]}
                  </button>
                </span>
              ))}
            </nav>
          )}
          {report === "sessions" && canDrill && <div className="mt-1 text-xs text-muted">Click a row to filter the whole dashboard</div>}
        </div>

        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder={`Search ${firstHeader.toLowerCase() || "rows"}`}
              aria-label={`Search ${title}`}
              className="h-8 w-40 rounded-lg border border-line-strong bg-surface pr-7 pl-8 text-[13px] placeholder:text-muted focus:border-accent focus:outline-none"
            />
            {searchInput && (
              <button
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-ink"
                onClick={() => {
                  setSearchInput("");
                  setPage(1);
                }}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Popover
            trigger={({ toggle, open }) => (
              <IconButton label="Columns and options" onClick={toggle} active={open}>
                <Columns3 className="size-4" />
              </IconButton>
            )}
            className="w-64"
          >
            <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted">Columns</div>
            <div className="scroll-thin max-h-60 overflow-y-auto">
              {headers.slice(1).map((h) => (
                <Checkbox
                  key={h}
                  label={h}
                  checked={!s.hidden.includes(h)}
                  onChange={(on) => update({ hidden: on ? s.hidden.filter((x) => x !== h) : [...s.hidden, h] })}
                />
              ))}
              {canShare && <Checkbox label={SHARE_COLUMN} checked={s.share} onChange={(share) => update({ share })} />}
            </div>
            <div className="mt-1.5 flex flex-col gap-3 border-t border-line px-2 pt-3 pb-2">
              <Switch
                checked={s.rates}
                onChange={(rates) => {
                  update({ rates });
                  setSort(DEFAULT_SORT);
                }}
                label="Rate columns"
                description="Adds % columns from Anura"
              />
              <Switch
                checked={s.rules}
                onChange={(rules) => {
                  update({ rules });
                  setSort(DEFAULT_SORT);
                }}
                label="Rule set columns"
                description="Which rules flagged the traffic"
              />
              <Switch
                checked={s.startswith}
                onChange={(startswith) => update({ startswith })}
                label="Search matches start"
                description="Otherwise matches anywhere"
              />
              {s.hidden.length > 0 && (
                <button className="self-start text-xs text-accent hover:underline" onClick={() => update({ hidden: [] })}>
                  Show all columns
                </button>
              )}
            </div>
          </Popover>

          <IconButton label="Download visible rows as CSV" onClick={exportCsv} disabled={!data?.rows.length}>
            <Download className="size-4" />
          </IconButton>
          <IconButton label="Hide this table" onClick={onHide}>
            <EyeOff className="size-4" />
          </IconButton>
        </div>
      </div>

      {query.error ? (
        <div className="px-4 pb-4">
          <Alert tone="error">{(query.error as Error).message}</Alert>
        </div>
      ) : (
        <div className="scroll-thin min-w-0 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-xs text-ink-2">
                {visible.map(({ h, i }) => {
                  const col = i;
                  const sortIndex = sort.findIndex((k) => k.col === col);
                  const active = sortIndex >= 0 ? sort[sortIndex] : null;
                  return (
                    <th
                      key={h}
                      scope="col"
                      aria-sort={active ? (active.dir === "asc" ? "ascending" : "descending") : "none"}
                      className={clsx("px-3 py-2 font-medium whitespace-nowrap", i === 0 ? "text-left" : "text-right")}
                    >
                      <button
                        className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
                        onClick={(e) => onHeaderClick(col, e)}
                        title="Click to sort, shift-click to add a secondary sort"
                      >
                        {h}
                        {active &&
                          (active.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                        {active && sort.length > 1 && <span className="text-[10px] text-muted">{sortIndex + 1}</span>}
                      </button>
                    </th>
                  );
                })}
                {showShare && <th className="w-32 px-3 py-2 text-left font-medium whitespace-nowrap">{SHARE_COLUMN}</th>}
              </tr>
            </thead>
            <tbody className="tabular">
              {!data && query.isLoading &&
                Array.from({ length: 5 }, (_, r) => (
                  <tr key={r} className="border-b border-line">
                    <td colSpan={99} className="px-3 py-2.5">
                      <div className="h-3 animate-pulse rounded bg-surface-2" style={{ width: `${70 - r * 8}%` }} />
                    </td>
                  </tr>
                ))}

              {allRow && page === 1 && !search && (
                <tr className="border-b border-line bg-surface-2/50 font-medium">
                  {visible.map(({ h, i }) => (
                    <td key={h} className={clsx("px-3 py-2 whitespace-nowrap", i > 0 && "text-right")}>
                      {i === 0 ? (typeof allRow[0] === "string" ? allRow[0] : "All") : renderCell(allRow[i], h)}
                    </td>
                  ))}
                  {showShare && <ShareCell part={Number(allRow[iSuspect] ?? 0)} whole={Number(allRow[iRequests] ?? 0)} />}
                </tr>
              )}

              {data?.rows.map((row) => (
                <tr
                  key={row.key || JSON.stringify(row.cells)}
                  onClick={() => onRowClick(row.key, row.cells[0])}
                  className={clsx(
                    "border-b border-line last:border-b-0",
                    canDrill ? "cursor-pointer hover:bg-accent-soft" : "hover:bg-surface-2/60",
                  )}
                >
                  {visible.map(({ h, i }) => (
                    <td
                      key={h}
                      className={clsx(
                        "px-3 py-2 whitespace-nowrap",
                        i === 0 ? "max-w-72 truncate text-left" : "text-right",
                        i === 0 && canDrill && "text-accent",
                      )}
                      title={i === 0 ? String(row.cells[0] ?? "") : undefined}
                    >
                      {renderCell(row.cells[i], h)}
                    </td>
                  ))}
                  {showShare && <ShareCell part={Number(row.cells[iSuspect] ?? 0)} whole={Number(row.cells[iRequests] ?? 0)} />}
                </tr>
              ))}

              {data && !data.rows.length && (
                <tr>
                  <td colSpan={99} className="px-3 py-8 text-center text-muted">
                    {search ? `Nothing matches “${search}”` : "No traffic in this range"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pag && pag.results > 0 && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted">
          <span className="tabular">
            {formatInt(from)}–{formatInt(to)} of {formatInt(pag.results)}
          </span>
          <div className="flex items-center gap-1">
            <Select
              aria-label="Rows per page"
              className="h-7 w-auto py-0 pr-7 pl-2 text-xs"
              value={s.limit}
              onChange={(e) => {
                update({ limit: Number(e.target.value) });
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </Select>
            <IconButton label="Previous page" disabled={pag.page <= 1} onClick={() => setPage(pag.page - 1)}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="tabular px-1 whitespace-nowrap">
              {pag.page} / {pag.pages}
            </span>
            <IconButton label="Next page" disabled={pag.page >= pag.pages} onClick={() => setPage(pag.page + 1)}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Suspect share of requests as a thin meter with the value beside it. */
function ShareCell({ part, whole }: { part: number; whole: number }) {
  const pct = whole > 0 ? (part / whole) * 100 : 0;
  return (
    <td className="px-3 py-2">
      <div className="flex items-center gap-2" title={`${formatInt(part)} of ${formatInt(whole)} suspect`}>
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-series-2" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="w-12 text-right text-ink-2">{formatPct(part, whole)}</span>
      </div>
    </td>
  );
}
