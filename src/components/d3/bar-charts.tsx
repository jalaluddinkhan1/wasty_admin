"use client";

import { useState } from "react";

import { max } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";

import { formatCompact, type SeriesSpec } from "./core";
import { ChartCanvas, ChartLegend, ChartTooltip } from "./primitives";

type Row = Record<string, string | number>;

export function D3GroupedBarChart({
  data,
  xKey,
  series,
  height = 288,
}: {
  data: Row[];
  xKey: string;
  series: SeriesSpec[];
  height?: number;
}) {
  const [hover, setHover] = useState<{ i: number; key: string; x: number; y: number } | null>(null);

  return (
    <>
      <ChartCanvas height={height}>
        {({ width, height: h }) => {
          const margin = { top: 12, right: 8, bottom: 44, left: 40 };
          const innerW = Math.max(1, width - margin.left - margin.right);
          const innerH = Math.max(1, h - margin.top - margin.bottom);
          const x0 = scaleBand<string>()
            .domain(data.map((d) => String(d[xKey])))
            .range([0, innerW])
            .padding(0.22);
          const x1 = scaleBand<string>()
            .domain(series.map((s) => s.key))
            .range([0, x0.bandwidth()])
            .padding(0.12);
          const yMax = max(data, (d) => max(series, (s) => Number(d[s.key] ?? 0)) ?? 0) ?? 1;
          const y = scaleLinear().domain([0, Math.max(1, yMax) * 1.08]).nice().range([innerH, 0]);
          const ticks = y.ticks(4);
          const active = hover ? data[hover.i] : null;

          return (
            <div className="h-full w-full" onMouseLeave={() => setHover(null)}>
              <svg width={width} height={h} role="img">
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {ticks.map((t) => (
                    <g key={t}>
                      <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="stroke-border/60" strokeDasharray="3 4" />
                      <text x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                        {formatCompact(t)}
                      </text>
                    </g>
                  ))}
                  {data.map((row, i) => {
                    const label = String(row[xKey]);
                    const gx = x0(label) ?? 0;
                    return (
                      <g key={label} transform={`translate(${gx},0)`}>
                        {series.map((s) => {
                          const value = Number(row[s.key] ?? 0);
                          const bh = innerH - y(value);
                          return (
                            <rect
                              key={s.key}
                              x={x1(s.key)}
                              y={y(value)}
                              width={x1.bandwidth()}
                              height={Math.max(0, bh)}
                              rx={4}
                              fill={s.color}
                              opacity={hover && hover.i === i && hover.key !== s.key ? 0.45 : 1}
                              onMouseEnter={(event) => {
                                const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                if (!rect) return;
                                setHover({
                                  i,
                                  key: s.key,
                                  x: event.clientX - rect.left,
                                  y: event.clientY - rect.top,
                                });
                              }}
                            />
                          );
                        })}
                        <text
                          x={x0.bandwidth() / 2}
                          y={innerH + 16}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[10px]"
                        >
                          {label.length > 12 ? `${label.slice(0, 10)}…` : label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
              <ChartTooltip visible={Boolean(hover && active)} x={hover?.x ?? 0} y={hover?.y ?? 0}>
                {active && hover ? (
                  <>
                    <div className="mb-1 font-medium">{String(active[xKey])}</div>
                    {series.map((s) => (
                      <div key={s.key} className="flex justify-between gap-4">
                        <span>{s.label}</span>
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

export function D3StackedBarChart({
  data,
  xKey,
  series,
  height = 256,
}: {
  data: Row[];
  xKey: string;
  series: SeriesSpec[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <>
      <ChartCanvas height={height}>
        {({ width, height: h }) => {
          const margin = { top: 12, right: 8, bottom: 28, left: 40 };
          const innerW = Math.max(1, width - margin.left - margin.right);
          const innerH = Math.max(1, h - margin.top - margin.bottom);
          const x = scaleBand<string>()
            .domain(data.map((d) => String(d[xKey])))
            .range([0, innerW])
            .padding(0.28);
          const yMax =
            max(data, (d) => series.reduce((sum, s) => sum + Number(d[s.key] ?? 0), 0)) ?? 1;
          const y = scaleLinear().domain([0, Math.max(1, yMax) * 1.08]).nice().range([innerH, 0]);
          const ticks = y.ticks(4);
          const skip = Math.max(1, Math.ceil(data.length / 8));
          const active = hover != null ? data[hover] : null;

          return (
            <div className="h-full w-full" onMouseLeave={() => setHover(null)}>
              <svg width={width} height={h} role="img">
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {ticks.map((t) => (
                    <g key={t}>
                      <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} className="stroke-border/60" strokeDasharray="3 4" />
                      <text x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                        {formatCompact(t)}
                      </text>
                    </g>
                  ))}
                  {data.map((row, i) => {
                    let acc = 0;
                    const label = String(row[xKey]);
                    return (
                      <g key={label} onMouseEnter={() => setHover(i)}>
                        {series.map((s, si) => {
                          const value = Number(row[s.key] ?? 0);
                          const y1 = y(acc + value);
                          const y0 = y(acc);
                          acc += value;
                          return (
                            <rect
                              key={s.key}
                              x={x(label)}
                              y={y1}
                              width={x.bandwidth()}
                              height={Math.max(0, y0 - y1)}
                              rx={si === series.length - 1 ? 4 : 0}
                              fill={s.color}
                            />
                          );
                        })}
                        {i % skip === 0 ? (
                          <text x={(x(label) ?? 0) + x.bandwidth() / 2} y={innerH + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                            {label}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              </svg>
              <ChartTooltip
                visible={Boolean(active)}
                x={margin.left + (active ? (x(String(active[xKey])) ?? 0) + x.bandwidth() / 2 : 0)}
                y={margin.top + 16}
              >
                {active ? (
                  <>
                    <div className="mb-1 font-medium">{String(active[xKey])}</div>
                    {series.map((s) => (
                      <div key={s.key} className="flex justify-between gap-4">
                        <span>{s.label}</span>
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
