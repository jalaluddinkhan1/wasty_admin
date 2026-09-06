"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3SeriesChart } from "@/components/d3/series-chart";
import type { JobTrendPoint } from "@/lib/analytics/types";

export function JobTrendsChart({ data }: { data: JobTrendPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Job throughput</CardTitle>
        <CardDescription>Completed, in-progress, and cancelled pickups over time.</CardDescription>
      </CardHeader>
      <CardContent>
        <D3SeriesChart
          data={data}
          xKey="label"
          filledKeys={["completed"]}
          series={[
            { key: "completed", label: "Completed", color: "var(--chart-1)" },
            { key: "active", label: "In progress", color: "var(--chart-2)" },
            { key: "cancelled", label: "Cancelled", color: "var(--chart-5)" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
