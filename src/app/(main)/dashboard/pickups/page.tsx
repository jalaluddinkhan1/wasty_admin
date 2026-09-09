import { getDataProvider } from "@/lib/firebase/config";
import { listPartners, listPickups } from "@/server/wasty-actions";

import { PickupsClient } from "./_components/pickups-client";

export default async function PickupsPage() {
  const [pickups, partners] = await Promise.all([
    listPickups().catch(() => []),
    listPartners().catch(() => []),
  ]);
  return <PickupsClient initialPickups={pickups} partners={partners} provider={getDataProvider()} />;
}
