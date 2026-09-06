"use client";

import { useRouter } from "next/navigation";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { D3HorizontalBars } from "@/components/d3/radial";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsRange, AreaOversightRow } from "@/lib/analytics/types";

import { AreaOversightTable } from "./area-oversight-table";
import { AreaRecoveryChart } from "./area-recovery-chart";

export function GovZonesClient({
  range,
  areas,
  provider,
}: {
  range: AnalyticsRange;
  areas: AreaOversightRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Zones & Coverage"
        description={
          provider === "firebase"
            ? "Area-wise household targets, coverage, and recovery metrics."
            : "Demo zone coverage table."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(value) => router.push(`/dashboard/compliance/zones?range=${value}`)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <ExportCsvButton
              label="Export CSV"
              filename={`zones-${range}.csv`}
              headers={[
                "Area",
                "Household target",
                "Households served",
                "Coverage %",
                "Partners",
                "Jobs completed",
                "Collected kg",
                "Recovered kg",
                "Recovery %",
              ]}
              rows={areas.map((row) => [
                row.area,
                String(row.householdTarget),
                String(row.householdsServed),
                String(row.coveragePct),
                String(row.partnersActive),
                String(row.jobsCompleted),
                String(row.collectedKg),
                String(row.recoveredKg),
                String(row.recoveryRate),
              ])}
            />
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AreaRecoveryChart areas={areas} />
        </div>
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Household coverage</CardTitle>
            <CardDescription>Served households as a share of each zone target.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3HorizontalBars
              data={areas.slice(0, 8).map((row) => ({
                key: row.zoneId,
                label: row.area,
                value: row.coveragePct,
              }))}
              height={288}
            />
          </CardContent>
        </Card>
      </div>
      <AreaOversightTable areas={areas} />
    </div>
  );
}
