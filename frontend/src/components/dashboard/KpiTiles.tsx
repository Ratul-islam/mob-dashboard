"use client";

import { AlertTriangle, CheckCircle2, Smartphone, Waves } from "lucide-react";
import { formatInt, formatPct } from "@/lib/format";
import type { Totals } from "@/lib/types";

function Tile({
  label,
  value,
  detail,
  swatch,
  icon,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  swatch?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
        {swatch ? <span className="size-2.5 rounded-sm" style={{ background: swatch }} aria-hidden /> : null}
        {label}
        <span className="ml-auto text-muted">{icon}</span>
      </div>
      <div className="mt-2 text-[28px] leading-none font-semibold tracking-tight">{value}</div>
      {detail && <div className="mt-2 text-xs text-muted">{detail}</div>}
    </div>
  );
}

export function KpiTiles({ totals, loading }: { totals?: Totals; loading?: boolean }) {
  const t = totals ?? { total: 0, nonsuspect: 0, suspect: 0, mobile: 0 };
  const show = (n: number) => (loading && !totals ? "…" : formatInt(n));

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile label="Requests" value={show(t.total)} icon={<Waves className="size-4" />} detail="All checked visits in range" />
      <Tile
        label="Non-suspect"
        value={show(t.nonsuspect)}
        swatch="var(--series-1)"
        icon={<CheckCircle2 className="size-4" />}
        detail={`${formatPct(t.nonsuspect, t.total)} of requests`}
      />
      <Tile
        label="Suspect"
        value={show(t.suspect)}
        swatch="var(--series-2)"
        icon={<AlertTriangle className="size-4" />}
        detail={
          <span>
            <span className="font-medium text-ink">{formatPct(t.suspect, t.total)}</span> suspect rate
          </span>
        }
      />
      <Tile
        label="Mobile"
        value={show(t.mobile)}
        icon={<Smartphone className="size-4" />}
        detail={`${formatPct(t.mobile, t.total)} of requests`}
      />
    </div>
  );
}
