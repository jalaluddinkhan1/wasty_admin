"use client";

import { useRouter } from "next/navigation";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { D3GroupedBarChart } from "@/components/d3/bar-charts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsRange, MrfOversightRow } from "@/lib/analytics/types";

import { MrfOversightTable } from "./mrf-oversight-table";

export function GovMrfClient({
  range,
  mrfFacilities,
  provider,
}: {
  range: AnalyticsRange;
  mrfFacilities: MrfOversightRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="MRF Facilities"
        description={
          provider === "firebase"
            ? "Material recovery facilities — inbound volume, processing, and recovery rates."
            : "Demo MRF facility table."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(value) => router.push(`/dashboard/compliance/mrf?range=${value}`)}>
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
              filename={`mrf-${range}.csv`}
              headers={["MRF", "Zone", "Capacity", "Status", "Inbound kg", "Processed kg", "Recovery %", "Households"]}
              rows={mrfFacilities.map((row) => [
                row.name,
                row.zone,
                row.capacity,
                row.status,
                String(row.inboundKg),
                String(row.processedKg),
                String(row.recoveryRate),
                String(row.householdsServed),
              ])}
            />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Inbound vs processed</CardTitle>
          <CardDescription>Facility throughput in kilograms for the selected window.</CardDescription>
        </CardHeader>
        <CardContent>
          {mrfFacilities.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground text-sm">No MRF facilities recorded yet.</p>
          ) : (
            <D3GroupedBarChart
              data={mrfFacilities.map((row) => ({
                name: row.name,
                inboundKg: row.inboundKg,
                processedKg: row.processedKg,
              }))}
              xKey="name"
              series={[
                { key: "inboundKg", label: "Inbound kg", color: "var(--chart-2)" },
                { key: "processedKg", label: "Processed kg", color: "var(--chart-1)" },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <MrfOversightTable facilities={mrfFacilities} />
    </div>
  );
}
