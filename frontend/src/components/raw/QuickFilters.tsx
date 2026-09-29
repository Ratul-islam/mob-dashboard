"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatInt } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import { fetchRawValues, useRawValues, ValueCount } from "@/lib/rawQueries";
import type { RowFilter } from "@/lib/types";
import { Combobox } from "@/components/Combobox";
import { toast } from "@/components/ui";

const PICKABLE = ["in", "equals"];

/** The single value picked for a column, e.g. "10031" (several facet picks show as a list). */
export const pickedValue = (filters: RowFilter[], column: string) => {
  const f = filters.find((x) => x.column === column && PICKABLE.includes(x.operator));
  if (!f) return "";
  return Array.isArray(f.value) ? f.value.join(", ") : (f.value ?? "");
};

const withPick = (filters: RowFilter[], column: string, value: string): RowFilter[] => {
  const rest = filters.filter((f) => !(f.column === column && PICKABLE.includes(f.operator)));
  return value ? [...rest, { column, operator: "in", value: [value] }] : rest;
};

const without = (filters: RowFilter[], ...columns: string[]) => filters.filter((f) => !columns.includes(f.column));

const RESULT_OPTIONS = [
  { value: "", label: "All" },
  { value: "suspect", label: "Suspect", icon: AlertTriangle, swatch: "var(--series-2)" },
  { value: "non-suspect", label: "Non-suspect", icon: CheckCircle2, swatch: "var(--series-1)" },
];

/**
 * Source and campaign pickers for an imported raw report. Picking a campaign without a source
 * also picks the source that sent most of that campaign's rows.
 */
export function QuickFilters({
  reportId,
  columns,
  filters,
  onFiltersChange,
}: {
  reportId: string;
  columns: string[];
  filters: RowFilter[];
  onFiltersChange: (filters: RowFilter[]) => void;
}) {
  const sourceId = useId();
  const campaignId = useId();
  const [sourceSearch, setSourceSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [lookup, setLookup] = useState<{ campaign: string; sources: ValueCount[] } | null>(null);
  const [resolving, setResolving] = useState(false);

  const hasSource = columns.includes("source");
  const hasCampaign = columns.includes("campaign");
  const hasResult = columns.includes("result");
  const result = pickedValue(filters, "result");
  const source = pickedValue(filters, "source");
  const campaign = pickedValue(filters, "campaign");

  // Source options ignore the current source/campaign picks; campaign options follow the source.
  const sources = useRawValues(reportId, "source", without(filters, "source", "campaign"), useDebounced(sourceSearch, 300), hasSource);
  const campaigns = useRawValues(reportId, "campaign", without(filters, "campaign"), useDebounced(campaignSearch, 300), hasCampaign);

  const setSource = (value: string) => {
    const next = withPick(filters, "source", value);
    onFiltersChange(value === source ? next : withPick(next, "campaign", ""));
  };

  const setCampaign = async (value: string) => {
    if (!value || source || !hasSource) return onFiltersChange(withPick(filters, "campaign", value));
    setResolving(true);
    try {
      const found = await fetchRawValues(reportId, "source", [{ column: "campaign", operator: "in", value: [value] }]);
      setLookup({ campaign: value, sources: found });
      onFiltersChange(withPick(withPick(filters, "campaign", value), "source", found[0]?.value ?? ""));
      if (!found.length) toast.info(`No rows for campaign ${value} in this report`);
    } catch (err) {
      onFiltersChange(withPick(filters, "campaign", value));
      toast.error(errorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  const otherSources = lookup && lookup.campaign === campaign ? lookup.sources.filter((s) => s.value !== source) : [];

  if (!hasSource && !hasCampaign && !hasResult) return null;

  return (
    <div className="flex flex-wrap items-start gap-3">
      {hasSource && (
        <div className="flex w-52 flex-col gap-1">
          <label htmlFor={sourceId} className="text-[13px] font-medium text-ink-2">
            Source
          </label>
          <Combobox
            id={sourceId}
            value={source}
            onChange={setSource}
            options={sources.data ?? []}
            onSearch={setSourceSearch}
            placeholder={`All sources${sources.data && !sourceSearch ? ` (${sources.data.length})` : ""}`}
            loading={sources.isFetching}
          />
        </div>
      )}
      {hasCampaign && (
        <div className="flex w-52 flex-col gap-1">
          <label htmlFor={campaignId} className="text-[13px] font-medium text-ink-2">
            Campaign
          </label>
          <Combobox
            id={campaignId}
            value={campaign}
            onChange={setCampaign}
            options={campaigns.data ?? []}
            onSearch={setCampaignSearch}
            placeholder={`All campaigns${campaigns.data && !campaignSearch ? ` (${campaigns.data.length})` : ""}`}
            loading={campaigns.isFetching || resolving}
          />
          {otherSources.length > 0 && (
            <p className="text-xs text-muted">
              Also on source{" "}
              {otherSources.slice(0, 4).map((s, i) => (
                <span key={s.value}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    title={`${formatInt(s.count)} rows`}
                    onClick={() => onFiltersChange(withPick(filters, "source", s.value))}
                  >
                    {s.value}
                  </button>
                </span>
              ))}
              {otherSources.length > 4 && ` +${otherSources.length - 4} more`}
            </p>
          )}
        </div>
      )}
      {hasResult && (
        <div className="flex flex-col gap-1">
          <span id={`${campaignId}-result`} className="text-[13px] font-medium text-ink-2">
            Result
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${campaignId}-result`}
            className="inline-flex h-9 rounded-lg border border-line-strong bg-surface p-0.5"
          >
            {RESULT_OPTIONS.map((o) => {
              // Several facet picks (e.g. both results) read as "All" here.
              const checked = o.value ? result === o.value : !result || result.includes(",");
              return (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onFiltersChange(withPick(filters, "result", o.value))}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap transition",
                    checked ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {o.icon && <o.icon className="size-3.5" style={{ color: o.swatch }} aria-hidden />}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
