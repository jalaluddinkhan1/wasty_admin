"use client";

import { useId, useState } from "react";

import { max } from "d3-array";
import { Delaunay } from "d3-delaunay";
import { scaleLinear, scalePoint } from "d3-scale";
import { area as d3Area, curveMonotoneX, line as d3Line } from "d3-shape";

import { formatCompact, type SeriesSpec } from "./core";
import { ChartCanvas, ChartLegend, ChartTooltip } from "./primitives";

type Point = Record<string, string | number>;

export function D3SeriesChart({
  data,
  xKey,
  series,
  height = 288,
  filledKeys = [],
}: {
  data: Point[];
  xKey: string;
  series: SeriesSpec[];
  height?: number;
  filledKeys?: string[];
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  return (
    <>
      <ChartCanvas height={height}>
        {({ width, height: h }) => {
          const margin = { top: 16, right: 12, bottom: 28, left: 36 };
          const innerW = Math.max(1, width - margin.left - margin.right);
          const innerH = Math.max(1, h - margin.top - margin.bottom);
          const labels = data.map((d) => String(d[xKey]));
          const x = scalePoint<string>().domain(labels).range([0, innerW]).padding(0.1);
          const yMax =
            max(data, (d) => max(series, (s) => Number(d[s.key] ?? 0)) ?? 0) ?? 1;
          const y = scaleLinear()
            .domain([0, Math.max(1, yMax) * 1.08])
            .nice()
            .range([innerH, 0]);
          const ticks = y.ticks(4);
          const points = labels.map((label) => ({ x: x(label) ?? 0 }));
          const delaunay = Delaunay.from(points, (p) => p.x, () => innerH / 2);
          const active = hover != null ? data[hover] : null;

          return (
            <div className="h-full w-full" onMouseLeave={() => setHover(null)}>
              <svg width={width} height={h} role="img">
                <defs>
                  {series.map((s) => (
                    <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.38} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.03} />
                    </linearGradient>
                  ))}
                </defs>
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {ticks.map((t) => (
                    <g key={t}>
                      <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="stroke-border/60" strokeDasharray="3 4" />
                      <text
                        x={-8}
                        y={y(t)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="fill-muted-foreground text-[10px]"
                      >
                        {formatCompact(t)}
                      </text>
                    </g>
                  ))}
                  {labels.map((label, i) =>
                    i % Math.max(1, Math.ceil(labels.length / 8)) === 0 ? (
                      <text
                        key={`${label}-${i}`}
                        x={x(label) ?? 0}
                        y={innerH + 18}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px]"
                      >
                        {label}
                      </text>
                    ) : null,
                  )}
                  {series.map((s) => {
                    const area = d3Area<Point>()
                      .x((d) => x(String(d[xKey])) ?? 0)
                      .y0(y(0))
                      .y1((d) => y(Number(d[s.key] ?? 0)))
                      .curve(curveMonotoneX);
                    const line = d3Line<Point>()
                      .x((d) => x(String(d[xKey])) ?? 0)
                      .y((d) => y(Number(d[s.key] ?? 0)))
                      .curve(curveMonotoneX);
                    return (
                      <g key={s.key}>
                        {filledKeys.includes(s.key) ? (
                          <path d={area(data) ?? ""} fill={`url(#${gid}-${s.key})`} />
                        ) : null}
                        <path d={line(data) ?? ""} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinecap="round" />
                      </g>
                    );
                  })}
                  {active ? (
                    <>
                      <line
                        x1={x(String(active[xKey])) ?? 0}
                        x2={x(String(active[xKey])) ?? 0}
                        y1={0}
                        y2={innerH}
                        className="stroke-foreground/25"
                        strokeDasharray="3 3"
                      />
                      {series.map((s) => (
                        <circle
                          key={s.key}
                          cx={x(String(active[xKey])) ?? 0}
                          cy={y(Number(active[s.key] ?? 0))}
                          r={4}
                          fill={s.color}
                          className="stroke-background"
                          strokeWidth={1.5}
                        />
                      ))}
                    </>
                  ) : null}
                  <rect
                    width={innerW}
                    height={innerH}
                    fill="transparent"
                    onMouseMove={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setHover(delaunay.find(event.clientX - rect.left, innerH / 2));
                    }}
                  />
                </g>
              </svg>
              <ChartTooltip visible={Boolean(active)} x={margin.left + (x(String(active?.[xKey] ?? "")) ?? 0)} y={margin.top + 20}>
                {active ? (
                  <>
                    <div className="mb-1 font-medium">{String(active[xKey])}</div>
                    {series.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="tabular-nums">{formatCompact(Number(active[s.key] ?? 0))}</span>
                      </div>
                    ))}
                  </>
                ) : null}
              </ChartTooltip>
            </div>
          );
        }}
      </ChartCanvas>
      <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />
    </>
  );
}

export function D3Sparkline({
  data,
  xKey,
  yKey,
  color = "var(--chart-1)",
  height = 64,
}: {
  data: Point[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  return (
    <ChartCanvas height={height}>
      {({ width, height: h }) => {
        const x = scalePoint<string>()
          .domain(data.map((d) => String(d[xKey])))
          .range([4, Math.max(8, width - 4)]);
        const yMax = max(data, (d) => Number(d[yKey] ?? 0)) ?? 1;
        const y = scaleLinear().domain([0, Math.max(1, yMax)]).range([h - 4, 4]);
        const area = d3Area<Point>()
          .x((d) => x(String(d[xKey])) ?? 0)
          .y0(h - 4)
          .y1((d) => y(Number(d[yKey] ?? 0)))
          .curve(curveMonotoneX);
        const line = d3Line<Point>()
          .x((d) => x(String(d[xKey])) ?? 0)
          .y((d) => y(Number(d[yKey] ?? 0)))
          .curve(curveMonotoneX);
        const last = data.at(-1);
        return (
          <svg width={width} height={h}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={area(data) ?? ""} fill={`url(#${gid})`} />
            <path d={line(data) ?? ""} fill="none" stroke={color} strokeWidth={2} />
            {last ? (
              <circle cx={x(String(last[xKey])) ?? 0} cy={y(Number(last[yKey] ?? 0))} r={3} fill={color} />
            ) : null}
          </svg>
        );
      }}
    </ChartCanvas>
  );
}
