"use client";

import { useRouter } from "next/navigation";

import { RefreshCw } from "lucide-react";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsDashboard, AnalyticsRange } from "@/lib/analytics/types";

export function AnalyticsToolbar({ range, dashboard }: { range: AnalyticsRange; dashboard: AnalyticsDashboard }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={range}
        onValueChange={(value) => {
          router.push(`/dashboard/analytics?range=${value}`);
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
        label="Export CSV"
        filename={`wasty-analytics-${range}.csv`}
        headers={["Date", "Completed", "Active", "Cancelled", "Diverted kg", "Alerts open"]}
        rows={dashboard.jobTrends.map((row, index) => [
          row.date,
          String(row.completed),
          String(row.active),
          String(row.cancelled),
          String(dashboard.diversionTrends[index]?.kg ?? 0),
          String(dashboard.alertTrends[index]?.open ?? 0),
        ])}
      />
    </div>
  );
}
