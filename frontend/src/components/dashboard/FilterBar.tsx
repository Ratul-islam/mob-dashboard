"use client";

import { FilterX } from "lucide-react";
import { useCampaigns, useInstances, useSources } from "@/lib/queries";
import { addDays, daysInclusive, presetRange, RANGE_PRESETS, RangePreset, todayUtc } from "@/lib/dates";
import { Button, Field, Input, Select } from "@/components/ui";

export interface DashboardFilters {
  preset: RangePreset;
  start: string;
  end: string;
  instance: string;
  source: string;
  campaign: string;
}

export function FilterBar({
  filters,
  onChange,
  maxDays,
}: {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  maxDays: number;
}) {
  const instances = useInstances();
  const scope = { start: filters.start, end: filters.end, instance: filters.instance || undefined };
  const sources = useSources(scope);
  const campaigns = useCampaigns({ ...scope, source: filters.source || undefined });

  const today = todayUtc();
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch });

  const setPreset = (preset: RangePreset) =>
    preset === "custom" ? set({ preset }) : set({ preset, ...presetRange(preset) });

  // Keep custom ranges inside Anura's rolling window for breakdown tables.
  const setCustom = (start: string, end: string) => {
    if (start > end) [start, end] = [end, start];
    if (daysInclusive(start, end) > maxDays) start = addDays(end, -(maxDays - 1));
    set({ preset: "custom", start, end });
  };

  const hasScopeFilter = Boolean(filters.source || filters.campaign);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
      <Field label="Date range (UTC)" className="w-40">
        {(id) => (
          <Select id={id} value={filters.preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
            {RANGE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {filters.preset === "custom" && (
        <>
          <Field label="From" className="w-40">
            {(id) => (
              <Input id={id} type="date" max={today} value={filters.start} onChange={(e) => e.target.value && setCustom(e.target.value, filters.end)} />
            )}
          </Field>
          <Field label="To" className="w-40" hint={`Max ${maxDays} days`}>
            {(id) => (
              <Input id={id} type="date" max={today} value={filters.end} onChange={(e) => e.target.value && setCustom(filters.start, e.target.value)} />
            )}
          </Field>
        </>
      )}

      <Field label="Instance" className="w-48">
        {(id) => (
          <Select
            id={id}
            value={filters.instance}
            onChange={(e) => set({ instance: e.target.value, source: "", campaign: "" })}
          >
            <option value="All Instances">All instances</option>
            {instances.data
              ?.filter((i) => String(i.id) !== "All Instances")
              .map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.name}
                </option>
              ))}
            {filters.instance &&
              filters.instance !== "All Instances" &&
              !instances.data?.some((i) => String(i.id) === filters.instance) && (
                <option value={filters.instance}>{filters.instance}</option>
              )}
          </Select>
        )}
      </Field>

      <Field label="Source" className="w-52">
        {(id) => (
          <Select id={id} value={filters.source} onChange={(e) => set({ source: e.target.value, campaign: "" })}>
            <option value="">All sources{sources.data ? ` (${sources.data.length})` : ""}</option>
            {filters.source && !sources.data?.includes(filters.source) && <option value={filters.source}>{filters.source}</option>}
            {sources.data?.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Campaign" className="w-52">
        {(id) => (
          <Select id={id} value={filters.campaign} onChange={(e) => set({ campaign: e.target.value })}>
            <option value="">All campaigns{campaigns.data ? ` (${campaigns.data.length})` : ""}</option>
            {filters.campaign && !campaigns.data?.includes(filters.campaign) && (
              <option value={filters.campaign}>{filters.campaign}</option>
            )}
            {campaigns.data?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {hasScopeFilter && (
        <Button variant="ghost" icon={<FilterX className="size-4" />} onClick={() => set({ source: "", campaign: "" })}>
          Clear source/campaign
        </Button>
      )}
    </div>
  );
}
