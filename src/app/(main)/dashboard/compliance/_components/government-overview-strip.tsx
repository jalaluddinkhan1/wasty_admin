import { Home, Recycle, Truck, Warehouse } from "lucide-react";

import { StatCards } from "@/components/stat-cards";
import type { GovernmentOverview } from "@/lib/analytics/types";

function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

export function GovernmentOverviewStrip({ overview }: { overview: GovernmentOverview }) {
  return (
    <StatCards
      items={[
        {
          title: "Households served",
          value: overview.householdsServed.toLocaleString("en-IN"),
          hint: `${overview.coveragePct}% of ${overview.householdsRegistered.toLocaleString("en-IN")} registered`,
          icon: Home,
        },
        {
          title: "Waste collected",
          value: formatKg(overview.collectedKg),
          hint: `${overview.jobsCompleted} completed pickups in window`,
          icon: Truck,
        },
        {
          title: "Waste recovered",
          value: formatKg(overview.recoveredKg),
          hint: `${overview.recoveryRate}% recovery · ${formatKg(overview.landfillKg)} to landfill`,
          icon: Recycle,
        },
        {
          title: "MRF & zones",
          value: `${overview.mrfCount} MRF · ${overview.activeZones} zones`,
          hint: `${overview.partnersActive} partners online now`,
          icon: Warehouse,
        },
      ]}
    />
  );
}
