"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3DonutChart } from "@/components/d3/donut-chart";
import type { WasteStreamSlice } from "@/lib/analytics/types";

export function WasteStreamChart({ data }: { data: WasteStreamSlice[] }) {
  const total = data.reduce((sum, row) => sum + row.kg, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Waste streams</CardTitle>
        <CardDescription>Recovered weight from completed jobs, by material type.</CardDescription>
      </CardHeader>
      <CardContent>
        <D3DonutChart
          data={data.map((row) => ({ key: row.key, label: row.stream, value: row.kg }))}
          centerLabel={total >= 1000 ? `${(total / 1000).toFixed(1)}t` : `${Math.round(total)}kg`}
          centerHint="recovered"
        />
      </CardContent>
    </Card>
  );
}
