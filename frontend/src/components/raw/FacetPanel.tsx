"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { formatInt, humanizeColumn } from "@/lib/format";
import type { RawFacets, RowFilter } from "@/lib/types";
import { Card, Spinner } from "@/components/ui";

const DEFAULT_OPEN = ["result", "invalid_traffic_type", "rule_sets", "country", "device_type"];

const valueLabel = (v: string | boolean | null) => (v === null || v === "" ? "(empty)" : typeof v === "boolean" ? (v ? "Yes" : "No") : v);

/** A facet value is "active" when an `in` filter (or `contains` for rule_sets) includes it. */
export const isFacetActive = (filters: RowFilter[], column: string, value: string | boolean | null) => {
  const v = String(value);
  return filters.some(
    (f) =>
      f.column === column &&
      ((f.operator === "in" && Array.isArray(f.value) && f.value.includes(v)) ||
        (f.operator === "contains" && column === "rule_sets" && f.value === v) ||
        (f.operator === "empty" && value === null)),
  );
};

export function toggleFacet(filters: RowFilter[], column: string, value: string | boolean | null): RowFilter[] {
  if (value === null) {
    const has = filters.some((f) => f.column === column && f.operator === "empty");
    return has ? filters.filter((f) => !(f.column === column && f.operator === "empty")) : [...filters, { column, operator: "empty" }];
  }
  const v = String(value);
  if (column === "rule_sets") {
    const has = filters.some((f) => f.column === column && f.operator === "contains" && f.value === v);
    return has
      ? filters.filter((f) => !(f.column === column && f.operator === "contains" && f.value === v))
      : [...filters, { column, operator: "contains", value: v }];
  }
  const existing = filters.find((f) => f.column === column && f.operator === "in");
  if (!existing) return [...filters, { column, operator: "in", value: [v] }];
  const values = (existing.value as string[]).includes(v)
    ? (existing.value as string[]).filter((x) => x !== v)
    : [...(existing.value as string[]), v];
  return values.length
    ? filters.map((f) => (f === existing ? { ...f, value: values } : f))
    : filters.filter((f) => f !== existing);
}

export function FacetPanel({
  facets,
  loading,
  filters,
  onFiltersChange,
}: {
  facets?: RawFacets;
  loading: boolean;
  filters: RowFilter[];
  onFiltersChange: (filters: RowFilter[]) => void;
}) {
  const [open, setOpen] = useState<string[]>(DEFAULT_OPEN);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold">Breakdown</h2>
        {loading && <Spinner className="size-3.5" />}
      </div>
      <div className="scroll-thin max-h-[calc(100vh-10rem)] overflow-y-auto">
        {Object.entries(facets?.facets ?? {}).map(([column, buckets]) => {
          const isOpen = open.includes(column);
          const max = Math.max(1, ...buckets.map((b) => b.count));
          return (
            <section key={column} className="border-b border-line last:border-b-0">
              <button
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] font-medium hover:bg-surface-2"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? open.filter((c) => c !== column) : [...open, column])}
              >
                {humanizeColumn(column)}
                <ChevronDown className={clsx("size-4 text-muted transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <ul className="px-2 pb-2">
                  {buckets.length === 0 && <li className="px-2 py-1 text-xs text-muted">No values</li>}
                  {buckets.map((b) => {
                    const active = isFacetActive(filters, column, b.value);
                    return (
                      <li key={String(b.value)}>
                        <button
                          onClick={() => onFiltersChange(toggleFacet(filters, column, b.value))}
                          aria-pressed={active}
                          className={clsx(
                            "group relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1 text-left text-xs",
                            active ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-2",
                          )}
                          title={`${valueLabel(b.value)}: ${formatInt(b.count)}`}
                        >
                          <span
                            className="absolute inset-y-1 left-0 rounded-r bg-series-1 opacity-15"
                            style={{ width: `${(b.count / max) * 100}%` }}
                            aria-hidden
                          />
                          <span className="relative truncate">{valueLabel(b.value)}</span>
                          <span className="tabular relative shrink-0 text-ink-2">{formatInt(b.count)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
