"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { formatCompact, formatInt, formatPct } from "@/lib/format";
import { IconButton } from "@/components/ui";

export interface StackedPoint {
  key: string;
  nonsuspect: number;
  suspect: number;
}

const SERIES = [
  { key: "nonsuspect", label: "Non-suspect", color: "var(--series-1)" },
  { key: "suspect", label: "Suspect", color: "var(--series-2)" },
] as const;

export function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-ink-2">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { payload: StackedPoint }[];
  label?: string;
  labelFormatter?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as StackedPoint;
  const total = row.nonsuspect + row.suspect;
  return (
    <div className="min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium text-ink">{labelFormatter && label ? labelFormatter(label) : label}</div>
      {[...SERIES].reverse().map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
          <span className="tabular font-medium text-ink">{formatInt(row[s.key])}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1 text-ink-2">
        <span>Total · suspect rate</span>
        <span className="tabular text-ink">
          {formatInt(total)} · {formatPct(row.suspect, total)}
        </span>
      </div>
    </div>
  );
}

export function StackedBars({
  data,
  tickFormatter = (v: string) => v,
  labelFormatter,
  height = 240,
  tableKeyLabel = "Date",
}: {
  data: StackedPoint[];
  tickFormatter?: (v: string) => string;
  labelFormatter?: (v: string) => string;
  height?: number;
  tableKeyLabel?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Legend />
        <div className="flex">
          <IconButton label="Chart view" active={view === "chart"} onClick={() => setView("chart")}>
            <BarChart3 className="size-4" />
          </IconButton>
          <IconButton label="Table view" active={view === "table"} onClick={() => setView("table")}>
            <Table2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {view === "chart" ? (
        <div style={{ height }} role="img" aria-label="Stacked bar chart of suspect and non-suspect requests">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis
                dataKey="key"
                tickFormatter={tickFormatter}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={{ stroke: "var(--axis)" }}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={<ChartTooltip labelFormatter={labelFormatter ?? tickFormatter} />}
                isAnimationActive={false}
              />
              {/* Surface-colored strokes give the 2px gap between stacked segments. */}
              <Bar dataKey="nonsuspect" stackId="a" fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
              <Bar
                dataKey="suspect"
                stackId="a"
                fill="var(--series-2)"
                stroke="var(--surface)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="scroll-thin overflow-auto rounded-lg border border-line" style={{ maxHeight: height }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-xs text-ink-2">
              <tr>
                <th className="px-3 py-2 font-medium">{tableKeyLabel}</th>
                <th className="px-3 py-2 text-right font-medium">Non-suspect</th>
                <th className="px-3 py-2 text-right font-medium">Suspect</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Suspect rate</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="px-3 py-1.5">{(labelFormatter ?? tickFormatter)(d.key)}</td>
                  <td className="px-3 py-1.5 text-right">{formatInt(d.nonsuspect)}</td>
                  <td className="px-3 py-1.5 text-right">{formatInt(d.suspect)}</td>
                  <td className="px-3 py-1.5 text-right">{formatInt(d.nonsuspect + d.suspect)}</td>
                  <td className="px-3 py-1.5 text-right">{formatPct(d.suspect, d.nonsuspect + d.suspect)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
