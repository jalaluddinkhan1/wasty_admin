import { getDataProvider } from "@/lib/firebase/config";
import { listGovernmentJobs } from "@/server/wasty-actions";

import { GovJobsClient } from "../_components/gov-jobs-client";

export default async function GovJobsPage() {
  const jobs = await listGovernmentJobs().catch(() => []);
  return <GovJobsClient jobs={jobs} provider={getDataProvider()} />;
}
