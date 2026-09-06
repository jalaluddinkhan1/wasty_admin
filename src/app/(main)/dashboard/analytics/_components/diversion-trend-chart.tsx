"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3SeriesChart } from "@/components/d3/series-chart";
import type { DiversionPoint } from "@/lib/analytics/types";

export function DiversionTrendChart({ data }: { data: DiversionPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Landfill diversion</CardTitle>
        <CardDescription>Weight recovered and estimated CO₂e avoided.</CardDescription>
      </CardHeader>
      <CardContent>
        <D3SeriesChart
          data={data}
          xKey="label"
          height={256}
          filledKeys={["kg", "co2eKg"]}
          series={[
            { key: "kg", label: "Diverted kg", color: "var(--chart-1)" },
            { key: "co2eKg", label: "CO₂e kg avoided", color: "var(--chart-3)" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
