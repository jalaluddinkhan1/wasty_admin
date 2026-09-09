import { getDataProvider } from "@/lib/firebase/config";
import { listMrfFacilities, listMrfInbound } from "@/server/wasty-actions";

import { MrfClient } from "./_components/mrf-client";

export default async function MrfPage() {
  const [facilities, inbound] = await Promise.all([
    listMrfFacilities().catch(() => []),
    listMrfInbound().catch(() => []),
  ]);
  return <MrfClient initialFacilities={facilities} initialInbound={inbound} provider={getDataProvider()} />;
}
