import { parseAnalyticsRange } from "@/lib/analytics/types";
import { getDataProvider } from "@/lib/firebase/config";
import {
  getComplianceDashboard,
  listCitizenReports,
  listGovernmentAudit,
  listGovernmentJobs,
} from "@/server/wasty-actions";

import { GovExportsClient } from "../_components/gov-exports-client";

export default async function GovExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseAnalyticsRange(params.range);
  const [dashboard, jobs, reports, audit] = await Promise.all([
    getComplianceDashboard(range),
    listGovernmentJobs(),
    listCitizenReports(),
    listGovernmentAudit(),
  ]);

  return (
    <GovExportsClient
      range={range}
      areas={dashboard.areas}
      mrfFacilities={dashboard.mrfFacilities}
      jobs={jobs}
      reports={reports}
      audit={audit}
      provider={getDataProvider()}
    />
  );
}
