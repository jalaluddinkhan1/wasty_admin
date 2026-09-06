"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3RadialBars } from "@/components/d3/radial";
import type { PartnerUtilPoint } from "@/lib/analytics/types";

export function PartnerUtilizationChart({ data }: { data: PartnerUtilPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Partner utilization</CardTitle>
        <CardDescription>Roster status across the partner fleet.</CardDescription>
      </CardHeader>
      <CardContent>
        <D3RadialBars
          data={data.map((row) => ({
            key: row.key,
            label: row.status,
            value: row.count,
          }))}
        />
      </CardContent>
    </Card>
  );
}
