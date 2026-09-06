"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3StackedBarChart } from "@/components/d3/bar-charts";
import type { SettlementPoint } from "@/lib/analytics/types";

export function SettlementChart({ data }: { data: SettlementPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Settlements</CardTitle>
        <CardDescription>Partner payouts marked settled versus still pending.</CardDescription>
      </CardHeader>
      <CardContent>
        <D3StackedBarChart
          data={data}
          xKey="label"
          series={[
            { key: "settled", label: "Settled", color: "var(--chart-1)" },
            { key: "pending", label: "Pending", color: "var(--chart-4)" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
