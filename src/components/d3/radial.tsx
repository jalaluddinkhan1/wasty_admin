"use client";

import { max } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";
import { arc as d3Arc } from "d3-shape";

import { CHART_COLORS, formatCompact } from "./core";
import { ChartCanvas, ChartLegend } from "./primitives";

export function D3RadialGauge({
  value,
  maxValue = 100,
  label,
  hint,
  color = "var(--chart-1)",
  height = 220,
}: {
  value: number;
  maxValue?: number;
  label: string;
  hint?: string;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / maxValue));

  return (
    <ChartCanvas height={height}>
      {({ width, height: h }) => {
        const r = Math.min(width, h) * 0.38;
        const start = -Math.PI * 0.75;
        const end = Math.PI * 0.75;
        const arc = d3Arc<unknown>()
          .innerRadius(r * 0.72)
          .outerRadius(r)
          .cornerRadius(8)
          .startAngle(start)
          .endAngle(end);
        const valueArc = d3Arc<unknown>()
          .innerRadius(r * 0.72)
          .outerRadius(r)
          .cornerRadius(8)
          .startAngle(start)
          .endAngle(start + (end - start) * pct);

        return (
          <svg width={width} height={h} role="img">
            <g transform={`translate(${width / 2},${h / 2 + 8})`}>
              <path d={arc(null) ?? ""} className="fill-muted" />
              <path d={valueArc(null) ?? ""} fill={color} />
              <text y={-4} textAnchor="middle" className="fill-foreground font-semibold text-3xl">
                {Math.round(value)}
                <tspan className="fill-muted-foreground text-sm">{maxValue === 100 ? "%" : ""}</tspan>
              </text>
              <text y={22} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {label}
              </text>
              {hint ? (
                <text y={38} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {hint}
                </text>
              ) : null}
            </g>
          </svg>
        );
      }}
    </ChartCanvas>
  );
}

export function D3RadialBars({
  data,
  height = 280,
}: {
  data: { key: string; label: string; value: number }[];
  height?: number;
}) {
  const rows = data.filter((d) => d.value >= 0);
  if (rows.length === 0) {
    return <p className="py-16 text-center text-muted-foreground text-sm">No partner status data.</p>;
  }

  return (
    <>
      <ChartCanvas height={height}>
        {({ width, height: h }) => {
          const inner = 36;
          const outer = Math.min(width, h) * 0.4;
          const angle = scaleBand<string>()
            .domain(rows.map((d) => d.key))
            .range([-Math.PI * 0.85, Math.PI * 0.85])
            .padding(0.12);
          const radius = scaleLinear()
            .domain([0, max(rows, (d) => d.value) || 1])
            .range([inner, outer]);
          const arc = d3Arc<{ key: string; value: number }>()
            .innerRadius(inner)
            .outerRadius((d) => radius(d.value))
            .startAngle((d) => angle(d.key) ?? 0)
            .endAngle((d) => (angle(d.key) ?? 0) + angle.bandwidth())
            .padAngle(0.02)
            .cornerRadius(5);

          return (
            <svg width={width} height={h} role="img">
              <g transform={`translate(${width / 2},${h / 2 + 10})`}>
                {rows.map((row, i) => (
                  <path key={row.key} d={arc(row) ?? ""} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
                <text textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  fleet mix
                </text>
              </g>
            </svg>
          );
        }}
      </ChartCanvas>
      <ChartLegend
        items={rows.map((row, i) => ({
          label: `${row.label} (${formatCompact(row.value)})`,
          color: CHART_COLORS[i % CHART_COLORS.length],
        }))}
      />
    </>
  );
}

export function D3HorizontalBars({
  data,
  height = 256,
}: {
  data: { key: string; label: string; value: number; color?: string }[];
  height?: number;
}) {
  const rows = data.filter((d) => d.value >= 0);
  if (rows.length === 0) {
    return <p className="py-16 text-center text-muted-foreground text-sm">No data yet.</p>;
  }

  return (
    <ChartCanvas height={height}>
      {({ width, height: h }) => {
        const margin = { top: 8, right: 48, bottom: 8, left: 92 };
        const innerW = Math.max(1, width - margin.left - margin.right);
        const innerH = Math.max(1, h - margin.top - margin.bottom);
        const y = scaleBand<string>()
          .domain(rows.map((d) => d.key))
          .range([0, innerH])
          .padding(0.28);
        const x = scaleLinear()
          .domain([0, max(rows, (d) => d.value) || 1])
          .nice()
          .range([0, innerW]);

        return (
          <svg width={width} height={h} role="img">
            <g transform={`translate(${margin.left},${margin.top})`}>
              {rows.map((row, i) => (
                <g key={row.key}>
                  <text
                    x={-8}
                    y={(y(row.key) ?? 0) + y.bandwidth() / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {row.label.length > 14 ? `${row.label.slice(0, 12)}…` : row.label}
                  </text>
                  <rect
                    x={0}
                    y={y(row.key)}
                    width={x(row.value)}
                    height={y.bandwidth()}
                    rx={6}
                    fill={row.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                  />
                  <text
                    x={x(row.value) + 6}
                    y={(y(row.key) ?? 0) + y.bandwidth() / 2}
                    dominantBaseline="middle"
                    className="fill-foreground text-[11px] tabular-nums"
                  >
                    {formatCompact(row.value)}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        );
      }}
    </ChartCanvas>
  );
}
