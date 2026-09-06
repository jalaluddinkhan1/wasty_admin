import { getDataProvider } from "@/lib/firebase/config";
import { getImpactStats } from "@/server/wasty-actions";

import { ImpactClient } from "./_components/impact-client";

export default async function ImpactPage() {
  const stats = await getImpactStats();
  return <ImpactClient stats={stats} provider={getDataProvider()} />;
}
