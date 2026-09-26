"use client";

import { useState } from "react";
import { FilterX } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useCampaigns, useInstances, useSources } from "@/lib/queries";
import { addDays, daysInclusive, presetRange, RANGE_PRESETS, RangePreset, todayUtc } from "@/lib/dates";
import { formatInt } from "@/lib/format";
import { Combobox } from "@/components/Combobox";
import { Button, Field, Input, Select, toast } from "@/components/ui";

type CampaignSource = { source: string; requests: number };

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

  // Sources found for the selected campaign (a campaign can run on more than one source).
  const [campaignLookup, setCampaignLookup] = useState<{ campaign: string; sources: CampaignSource[] } | null>(null);
  const [resolving, setResolving] = useState(false);

  const setSource = (source: string) => set({ source, campaign: source === filters.source ? filters.campaign : "" });

  /** Picking a campaign without a source also selects the source that sent most of its traffic. */
  const setCampaign = async (campaign: string) => {
    if (!campaign || filters.source) return set({ campaign });
    setResolving(true);
    try {
      const sources = await api<CampaignSource[]>("/anura/campaign-sources", {
        query: { start: filters.start, end: filters.end, instance: filters.instance || undefined, campaign },
      });
      setCampaignLookup({ campaign, sources });
      set({ campaign, source: sources[0]?.source ?? "" });
      if (!sources.length) toast.info(`No traffic for campaign ${campaign} in this date range`);
    } catch (err) {
      set({ campaign });
      toast.error(`Couldn't find the source for campaign ${campaign}: ${errorMessage(err)}`);
    } finally {
      setResolving(false);
    }
  };

  const otherSources =
    campaignLookup && campaignLookup.campaign === filters.campaign
      ? campaignLookup.sources.filter((s) => s.source !== filters.source)
      : [];

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
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
          <Combobox
            id={id}
            value={filters.source}
            onChange={setSource}
            options={(sources.data ?? []).map((value) => ({ value }))}
            placeholder={`All sources${sources.data ? ` (${sources.data.length})` : ""}`}
            loading={sources.isFetching}
          />
        )}
      </Field>

      <Field
        label="Campaign"
        className="w-52"
        hint={
          otherSources.length > 0 && (
            <span>
              Also on source{" "}
              {otherSources.slice(0, 4).map((s, i) => (
                <span key={s.source}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    title={`${formatInt(s.requests)} requests`}
                    onClick={() => set({ source: s.source })}
                  >
                    {s.source}
                  </button>
                </span>
              ))}
              {otherSources.length > 4 && ` +${otherSources.length - 4} more`}
            </span>
          )
        }
      >
        {(id) => (
          <Combobox
            id={id}
            value={filters.campaign}
            onChange={setCampaign}
            options={(campaigns.data ?? []).map((value) => ({ value }))}
            placeholder={`All campaigns${campaigns.data ? ` (${campaigns.data.length})` : ""}`}
            loading={campaigns.isFetching || resolving}
          />
        )}
      </Field>

      {hasScopeFilter && (
        <Button variant="ghost" className="mt-[26px]" icon={<FilterX className="size-4" />} onClick={() => set({ source: "", campaign: "" })}>
          Clear source/campaign
        </Button>
      )}
    </div>
  );
}
