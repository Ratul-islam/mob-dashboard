"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, CircleDollarSign, type LucideIcon } from "lucide-react";
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

type SegmentOption = { value: string; label: string; icon?: LucideIcon; swatch?: string };

const RESULT_OPTIONS: SegmentOption[] = [
  { value: "", label: "All" },
  { value: "suspect", label: "Suspect", icon: AlertTriangle, swatch: "var(--series-2)" },
  { value: "non-suspect", label: "Non-suspect", icon: CheckCircle2, swatch: "var(--series-1)" },
];

const CONVERSION_OPTIONS: SegmentOption[] = [
  { value: "", label: "All" },
  { value: "true", label: "Yes", icon: CircleDollarSign, swatch: "var(--good)" },
  { value: "false", label: "No" },
];

/**
 * Source, campaign, result and conversion pickers for an imported raw report. Renders its controls
 * without a wrapper so they share the caller's toolbar row. Picking a campaign without a source
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
  const [sourceSearch, setSourceSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [lookup, setLookup] = useState<{ campaign: string; sources: ValueCount[] } | null>(null);
  const [resolving, setResolving] = useState(false);

  const hasSource = columns.includes("source");
  const hasCampaign = columns.includes("campaign");
  const hasResult = columns.includes("result");
  const hasConverted = columns.includes("converted");
  const result = pickedValue(filters, "result");
  const converted = pickedValue(filters, "converted");
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

  if (!hasSource && !hasCampaign && !hasResult && !hasConverted) return null;

  return (
    <>
      {hasSource && (
        <Combobox
          className="w-40"
          size="sm"
          label="Source"
          value={source}
          onChange={setSource}
          options={sources.data ?? []}
          onSearch={setSourceSearch}
          placeholder={`All${sources.data && !sourceSearch ? ` (${sources.data.length})` : ""}`}
          loading={sources.isFetching}
        />
      )}
      {hasCampaign && (
        <Combobox
          className="w-44"
          size="sm"
          label="Campaign"
          value={campaign}
          onChange={setCampaign}
          options={campaigns.data ?? []}
          onSearch={setCampaignSearch}
          placeholder={`All${campaigns.data && !campaignSearch ? ` (${campaigns.data.length})` : ""}`}
          loading={campaigns.isFetching || resolving}
        />
      )}
      {hasResult && (
        <PickMenu
          label="Result"
          options={RESULT_OPTIONS}
          value={result}
          onChange={(value) => onFiltersChange(withPick(filters, "result", value))}
        />
      )}
      {hasConverted && (
        <PickMenu
          label="Converted"
          options={CONVERSION_OPTIONS}
          value={converted}
          onChange={(value) => onFiltersChange(withPick(filters, "converted", value))}
        />
      )}
      {otherSources.length > 0 && (
        // Own line at the end of the row, so it doesn't push the controls around.
        <p className="order-last basis-full text-xs text-muted">
          Campaign {campaign} also runs on source{" "}
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
    </>
  );
}

/** A compact dropdown with its label inside the trigger, tinted while something is picked. */
function PickMenu({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Several facet picks (e.g. both results) match no option, so show them as they are.
  const shown = options.find((o) => o.value === value) ?? (value ? { value, label: value } : options[0]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    // Start keyboard users on the current choice.
    const current = menu.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu.current?.querySelector<HTMLElement>("button");
    current?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={clsx(
          "flex h-8 items-center gap-1.5 rounded-lg border pr-2 pl-2.5 text-[13px] whitespace-nowrap transition",
          "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:outline-none",
          value ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-surface-2",
        )}
      >
        <span className={clsx("text-xs font-medium", value ? "text-accent" : "text-muted")}>{label}</span>
        {shown.icon && <shown.icon className="size-3.5 shrink-0" style={{ color: shown.swatch }} aria-hidden />}
        <span className={value ? "text-ink" : "text-ink-2"}>{shown.label}</span>
        <ChevronDown className={clsx("size-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute top-full left-0 z-30 mt-1 w-max min-w-full rounded-lg border border-line bg-surface p-1 shadow-xl"
        >
          {options.map((o) => {
            const checked = o.value ? value === o.value : !value;
            return (
              <button
                key={o.label}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm whitespace-nowrap outline-none",
                  "hover:bg-surface-2 focus-visible:bg-accent-soft focus-visible:text-accent",
                  checked && "font-medium",
                )}
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  {o.icon && <o.icon className="size-3.5" style={{ color: o.swatch }} aria-hidden />}
                </span>
                <span className="flex-1">{o.label}</span>
                <Check className={clsx("size-3.5 shrink-0 text-accent", !checked && "invisible")} aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
