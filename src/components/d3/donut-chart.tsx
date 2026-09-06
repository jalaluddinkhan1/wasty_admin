"use client";

import { useMemo, useState } from "react";

import { pie as d3Pie, arc as d3Arc } from "d3-shape";
import { sum } from "d3-array";

import { CHART_COLORS, formatCompact } from "./core";
import { ChartCanvas, ChartLegend } from "./primitives";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  color?: string;
};

export function D3DonutChart({
  data,
  height = 280,
  centerLabel,
  centerHint,
}: {
  data: DonutSlice[];
  height?: number;
  centerLabel?: string;
  centerHint?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const slices = useMemo(
    () =>
      data
        .filter((d) => d.value > 0)
        .map((d, i) => ({ ...d, color: d.color ?? CHART_COLORS[i % CHART_COLORS.length] })),
    [data],
  );
  const total = sum(slices, (d) => d.value);

  if (slices.length === 0) {
    return <p className="py-16 text-center text-muted-foreground text-sm">No data in this range.</p>;
  }

  return (
    <>
      <ChartCanvas height={height}>
        {({ width, height: h }) => {
          const size = Math.min(width, h);
          const outer = size * 0.38;
          const inner = outer * 0.62;
          const pie = d3Pie<DonutSlice>().value((d) => d.value).padAngle(0.018).sort(null);
          const arcs = pie(slices);
          const arc = d3Arc<(typeof arcs)[number]>().innerRadius(inner).outerRadius(outer).cornerRadius(6);
          const hoverArc = d3Arc<(typeof arcs)[number]>().innerRadius(inner).outerRadius(outer + 8).cornerRadius(8);

          return (
            <svg width={width} height={h} role="img">
              <g transform={`translate(${width / 2},${h / 2})`}>
                {arcs.map((a) => {
                  const hovered = active === a.data.key;
                  return (
                    <path
                      key={a.data.key}
                      d={(hovered ? hoverArc(a) : arc(a)) ?? ""}
                      fill={a.data.color}
                      opacity={active && !hovered ? 0.45 : 1}
                      className="cursor-pointer transition-opacity"
                      onMouseEnter={() => setActive(a.data.key)}
                      onMouseLeave={() => setActive(null)}
                    />
                  );
                })}
                <text textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-semibold text-2xl">
                  {centerLabel ?? formatCompact(total)}
                </text>
                <text y={22} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {active
                    ? `${slices.find((s) => s.key === active)?.label ?? ""} · ${Math.round(((slices.find((s) => s.key === active)?.value ?? 0) / total) * 100)}%`
                    : (centerHint ?? "total")}
                </text>
              </g>
            </svg>
          );
        }}
      </ChartCanvas>
      <ChartLegend items={slices.map((s) => ({ label: `${s.label} (${formatCompact(s.value)})`, color: s.color! }))} />
    </>
  );
}
