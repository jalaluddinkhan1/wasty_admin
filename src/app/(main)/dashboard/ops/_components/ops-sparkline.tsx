"use client";

import { D3Sparkline } from "@/components/d3/series-chart";
import type { JobTrendPoint } from "@/lib/analytics/types";

export function OpsSparkline({ data }: { data: JobTrendPoint[] }) {
  const total = data.reduce((sum, row) => sum + row.completed, 0);
  const avg = data.length ? Math.round(total / data.length) : 0;
  const today = data.at(-1)?.completed ?? 0;

  return (
    <div className="rounded-2xl border bg-linear-to-b from-emerald-500/10 to-transparent p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">Completed vs 7-day avg</p>
          <p className="mt-2 font-semibold text-3xl tabular-nums tracking-tight">{today}</p>
          <p className="mt-1 text-muted-foreground text-xs">Avg {avg}/day this week</p>
        </div>
      </div>
      <div className="mt-3">
        <D3Sparkline data={data} xKey="label" yKey="completed" color="var(--chart-1)" />
      </div>
    </div>
  );
}
