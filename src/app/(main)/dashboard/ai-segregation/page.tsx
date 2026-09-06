import { getDataProvider } from "@/lib/firebase/config";
import { getLiveAiModel, listAiJobs } from "@/server/wasty-actions";

import { AiSegregationClient } from "./_components/ai-segregation-client";

export default async function AiSegregationPage() {
  const [jobs, liveModel] = await Promise.all([listAiJobs(), getLiveAiModel()]);
  return <AiSegregationClient initialJobs={jobs} liveModel={liveModel} provider={getDataProvider()} />;
}
