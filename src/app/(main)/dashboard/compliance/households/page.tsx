import { getDataProvider } from "@/lib/firebase/config";
import { listGovernmentHouseholds } from "@/server/wasty-actions";

import { GovHouseholdsClient } from "../_components/gov-households-client";

export default async function GovHouseholdsPage() {
  const households = await listGovernmentHouseholds().catch(() => []);
  return <GovHouseholdsClient households={households} provider={getDataProvider()} />;
}
