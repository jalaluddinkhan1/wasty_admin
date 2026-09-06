"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3GroupedBarChart } from "@/components/d3/bar-charts";
import type { AreaOversightRow } from "@/lib/analytics/types";

export function AreaRecoveryChart({ areas }: { areas: AreaOversightRow[] }) {
  const chartData = areas.slice(0, 8).map((row) => ({
    area: row.area,
    collectedKg: row.collectedKg,
    recoveredKg: row.recoveredKg,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Area-wise recovery</CardTitle>
        <CardDescription>Collected vs recovered material by service zone.</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground text-sm">No area data in this window.</p>
        ) : (
          <D3GroupedBarChart
            data={chartData}
            xKey="area"
            series={[
              { key: "collectedKg", label: "Collected kg", color: "var(--chart-2)" },
              { key: "recoveredKg", label: "Recovered kg", color: "var(--chart-1)" },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
