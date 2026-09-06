import { AlertTriangle, Leaf, Package, Truck } from "lucide-react";

import { StatCards } from "@/components/stat-cards";
import type { AnalyticsOverview } from "@/lib/analytics/types";

export function OverviewKpiStrip({ overview }: { overview: AnalyticsOverview }) {
  return (
    <StatCards
      items={[
        {
          title: "Jobs completed",
          value: String(overview.completedJobs),
          hint: `${overview.completedToday} today · ${overview.activeJobs} still live`,
          icon: Package,
        },
        {
          title: "Diverted",
          value:
            overview.divertedKg >= 1000
              ? `${(overview.divertedKg / 1000).toFixed(1)} t`
              : `${Math.round(overview.divertedKg)} kg`,
          hint: `${overview.recoveryRate}% recovery rate`,
          icon: Leaf,
        },
        {
          title: "Partners online",
          value: `${overview.partnersOnline}/${overview.partnersTotal}`,
          hint: "Active on the roster",
          icon: Truck,
        },
        {
          title: "Open alerts",
          value: String(overview.openAlerts),
          hint: "Ops reports still open",
          icon: AlertTriangle,
        },
      ]}
    />
  );
}
