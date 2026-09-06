"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { D3RadialGauge } from "@/components/d3/radial";
import { formatKg } from "@/components/d3/core";
import type { AnalyticsDashboard, AnalyticsRange } from "@/lib/analytics/types";

import { AlertTrendsChart } from "./alert-trends-chart";
import { DiversionTrendChart } from "./diversion-trend-chart";
import { JobTrendsChart } from "./job-trends-chart";
import { OverviewKpiStrip } from "./overview-kpi-strip";
import { PartnerUtilizationChart } from "./partner-utilization-chart";
import { SettlementChart } from "./settlement-chart";
import { WasteStreamChart } from "./waste-stream-chart";
import { AnalyticsToolbar } from "./wasty-analytics-toolbar";

export function AnalyticsClient({
  dashboard,
  range,
  canViewSettlements,
  provider,
}: {
  dashboard: AnalyticsDashboard;
  range: AnalyticsRange;
  canViewSettlements: boolean;
  provider: "sqlite" | "firebase" | "aws";
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Analytics"
        description={
          provider === "firebase"
            ? "Live operations, recovery, and impact trends from the Wasty network."
            : "Demo series while SQLite is active. Connect Firebase for live city data."
        }
        actions={<AnalyticsToolbar range={range} dashboard={dashboard} />}
      />

      <OverviewKpiStrip overview={dashboard.overview} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recovery</CardTitle>
            <CardDescription>Non-mixed material recovered from completed jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3RadialGauge
              value={dashboard.overview.recoveryRate}
              label="recovery rate"
              hint={formatKg(dashboard.overview.divertedKg)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs completed today</CardTitle>
            <CardDescription>Share of today's completions vs the current range total.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3RadialGauge
              value={
                dashboard.overview.completedJobs > 0
                  ? Math.round((dashboard.overview.completedToday / dashboard.overview.completedJobs) * 100)
                  : 0
              }
              label="of range completions"
              hint={`${dashboard.overview.completedToday} today`}
              color="var(--chart-2)"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fleet online</CardTitle>
            <CardDescription>Partners currently available on the roster.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3RadialGauge
              value={
                dashboard.overview.partnersTotal > 0
                  ? Math.round((dashboard.overview.partnersOnline / dashboard.overview.partnersTotal) * 100)
                  : 0
              }
              label="partners online"
              hint={`${dashboard.overview.partnersOnline}/${dashboard.overview.partnersTotal}`}
              color="var(--chart-3)"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <JobTrendsChart data={dashboard.jobTrends} />
        </div>
        <div className="xl:col-span-5">
          <WasteStreamChart data={dashboard.wasteStreams} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DiversionTrendChart data={dashboard.diversionTrends} />
        <AlertTrendsChart data={dashboard.alertTrends} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PartnerUtilizationChart data={dashboard.partnerUtilization} />
        {canViewSettlements ? <SettlementChart data={dashboard.settlementTrends} /> : null}
      </div>
    </div>
  );
}
