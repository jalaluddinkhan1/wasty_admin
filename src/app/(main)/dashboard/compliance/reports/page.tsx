import { getDataProvider } from "@/lib/firebase/config";
import { listCitizenReports } from "@/server/wasty-actions";

import { CitizenReportsClient } from "../_components/citizen-reports-client";

export default async function CitizenReportsPage() {
  const reports = await listCitizenReports();
  return <CitizenReportsClient initialReports={reports} provider={getDataProvider()} />;
}
