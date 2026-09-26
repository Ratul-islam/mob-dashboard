"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Ban, Database, Download, ExternalLink, MoreHorizontal, Plus, RefreshCw, Trash2, X, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMeta } from "@/lib/queries";
import { isReportPending, useRawActions, useRawReports } from "@/lib/rawQueries";
import { useStoredState } from "@/lib/useStoredState";
import { addDays, todayUtc } from "@/lib/dates";
import { errorMessage } from "@/lib/api";
import { formatInt, formatRelative, formatUtc, humanizeColumn } from "@/lib/format";
import type { RawReportSummary, RowFilter } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Popover,
  Select,
  Spinner,
  Switch,
  toast,
} from "@/components/ui";

const OPERATOR_LABELS: Record<string, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  empty: "is empty",
  not_empty: "is not empty",
};

interface AutoSync {
  enabled: boolean;
  minutes: number;
  lastRun: number | null;
}

export default function RawReportsPage() {
  const { user } = useAuth();
  const meta = useMeta();
  const reports = useRawReports();
  const actions = useRawActions();
  const [requestOpen, setRequestOpen] = useState(false);
  const [autoSync, setAutoSync] = useStoredState<AutoSync>("raw-autosync", { enabled: false, minutes: 30, lastRun: null });
  const [now, setNow] = useState(() => Date.now());

  const requestToday = async (quiet = false) => {
    const today = todayUtc();
    try {
      await actions.request.mutateAsync({ start: today, end: today, name: `Live sync ${formatUtc(new Date().toISOString())} UTC` });
      setAutoSync((s) => ({ ...s, lastRun: Date.now() }));
      if (!quiet) toast.success("Requested today's rows. They'll be imported automatically when Anura finishes.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // While this page is open, request a fresh "today" report on the chosen interval.
  useEffect(() => {
    if (!autoSync.enabled) return;
    const check = () => {
      setNow(Date.now());
      const due = !autoSync.lastRun || Date.now() - autoSync.lastRun >= autoSync.minutes * 60_000;
      if (due && !actions.request.isPending) requestToday(true);
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync.enabled, autoSync.minutes, autoSync.lastRun]);

  const limits = reports.data?.limits;
  const nextSync = autoSync.enabled && autoSync.lastRun ? autoSync.lastRun + autoSync.minutes * 60_000 : null;

  return (
    <>
      <PageHeader
        title="Raw data"
        description="Row-level traffic (IP, user agent, device, rule sets…) from Anura raw data reports, imported for filtering and sorting."
        actions={
          <>
            <Button size="sm" icon={<Zap className="size-4" />} loading={actions.request.isPending} onClick={() => requestToday()}>
              Fetch today&apos;s rows
            </Button>
            <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setRequestOpen(true)}>
              New report
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <Alert tone="info" title="How row-level data works">
          Anura doesn&apos;t stream individual rows. Row data comes from raw data reports that Anura builds on request, usually within
          seconds. New reports are imported automatically when they&apos;re ready. Each report uses at least one of your daily
          processing minutes.
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <div className="text-[13px] text-ink-2">Processing minutes left today</div>
            {limits ? (
              <>
                <div className="mt-2 text-[28px] leading-none font-semibold tracking-tight">
                  {formatInt(limits.minutes_available)}
                  <span className="text-base font-normal text-muted"> / {formatInt(limits.minutes_total)}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(limits.minutes_available / Math.max(1, limits.minutes_total)) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-2 text-muted">–</div>
            )}
          </Card>
          <Card className="flex flex-col gap-3 p-4">
            <Switch
              checked={autoSync.enabled}
              onChange={(enabled) => setAutoSync({ ...autoSync, enabled })}
              label="Keep today's rows fresh"
              description="While this page is open, requests a new report for today on an interval."
            />
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              Every
              <Select
                className="h-8 w-28 text-[13px]"
                value={autoSync.minutes}
                onChange={(e) => setAutoSync({ ...autoSync, minutes: Number(e.target.value) })}
                aria-label="Sync interval"
              >
                {[15, 30, 60, 120].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </option>
                ))}
              </Select>
              {nextSync && (
                <span className="text-muted">
                  · last {formatRelative(autoSync.lastRun)}, next in {Math.max(0, Math.round((nextSync - now) / 60_000))} min
                </span>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Reports {reports.isFetching && <Spinner className="size-3.5" />}
              </span>
            }
            subtitle="Reports generated by anyone on this Anura account. Anura keeps them for about 30 days."
            actions={
              <IconButton label="Refresh list" onClick={() => reports.refetch()}>
                <RefreshCw className="size-4" />
              </IconButton>
            }
          />
          {reports.error ? (
            <div className="px-4 pb-4">
              <Alert tone="error">{errorMessage(reports.error)}</Alert>
            </div>
          ) : !reports.data ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6" />
            </div>
          ) : reports.data.reports.length === 0 ? (
            <EmptyState icon={<Database className="size-8" />} title="No raw reports yet">
              Fetch today&apos;s rows or create a report for a date range.
            </EmptyState>
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-left text-xs text-ink-2">
                    <th className="px-4 py-2 font-medium">Report</th>
                    <th className="px-3 py-2 font-medium">Requested (UTC)</th>
                    <th className="px-3 py-2 font-medium">Anura status</th>
                    <th className="px-3 py-2 font-medium">In dashboard</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {reports.data.reports.map((r) => (
                    <ReportRow key={r.id} report={r} isRoot={user?.role === "root"} actions={actions} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <RequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        maxAgeDays={meta.data?.limits.rawMaxAgeDays ?? 90}
        columns={meta.data?.rawColumns.filter((c) => c !== "timestamp") ?? []}
        operators={meta.data?.rawFilterOperators ?? Object.keys(OPERATOR_LABELS)}
        onSubmit={async (body) => {
          await actions.request.mutateAsync(body);
          toast.success("Report requested. It will be imported automatically when ready.");
          setRequestOpen(false);
        }}
      />
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Ready") return <Badge tone="good">Ready</Badge>;
  if (isReportPending(status))
    return (
      <Badge tone="accent">
        <Spinner className="size-3 text-accent" /> {status}
      </Badge>
    );
  if (["Failed", "Timed Out"].includes(status)) return <Badge tone="critical">{status}</Badge>;
  return <Badge>{status}</Badge>;
}

function ReportRow({
  report: r,
  isRoot,
  actions,
}: {
  report: RawReportSummary;
  isRoot: boolean;
  actions: ReturnType<typeof useRawActions>;
}) {
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const imp = r.import;
  const imported = imp?.status === "ready";

  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-2.5">
        {imported ? (
          <Link href={`/raw/${r.id}`} className="font-medium text-accent hover:underline">
            {r.name}
          </Link>
        ) : (
          <span className="font-medium">{r.name}</span>
        )}
        <div className="text-xs text-muted">
          {r.type} · {r.instance} · <span className="font-mono">{r.id}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{formatUtc(r.requested)}</td>
      <td className="px-3 py-2.5">
        <StatusBadge status={r.status} />
      </td>
      <td className="px-3 py-2.5">
        {imported ? (
          <span className="text-ink-2">{formatInt(imp?.rows)} rows</span>
        ) : imp?.status === "importing" || (r.autoImport && r.status === "Ready") ? (
          <Badge tone="accent">
            <Spinner className="size-3 text-accent" /> Importing
          </Badge>
        ) : r.autoImport ? (
          <span className="text-xs text-muted">Imports when ready</span>
        ) : imp?.status === "failed" ? (
          <span className="text-xs text-critical" title={imp.error ?? undefined}>
            Import failed
          </span>
        ) : (
          <span className="text-xs text-muted">Not imported</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {imported ? (
            <Link
              href={`/raw/${r.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[13px] font-medium hover:bg-surface-2"
            >
              <ExternalLink className="size-3.5" /> Open
            </Link>
          ) : r.status === "Ready" && imp?.status !== "importing" && !r.autoImport ? (
            <Button
              size="sm"
              icon={<Download className="size-3.5" />}
              loading={actions.importReport.isPending && actions.importReport.variables === r.id}
              onClick={() => run(() => actions.importReport.mutateAsync(r.id), "Import started")}
            >
              Import
            </Button>
          ) : null}

          <Popover
            trigger={({ toggle, open }) => (
              <IconButton label="More actions" onClick={toggle} active={open}>
                <MoreHorizontal className="size-4" />
              </IconButton>
            )}
          >
            {(close) => (
              <div className="flex flex-col">
                {isReportPending(r.status) && (
                  <MenuItem icon={<Ban className="size-4" />} onClick={() => (close(), run(() => actions.cancel.mutateAsync(r.id), "Report cancelled"))}>
                    Cancel report
                  </MenuItem>
                )}
                {r.status === "Ready" && imp && imp.status !== "importing" && (
                  <MenuItem
                    icon={<RefreshCw className="size-4" />}
                    onClick={() => (close(), run(() => actions.importReport.mutateAsync(r.id), "Re-import started"))}
                  >
                    Re-import
                  </MenuItem>
                )}
                {imp && (
                  <MenuItem
                    icon={<X className="size-4" />}
                    onClick={() => (close(), run(() => actions.deleteImport.mutateAsync(r.id), "Imported rows deleted"))}
                  >
                    Delete imported rows
                  </MenuItem>
                )}
                {isRoot && (
                  <MenuItem
                    danger
                    icon={<Trash2 className="size-4" />}
                    onClick={() => {
                      close();
                      if (confirm(`Delete "${r.name}" from Anura? This can't be undone.`)) {
                        run(() => actions.remove.mutateAsync(r.id), "Report removed from Anura");
                      }
                    }}
                  >
                    Remove from Anura
                  </MenuItem>
                )}
                {!isReportPending(r.status) && !imp && !isRoot && <div className="px-2 py-1.5 text-xs text-muted">No actions</div>}
              </div>
            )}
          </Popover>
        </div>
      </td>
    </tr>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2",
        danger ? "text-critical" : "text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function RequestDialog({
  open,
  onClose,
  onSubmit,
  maxAgeDays,
  columns,
  operators,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { start: string; end: string; name?: string; filters?: RowFilter[] }) => Promise<void>;
  maxAgeDays: number;
  columns: string[];
  operators: string[];
}) {
  const today = todayUtc();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<RowFilter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        start,
        end,
        name: name.trim() || undefined,
        filters: filters.filter((f) => f.column && (f.operator === "empty" || f.operator === "not_empty" || f.value)),
      });
      setFilters([]);
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const quick = (s: string, e: string) => {
    setStart(s);
    setEnd(e);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="New raw data report"
      description="Anura builds a row-level report for the range. It's imported into the dashboard automatically when ready."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="raw-request" loading={busy}>
            Request report
          </Button>
        </>
      }
    >
      <form id="raw-request" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" onClick={() => quick(today, today)}>
            Today
          </Button>
          <Button type="button" size="sm" onClick={() => quick(addDays(today, -1), addDays(today, -1))}>
            Yesterday
          </Button>
          <Button type="button" size="sm" onClick={() => quick(addDays(today, -6), today)}>
            Last 7 days
          </Button>
          <Button type="button" size="sm" onClick={() => quick(addDays(today, -29), today)}>
            Last 30 days
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From (UTC)">
            {(id) => (
              <Input id={id} type="date" required min={addDays(today, -maxAgeDays)} max={end} value={start} onChange={(e) => setStart(e.target.value)} />
            )}
          </Field>
          <Field label="To (UTC)">
            {(id) => <Input id={id} type="date" required min={start} max={today} value={end} onChange={(e) => setEnd(e.target.value)} />}
          </Field>
        </div>
        <Field label="Name (optional)">
          {(id) => <Input id={id} maxLength={200} placeholder="Generated automatically" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">Filters applied by Anura (optional)</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<Plus className="size-4" />}
              onClick={() => setFilters([...filters, { column: "result", operator: "equals", value: "suspect" }])}
            >
              Add filter
            </Button>
          </div>
          {filters.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Column"
                className="w-44"
                value={f.column}
                onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)))}
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {humanizeColumn(c)}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Operator"
                className="w-44"
                value={f.operator}
                onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))}
              >
                {operators.map((o) => (
                  <option key={o} value={o}>
                    {OPERATOR_LABELS[o] ?? o}
                  </option>
                ))}
              </Select>
              {f.operator !== "empty" && f.operator !== "not_empty" && (
                <Input
                  aria-label="Value"
                  className="w-auto min-w-32 flex-1"
                  value={String(f.value ?? "")}
                  onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
              )}
              <IconButton label="Remove filter" onClick={() => setFilters(filters.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </IconButton>
            </div>
          ))}
          {filters.some((f) => f.column === "result") && (
            <p className="text-xs text-muted">Result values: “suspect” or “non-suspect”.</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
