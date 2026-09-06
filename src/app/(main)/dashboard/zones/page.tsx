import { getDataProvider } from "@/lib/firebase/config";
import { listServiceZones } from "@/server/wasty-actions";

import { ZonesClient } from "./_components/zones-client";

export default async function ZonesPage() {
  const zones = await listServiceZones();
  return <ZonesClient initialZones={zones} provider={getDataProvider()} />;
}
