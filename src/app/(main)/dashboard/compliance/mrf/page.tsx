import { parseAnalyticsRange } from "@/lib/analytics/types";
import { getDataProvider } from "@/lib/firebase/config";
import { getComplianceDashboard } from "@/server/wasty-actions";

import { GovMrfClient } from "../_components/gov-mrf-client";

export default async function GovMrfPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseAnalyticsRange(params.range);
  const data = await getComplianceDashboard(range);
  return <GovMrfClient range={range} mrfFacilities={data.mrfFacilities} provider={getDataProvider()} />;
}
