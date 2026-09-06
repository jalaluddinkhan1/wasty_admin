"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useElementSize } from "./core";

export function ChartCanvas({
  className,
  height,
  children,
}: {
  className?: string;
  height: number;
  children: (dims: { width: number; height: number }) => ReactNode;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ height }}>
      {width > 16 ? children({ width, height }) : null}
    </div>
  );
}

export function ChartTooltip({
  x,
  y,
  visible,
  children,
}: {
  x: number;
  y: number;
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-36 rounded-lg border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md"
      style={{
        left: Math.max(8, x + 12),
        top: Math.max(8, y - 8),
        transform: "translateY(-100%)",
      }}
    >
      {children}
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
