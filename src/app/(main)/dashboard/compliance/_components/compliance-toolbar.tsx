"use client";

import { useRouter } from "next/navigation";

import { RefreshCw } from "lucide-react";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsRange, ComplianceDashboard } from "@/lib/analytics/types";

function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

export function ComplianceToolbar({ range, data }: { range: AnalyticsRange; data: ComplianceDashboard }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={range}
        onValueChange={(value) => {
          router.push(`/dashboard/compliance?range=${value}`);
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" aria-label="Refresh" onClick={() => router.refresh()}>
        <RefreshCw className="size-4" />
      </Button>
      <ExportCsvButton
        label="Export areas"
        filename={`wasty-areas-${range}.csv`}
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
        rows={data.areas.map((row) => [
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
      <ExportCsvButton
        label="Export MRF"
        filename={`wasty-mrf-${range}.csv`}
        headers={["MRF", "Zone", "Capacity", "Status", "Inbound kg", "Processed kg", "Recovery %", "Households"]}
        rows={data.mrfFacilities.map((row) => [
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
      <ExportCsvButton
        label="Full report"
        filename={`wasty-city-oversight-${range}.csv`}
        headers={["Metric", "Value"]}
        rows={[
          ["Households registered", String(data.overview.householdsRegistered)],
          ["Households served", String(data.overview.householdsServed)],
          ["Coverage %", String(data.overview.coveragePct)],
          ["Waste collected", formatKg(data.overview.collectedKg)],
          ["Waste recovered", formatKg(data.overview.recoveredKg)],
          ["Sent to landfill", formatKg(data.overview.landfillKg)],
          ["Recovery rate %", String(data.overview.recoveryRate)],
          ["Active zones", String(data.overview.activeZones)],
          ["MRF facilities", String(data.overview.mrfCount)],
          ["Partners online", String(data.overview.partnersActive)],
          ["Jobs completed", String(data.overview.jobsCompleted)],
        ]}
      />
    </div>
  );
}
