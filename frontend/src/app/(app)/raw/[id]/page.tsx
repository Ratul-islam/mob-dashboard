"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Download,
  FilterX,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useRawActions, useRawFacets, useRawReport, useRawRows } from "@/lib/rawQueries";
import { useStoredState } from "@/lib/useStoredState";
import { useDebounced } from "@/lib/useDebounced";
import { errorMessage } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatAnuraDate, formatCell, formatInt, formatUtc, humanizeColumn } from "@/lib/format";
import type { RawRow, RowFilter, RowValue } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { StackedBars } from "@/components/charts/StackedBars";
import { FacetPanel } from "@/components/raw/FacetPanel";
import { QuickFilters } from "@/components/raw/QuickFilters";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  IconButton,
  Input,
  Popover,
  Select,
  Spinner,
  toast,
} from "@/components/ui";

const DEFAULT_HIDDEN = [
  "browser_version",
  "os_version",
  "device_manufacturer",
  "device_model",
  "app_id",
  "device_id",
  "requesting_remote_address",
  "requesting_user_agent",
  "additional_data_01",
  "additional_data_02",
  "additional_data_03",
];

const OPERATORS: { value: string; label: string; noValue?: boolean }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "empty", label: "is empty", noValue: true },
  { value: "not_empty", label: "is not empty", noValue: true },
  { value: "gte", label: "on or after" },
  { value: "lte", label: "on or before" },
];

const filterLabel = (f: RowFilter) => {
  const op = f.operator === "in" ? "is" : f.operator === "not_in" ? "is not" : (OPERATORS.find((o) => o.value === f.operator)?.label ?? f.operator);
  const value = Array.isArray(f.value) ? f.value.join(", ") : (f.value ?? "");
  return `${humanizeColumn(f.column)} ${op}${value ? ` ${f.column === "timestamp" ? formatUtc(value) : value}` : ""}`;
};

function CellValue({ column, value }: { column: string; value: RowValue }) {
  if (column === "result" && typeof value === "string") {
    return value === "suspect" ? (
      <Badge tone="series2">
        <AlertTriangle className="size-3" aria-hidden /> suspect
      </Badge>
    ) : (
      <Badge tone="series1">
        <CheckCircle2 className="size-3" aria-hidden /> {value}
      </Badge>
    );
  }
  if (column === "timestamp") return <span className="tabular">{formatUtc(value as string)}</span>;
  return <>{formatCell(value)}</>;
}

export default function RawReportPage() {
  const { id } = useParams<{ id: string }>();
  const report = useRawReport(id);
  const actions = useRawActions();

  const [hidden, setHidden] = useStoredState<string[]>("raw-hidden-columns", DEFAULT_HIDDEN);
  const [limit, setLimit] = useStoredState<number>("raw-page-size", 50);
  const [breakdownCollapsed, setBreakdownCollapsed] = useStoredState<boolean>("raw-breakdown-collapsed", false);
  const [chartCollapsed, setChartCollapsed] = useStoredState<boolean>("raw-chart-collapsed", false);
  const rowsScroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ column: string; dir: "asc" | "desc" }>({ column: "timestamp", dir: "desc" });
  const [searchInput, setSearchInput] = useState("");
  const q = useDebounced(searchInput.trim(), 400);
  const [filters, setFiltersState] = useState<RowFilter[]>([]);
  const [selected, setSelected] = useState<RawRow | null>(null);

  const imported = report.data?.import?.status === "ready";
  const rowsQuery = { page, limit, sort: sort.column, dir: sort.dir, q, filters };
  const rows = useRawRows(id, rowsQuery, imported);
  const facets = useRawFacets(id, { q, filters }, imported);

  // New page/sort/filter: show the first rows instead of keeping the old scroll position.
  useEffect(() => {
    rowsScroller.current?.scrollTo({ top: 0 });
  }, [page, limit, sort, q, filters]);

  const setFilters = (next: RowFilter[]) => {
    setFiltersState(next);
    setPage(1);
  };

  const columns = rows.data?.columns ?? report.data?.import?.columns ?? [];
  const visibleColumns = columns.filter((c) => !hidden.includes(c));

  const onSort = (column: string) => {
    setSort((s) => (s.column === column ? { column, dir: s.dir === "asc" ? "desc" : "asc" } : { column, dir: column === "timestamp" ? "desc" : "asc" }));
    setPage(1);
  };

  const exportCsv = () => {
    if (!rows.data) return;
    downloadCsv(
      `raw-${id}-page${page}.csv`,
      visibleColumns.map(humanizeColumn),
      rows.data.rows.map((r) => visibleColumns.map((c) => r[c])),
    );
  };

  if (report.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (report.error || !report.data) {
    return (
      <>
        <BackLink />
        <Alert tone="error">{errorMessage(report.error) || "Report not found"}</Alert>
      </>
    );
  }

  const r = report.data;
  const pag = rows.data?.pagination;

  return (
    <>
      <BackLink />
      <PageHeader
        title={r.name}
        description={
          <span>
            {formatAnuraDate(r.start)} → {formatAnuraDate(r.end)} (UTC) · {r.instance_name} · {r.type}
            {r.import?.status === "ready" && <> · {formatInt(r.import.rows)} rows imported {r.import.importedAt ? formatUtc(r.import.importedAt) : ""}</>}
          </span>
        }
        actions={
          r.status === "Ready" &&
          r.import?.status !== "importing" && (
            <Button
              size="sm"
              loading={actions.importReport.isPending}
              onClick={() =>
                actions.importReport
                  .mutateAsync(id)
                  .then(() => toast.success("Import started"))
                  .catch((e) => toast.error(errorMessage(e)))
              }
            >
              {r.import ? "Re-import" : "Import rows"}
            </Button>
          )
        }
      />

      {!imported ? (
        <Card className="p-6">
          {r.import?.status === "importing" || (r.autoImport && r.status === "Ready") ? (
            <div className="flex items-center gap-3 text-sm">
              <Spinner className="size-5" /> Importing rows from Anura… this page updates automatically.
            </div>
          ) : r.status !== "Ready" ? (
            <div className="flex items-center gap-3 text-sm">
              <Spinner className="size-5" /> Anura is generating this report ({r.status}).
              {r.autoImport && " It will be imported automatically."}
            </div>
          ) : r.import?.status === "failed" ? (
            <Alert tone="error" title="Import failed">
              {r.import.error}
            </Alert>
          ) : (
            <div className="text-sm text-ink-2">This report hasn&apos;t been imported yet. Import it to explore the rows.</div>
          )}
        </Card>
      ) : (
        <div
          className={clsx(
            "grid gap-4",
            breakdownCollapsed ? "xl:grid-cols-[48px_minmax(0,1fr)]" : "xl:grid-cols-[280px_minmax(0,1fr)]",
          )}
        >
          <div className="order-2 xl:order-1">
            <FacetPanel
              facets={facets.data}
              loading={facets.isFetching}
              filters={filters}
              onFiltersChange={setFilters}
              collapsed={breakdownCollapsed}
              onCollapsedChange={setBreakdownCollapsed}
            />
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
            {facets.data && facets.data.timeline.length > 1 && (
              <Card>
                <CardHeader
                  className={clsx(chartCollapsed && "pb-4")}
                  title="Requests per hour"
                  subtitle={`${formatInt(facets.data.total)} matching rows · UTC`}
                  actions={
                    <IconButton
                      label={chartCollapsed ? "Show chart" : "Hide chart"}
                      aria-expanded={!chartCollapsed}
                      onClick={() => setChartCollapsed(!chartCollapsed)}
                    >
                      <ChevronUp className={clsx("size-4 transition-transform", chartCollapsed && "rotate-180")} />
                    </IconButton>
                  }
                />
                {!chartCollapsed && (
                  <div className="px-4 pb-4">
                    <StackedBars
                      height={180}
                      tableKeyLabel="Hour (UTC)"
                      data={facets.data.timeline.map((t) => ({ key: t.hour, nonsuspect: t.nonsuspect, suspect: t.suspect }))}
                      tickFormatter={(h) => (h.slice(11, 13) === "00" ? h.slice(5, 10) : h.slice(11, 16))}
                      labelFormatter={(h) => formatUtc(h)}
                    />
                  </div>
                )}
              </Card>
            )}

            <Card className="sticky top-[68px] flex max-h-[calc(100dvh-88px)] min-w-0 flex-col lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
              <div className="shrink-0 px-4 pt-4">
                <QuickFilters reportId={id} columns={columns} filters={filters} onFiltersChange={setFilters} />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3 pb-3">
                <div className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search IP, network, user agent, city, device ID…"
                    aria-label="Search rows"
                    className="pl-9"
                  />
                </div>
                <AddFilter columns={columns} onAdd={(f) => setFilters([...filters, f])} />
                <Popover
                  trigger={({ toggle, open }) => (
                    <Button size="md" icon={<Columns3 className="size-4" />} onClick={toggle} className={clsx(open && "bg-surface-2")}>
                      Columns
                    </Button>
                  )}
                  className="w-64"
                >
                  <div className="flex items-center justify-between px-2 pt-1 pb-1.5 text-xs text-muted">
                    <span className="font-medium">
                      {visibleColumns.length} of {columns.length} shown
                    </span>
                    <span className="flex gap-2">
                      <button className="text-accent hover:underline" onClick={() => setHidden([])}>
                        All
                      </button>
                      <button className="text-accent hover:underline" onClick={() => setHidden(DEFAULT_HIDDEN)}>
                        Default
                      </button>
                    </span>
                  </div>
                  <div className="scroll-thin max-h-80 overflow-y-auto">
                    {columns.map((c) => (
                      <Checkbox
                        key={c}
                        label={humanizeColumn(c)}
                        checked={!hidden.includes(c)}
                        onChange={(on) => setHidden(on ? hidden.filter((h) => h !== c) : [...hidden, c])}
                      />
                    ))}
                  </div>
                </Popover>
                <IconButton label="Download this page as CSV" onClick={exportCsv} disabled={!rows.data?.rows.length}>
                  <Download className="size-4" />
                </IconButton>
              </div>

              {filters.length > 0 && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-4 pb-3">
                  {filters.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs text-accent">
                      {filterLabel(f)}
                      <button
                        aria-label={`Remove filter ${filterLabel(f)}`}
                        className="rounded-full p-0.5 hover:bg-accent-soft"
                        onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <Button size="sm" variant="ghost" icon={<FilterX className="size-3.5" />} onClick={() => setFilters([])}>
                    Clear all
                  </Button>
                </div>
              )}

              {rows.error ? (
                <div className="px-4 pb-4">
                  <Alert tone="error">{errorMessage(rows.error)}</Alert>
                </div>
              ) : (
                <div
                  ref={rowsScroller}
                  className={clsx("scroll-thin min-h-0 flex-1 overflow-auto transition-opacity", rows.isPlaceholderData && "opacity-60")}
                >
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-xs text-ink-2">
                        {visibleColumns.map((c) => (
                          <th
                            key={c}
                            scope="col"
                            aria-sort={sort.column === c ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                            // Pinned while rows scroll; the inset shadows stand in for borders, which don't stick.
                            className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))] px-3 py-2.5 font-semibold whitespace-nowrap text-ink shadow-[inset_0_1px_0_var(--border),inset_0_-1px_0_var(--border)]"
                          >
                            <button className={clsx("inline-flex items-center gap-1 hover:text-ink", sort.column === c && "text-ink")} onClick={() => onSort(c)}>
                              {humanizeColumn(c)}
                              {sort.column === c &&
                                (sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!rows.data &&
                        Array.from({ length: 8 }, (_, i) => (
                          <tr key={i} className="border-b border-line">
                            <td colSpan={99} className="px-3 py-2.5">
                              <div className="h-3 animate-pulse rounded bg-surface-2" style={{ width: `${80 - i * 6}%` }} />
                            </td>
                          </tr>
                        ))}
                      {rows.data?.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-b border-line transition-colors last:border-b-0 even:bg-surface-2/50 hover:bg-accent-soft"
                          onClick={() => setSelected(row)}
                        >
                          {visibleColumns.map((c, i) => (
                            <td
                              key={c}
                              className={clsx(
                                "px-3 py-2.5 whitespace-nowrap",
                                /user_agent|additional/.test(c) ? "max-w-80 truncate" : "max-w-56 truncate",
                                // Result strip: suspect / non-suspect in the chart colors.
                                i === 0 && row.result === "suspect" && "shadow-[inset_3px_0_0_var(--series-2)]",
                                i === 0 && row.result === "non-suspect" && "shadow-[inset_3px_0_0_var(--series-1)]",
                              )}
                              title={typeof row[c] === "string" ? (row[c] as string) : undefined}
                            >
                              <CellValue column={c} value={row[c]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {rows.data && rows.data.rows.length === 0 && (
                        <tr>
                          <td colSpan={99} className="px-3 py-10 text-center text-muted">
                            No rows match these filters
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {pag && (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
                  <span className="tabular">
                    {pag.results ? `${formatInt((pag.page - 1) * pag.limit + 1)}–${formatInt(Math.min(pag.page * pag.limit, pag.results))}` : 0} of{" "}
                    {formatInt(pag.results)}
                    {pag.results !== pag.total && ` (filtered from ${formatInt(pag.total)})`}
                  </span>
                  <div className="flex items-center gap-1">
                    <Select aria-label="Rows per page" className="h-7 w-auto py-0 pr-7 pl-2 text-xs" value={limit} onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {[25, 50, 100, 250].map((n) => (
                        <option key={n} value={n}>
                          {n} / page
                        </option>
                      ))}
                    </Select>
                    <IconButton label="First page" disabled={pag.page <= 1} onClick={() => setPage(1)}>
                      <ChevronLeft className="size-4" />
                      <ChevronLeft className="-ml-3 size-4" />
                    </IconButton>
                    <IconButton label="Previous page" disabled={pag.page <= 1} onClick={() => setPage(pag.page - 1)}>
                      <ChevronLeft className="size-4" />
                    </IconButton>
                    <span className="tabular px-1 whitespace-nowrap">
                      {formatInt(pag.page)} / {formatInt(pag.pages)}
                    </span>
                    <IconButton label="Next page" disabled={pag.page >= pag.pages} onClick={() => setPage(pag.page + 1)}>
                      <ChevronRight className="size-4" />
                    </IconButton>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} wide title="Row details" description={selected ? formatUtc(selected.timestamp as string, true) + " UTC" : undefined}>
        {selected && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
            {columns.map((c) => (
              <div key={c} className="contents">
                <dt className="text-muted">{humanizeColumn(c)}</dt>
                <dd className="font-mono text-[13px] break-all">
                  {c === "result" || c === "timestamp" ? <CellValue column={c} value={selected[c]} /> : formatCell(selected[c])}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/raw" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
      <ArrowLeft className="size-4" /> All raw reports
    </Link>
  );
}

function AddFilter({ columns, onAdd }: { columns: string[]; onAdd: (f: RowFilter) => void }) {
  const [column, setColumn] = useState("");
  const [operator, setOperator] = useState("contains");
  const [value, setValue] = useState("");
  const col = column || columns.find((c) => c !== "timestamp") || "";
  const isTime = col === "timestamp";
  const ops = OPERATORS.filter((o) => (isTime ? ["gte", "lte", "empty", "not_empty"].includes(o.value) : !["gte", "lte"].includes(o.value)));
  const op = ops.some((o) => o.value === operator) ? operator : ops[0].value;
  const noValue = OPERATORS.find((o) => o.value === op)?.noValue;

  return (
    <Popover
      trigger={({ toggle, open }) => (
        <Button icon={<Plus className="size-4" />} onClick={toggle} className={clsx(open && "bg-surface-2")}>
          Filter
        </Button>
      )}
      className="w-72 p-3"
    >
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!noValue && !value.trim()) return;
            onAdd({
              column: col,
              operator: op,
              value: noValue ? undefined : isTime ? new Date(`${value}Z`).toISOString() : value.trim(),
            });
            setValue("");
            close();
          }}
        >
          <Select aria-label="Column" value={col} onChange={(e) => setColumn(e.target.value)}>
            {columns.map((c) => (
              <option key={c} value={c}>
                {humanizeColumn(c)}
              </option>
            ))}
          </Select>
          <Select aria-label="Condition" value={op} onChange={(e) => setOperator(e.target.value)}>
            {ops.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {!noValue &&
            (isTime ? (
              <Input aria-label="Date and time (UTC)" type="datetime-local" required value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <Input aria-label="Value" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
            ))}
          <Button type="submit" variant="primary" size="sm">
            Apply filter
          </Button>
        </form>
      )}
    </Popover>
  );
}
