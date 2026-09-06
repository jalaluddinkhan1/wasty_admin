"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3SeriesChart } from "@/components/d3/series-chart";
import type { AlertTrendPoint } from "@/lib/analytics/types";

export function AlertTrendsChart({ data }: { data: AlertTrendPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Alert volume</CardTitle>
        <CardDescription>Ops reports opened versus resolved each day.</CardDescription>
      </CardHeader>
      <CardContent>
        <D3SeriesChart
          data={data}
          xKey="label"
          height={256}
          filledKeys={["open"]}
          series={[
            { key: "open", label: "Opened", color: "var(--chart-5)" },
            { key: "resolved", label: "Resolved", color: "var(--chart-1)" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
