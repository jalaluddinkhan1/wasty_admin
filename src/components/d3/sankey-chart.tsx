"use client";

import { useMemo, useState } from "react";

import { sankey, sankeyLinkHorizontal, type SankeyNode, type SankeyLink } from "d3-sankey";

import { CHART_COLORS, formatKg } from "./core";
import { ChartCanvas, ChartTooltip } from "./primitives";

type NodeDef = { id: string; label: string };
type LinkDef = { source: string; target: string; value: number };

export function D3SankeyChart({
  nodes,
  links,
  height = 320,
}: {
  nodes: NodeDef[];
  links: LinkDef[];
  height?: number;
}) {
  const [hover, setHover] = useState<{ label: string; value: number; x: number; y: number } | null>(null);
  const validLinks = useMemo(() => links.filter((l) => l.value > 0), [links]);

  if (nodes.length === 0 || validLinks.length === 0) {
    return <p className="py-16 text-center text-muted-foreground text-sm">Not enough flow data to draw a diagram.</p>;
  }

  return (
    <ChartCanvas height={height}>
      {({ width, height: h }) => {
        const layout = sankey<NodeDef, LinkDef>()
          .nodeId((d) => d.id)
          .nodeWidth(18)
          .nodePadding(18)
          .extent([
            [8, 12],
            [width - 8, h - 12],
          ]);
        const graph = layout({
          nodes: nodes.map((n) => ({ ...n })),
          links: validLinks.map((l) => ({ ...l })),
        });
        const path = sankeyLinkHorizontal();
        const colorOf = (id: string) => CHART_COLORS[nodes.findIndex((n) => n.id === id) % CHART_COLORS.length];

        return (
          <div className="h-full w-full" onMouseLeave={() => setHover(null)}>
            <svg width={width} height={h} role="img">
              {graph.links.map((link, i) => {
                const source = link.source as SankeyNode<NodeDef, LinkDef>;
                const target = link.target as SankeyNode<NodeDef, LinkDef>;
                return (
                  <path
                    key={i}
                    d={path(link as SankeyLink<NodeDef, LinkDef>) ?? ""}
                    fill="none"
                    stroke={colorOf(String(source.id))}
                    strokeOpacity={0.35}
                    strokeWidth={Math.max(2, link.width ?? 2)}
                    onMouseEnter={(event) => {
                      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (!rect) return;
                      setHover({
                        label: `${source.label} → ${target.label}`,
                        value: link.value,
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                      });
                    }}
                  />
                );
              })}
              {graph.nodes.map((node) => (
                <g key={node.id} transform={`translate(${node.x0 ?? 0},${node.y0 ?? 0})`}>
                  <rect
                    width={Math.max(1, (node.x1 ?? 0) - (node.x0 ?? 0))}
                    height={Math.max(1, (node.y1 ?? 0) - (node.y0 ?? 0))}
                    rx={4}
                    fill={colorOf(String(node.id))}
                  />
                  <text
                    x={(node.x0 ?? 0) < width / 2 ? (node.x1 ?? 0) - (node.x0 ?? 0) + 8 : -8}
                    y={((node.y1 ?? 0) - (node.y0 ?? 0)) / 2}
                    textAnchor={(node.x0 ?? 0) < width / 2 ? "start" : "end"}
                    dominantBaseline="middle"
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
            <ChartTooltip visible={Boolean(hover)} x={hover?.x ?? 0} y={hover?.y ?? 0}>
              {hover ? (
                <>
                  <div className="font-medium">{hover.label}</div>
                  <div className="tabular-nums text-muted-foreground">{formatKg(hover.value)}</div>
                </>
              ) : null}
            </ChartTooltip>
          </div>
        );
      }}
    </ChartCanvas>
  );
}
