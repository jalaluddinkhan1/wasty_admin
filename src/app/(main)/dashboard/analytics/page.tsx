import { parseAnalyticsRange } from "@/lib/analytics/types";
import { hasPermission } from "@/lib/auth/permissions";
import { getEffectiveSession } from "@/lib/auth/require-admin";
import { getDataProvider } from "@/lib/firebase/config";
import { getAnalyticsDashboard } from "@/server/wasty-actions";

import { AnalyticsClient } from "./_components/analytics-client";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const range = parseAnalyticsRange(params.range);
  const [dashboard, session] = await Promise.all([
    getAnalyticsDashboard(range).catch(async () => {
      const { demoAnalyticsDashboard } = await import("@/lib/analytics/demo");
      return demoAnalyticsDashboard(range);
    }),
    getEffectiveSession(),
  ]);
  const adminType = session?.adminType ?? "owner";

  return (
    <AnalyticsClient
      dashboard={dashboard}
      range={range}
      canViewSettlements={hasPermission(adminType, "settlements:read")}
      provider={getDataProvider()}
    />
  );
}
