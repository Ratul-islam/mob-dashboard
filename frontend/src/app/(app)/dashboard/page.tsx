"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { useMeta, useOverview, useTrend } from "@/lib/queries";
import { useStoredState } from "@/lib/useStoredState";
import { addDays, presetRange, todayUtc } from "@/lib/dates";
import { formatRelative } from "@/lib/format";
import type { ReportKey, Scope } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, Select, Spinner } from "@/components/ui";
import { DashboardFilters, FilterBar } from "@/components/dashboard/FilterBar";
import { KpiTiles } from "@/components/dashboard/KpiTiles";
import { ReportTable } from "@/components/dashboard/ReportTable";
import { CustomizeDialog, PanelState } from "@/components/dashboard/CustomizeDialog";
import { StackedBars } from "@/components/charts/StackedBars";

const PANEL_INFO: Record<string, { label: string; description: string }> = {
  kpis: { label: "Summary tiles", description: "Requests, suspect, non-suspect, mobile" },
  trend: { label: "Daily trend", description: "Suspect vs non-suspect per day" },
  sessions: { label: "Sources & campaigns", description: "Instance → source → campaign; click to filter" },
  geography: { label: "Geography", description: "Country → region → city" },
  networks: { label: "Networks", description: "ISP / network" },
  connections: { label: "Connections", description: "Connection type" },
  "device-types": { label: "Device types", description: "Desktop, mobile, bot…" },
  devices: { label: "Devices", description: "Manufacturer → model" },
  browsers: { label: "Browsers", description: "Browser → version" },
  "operating-systems": { label: "Operating systems", description: "OS → version" },
};

const DEFAULT_PANELS: PanelState[] = Object.keys(PANEL_INFO).map((id) => ({ id, visible: true }));
const WIDE_PANELS = new Set(["kpis", "trend", "sessions"]);

const REFRESH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
];

type TrendRange = "filters" | "14" | "31";

export default function DashboardPage() {
  const meta = useMeta();
  const queryClient = useQueryClient();
  const today = todayUtc();

  const [filters, setFilters, { loaded: filtersLoaded }] = useStoredState<DashboardFilters>("filters", {
    preset: "today",
    ...presetRange("today"),
    instance: "",
    source: "",
    campaign: "",
  });
  const [storedPanels, setPanels, { reset: resetPanels }] = useStoredState<PanelState[]>("panels", DEFAULT_PANELS);
  const [refreshSeconds, setRefreshSeconds] = useStoredState<number>("refresh", 30);
  const [trendRange, setTrendRange] = useStoredState<TrendRange>("trend-range", "14");
  const [customizing, setCustomizing] = useState(false);
  const [scopeLabels, setScopeLabels] = useState<Record<string, string>>({});
  const [, forceTick] = useState(0);

  // Relative presets ("Today", "Last 7 days") always resolve against the current UTC day.
  useEffect(() => {
    if (!filtersLoaded) return;
    if (filters.preset !== "custom") {
      const range = presetRange(filters.preset, today);
      if (range.start !== filters.start || range.end !== filters.end) setFilters({ ...filters, ...range });
    }
  }, [filtersLoaded, filters, today, setFilters]);

  // Default to the instance configured on the server.
  useEffect(() => {
    if (filtersLoaded && !filters.instance && meta.data) {
      setFilters({ ...filters, instance: meta.data.defaultInstance ?? "All Instances" });
    }
  }, [filtersLoaded, filters, meta.data, setFilters]);

  // Tick every 5s so "updated Xs ago" stays current.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Keep panels added in later versions visible after a stored layout loads.
  const panels = useMemo(() => {
    const known = storedPanels.filter((p) => PANEL_INFO[p.id]);
    const missing = DEFAULT_PANELS.filter((d) => !known.some((p) => p.id === d.id));
    return [...known, ...missing];
  }, [storedPanels]);

  const ready = filtersLoaded && Boolean(filters.instance);
  const scope: Scope = {
    start: filters.start,
    end: filters.end,
    instance: filters.instance || undefined,
    source: filters.source || undefined,
    campaign: filters.campaign || undefined,
  };
  const trendScope: Scope =
    trendRange === "filters" ? scope : { ...scope, start: addDays(today, -(Number(trendRange) - 1)), end: today };

  const refetchMs = refreshSeconds > 0 ? refreshSeconds * 1000 : false;
  const overview = useOverview(scope, ready && refetchMs);
  const trend = useTrend(trendScope, ready && refetchMs);

  const includesToday = filters.end === today;
  const live = refreshSeconds > 0 && includesToday;
  const lastUpdated = overview.dataUpdatedAt || null;

  const hidePanel = (id: string) => setPanels(panels.map((p) => (p.id === id ? { ...p, visible: false } : p)));

  const onScopeDrill = (level: string, value: string, label: string) => {
    if (level === "instance") setFilters({ ...filters, instance: value, source: "", campaign: "" });
    if (level === "source") setFilters({ ...filters, source: value, campaign: "" });
    if (level === "campaign") setFilters({ ...filters, campaign: value });
    setScopeLabels((l) => ({ ...l, [`${level}:${value}`]: label }));
  };

  const hiddenCount = panels.filter((p) => !p.visible).length;
  const reportInfo = (id: string) => meta.data?.reports.find((r) => r.key === id);

  if (meta.data && !meta.data.configured) {
    return (
      <>
        <PageHeader title="Live dashboard" />
        <Alert tone="warning" title="Anura API is not configured">
          Set <code>ANURA_API_TOKEN</code> and <code>ANURA_INSTANCE_ID</code> in the backend <code>.env</code> and restart the API.
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Live dashboard"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-good-ink">
                <span className="live-dot size-2 rounded-full bg-good" aria-hidden />
                Live
              </span>
            ) : (
              <span>{refreshSeconds === 0 ? "Auto-refresh off" : "Historical range"}</span>
            )}
            <span aria-hidden>·</span>
            <span>Updated {formatRelative(lastUpdated)}</span>
            <span aria-hidden>·</span>
            <span>Source: Anura Direct reporting API (UTC)</span>
          </span>
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Refresh
              <Select
                className="h-8 w-24 text-[13px]"
                value={refreshSeconds}
                onChange={(e) => setRefreshSeconds(Number(e.target.value))}
                aria-label="Auto-refresh interval"
              >
                {REFRESH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              size="sm"
              icon={<RefreshCw className={clsx("size-4", overview.isFetching && "animate-spin")} />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ["anura"] })}
            >
              Refresh now
            </Button>
            <Button size="sm" icon={<SlidersHorizontal className="size-4" />} onClick={() => setCustomizing(true)}>
              Customize
              {hiddenCount > 0 && <Badge tone="accent">{hiddenCount} hidden</Badge>}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <FilterBar filters={filters} onChange={setFilters} maxDays={meta.data?.limits.tableDays ?? 7} />

        {(filters.source || filters.campaign) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Filtered to</span>
            {filters.source && (
              <ScopeChip
                label={`Source ${scopeLabels[`source:${filters.source}`] ?? filters.source}`}
                onClear={() => setFilters({ ...filters, source: "", campaign: "" })}
              />
            )}
            {filters.campaign && (
              <ScopeChip
                label={`Campaign ${scopeLabels[`campaign:${filters.campaign}`] ?? filters.campaign}`}
                onClear={() => setFilters({ ...filters, campaign: "" })}
              />
            )}
          </div>
        )}

        {overview.error && <Alert tone="error">{(overview.error as Error).message}</Alert>}

        {!ready ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {panels
              .filter((p) => p.visible)
              .map((p) => {
                const wide = WIDE_PANELS.has(p.id);
                const cls = wide ? "xl:col-span-2" : undefined;

                if (p.id === "kpis") {
                  return (
                    <div key={p.id} className={cls}>
                      <KpiTiles totals={overview.data} loading={overview.isLoading} />
                    </div>
                  );
                }

                if (p.id === "trend") {
                  const points = (trend.data ?? []).map((d) => ({ key: d.date, nonsuspect: d.nonsuspect, suspect: d.suspect }));
                  return (
                    <Card key={p.id} className={cls}>
                      <CardHeader
                        title={
                          <span className="flex items-center gap-2">
                            Daily trend {trend.isFetching && <Spinner className="size-3.5" />}
                          </span>
                        }
                        subtitle="Requests per UTC day, stacked by result"
                        actions={
                          <Select
                            className="h-8 w-40 text-[13px]"
                            value={trendRange}
                            onChange={(e) => setTrendRange(e.target.value as TrendRange)}
                            aria-label="Trend range"
                          >
                            <option value="filters">Same as filters</option>
                            <option value="14">Last 14 days</option>
                            <option value="31">Last 31 days</option>
                          </Select>
                        }
                      />
                      <div className="px-4 pb-4">
                        {trend.error ? (
                          <Alert tone="error">{(trend.error as Error).message}</Alert>
                        ) : (
                          <StackedBars
                            data={points}
                            tickFormatter={(d) => d.slice(5)}
                            labelFormatter={(d) =>
                              new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              })
                            }
                          />
                        )}
                      </div>
                    </Card>
                  );
                }

                const info = reportInfo(p.id);
                return (
                  <div key={p.id} className={clsx("min-w-0", cls)}>
                    <ReportTable
                      report={p.id as ReportKey}
                      label={PANEL_INFO[p.id].label}
                      drillParams={info?.drill ?? []}
                      scope={scope}
                      refetchMs={refetchMs}
                      onScopeDrill={p.id === "sessions" ? onScopeDrill : undefined}
                      onHide={() => hidePanel(p.id)}
                    />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <CustomizeDialog
        open={customizing}
        onClose={() => setCustomizing(false)}
        panels={panels}
        labels={PANEL_INFO}
        onChange={setPanels}
        onReset={resetPanels}
      />
    </>
  );
}

function ScopeChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface py-0.5 pr-1 pl-2.5 text-[13px]">
      {label}
      <button aria-label={`Remove ${label}`} className="rounded-full p-0.5 text-muted hover:bg-surface-2 hover:text-ink" onClick={onClear}>
        <X className="size-3.5" />
      </button>
    </span>
  );
}
