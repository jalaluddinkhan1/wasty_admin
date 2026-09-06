import { parseAnalyticsRange } from "@/lib/analytics/types";
import { getDataProvider } from "@/lib/firebase/config";
import { getComplianceDashboard } from "@/server/wasty-actions";

import { GovZonesClient } from "../_components/gov-zones-client";

export default async function GovZonesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseAnalyticsRange(params.range);
  const data = await getComplianceDashboard(range);
  return <GovZonesClient range={range} areas={data.areas} provider={getDataProvider()} />;
}
