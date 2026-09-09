import { getDataProvider } from "@/lib/firebase/config";
import { getLiveMapSnapshot } from "@/server/wasty-actions";

import { LiveMapClient } from "./_components/live-map-client";

export const dynamic = "force-dynamic";

export default async function LiveMapPage() {
  const snapshot = await getLiveMapSnapshot().catch(() => ({
    points: [],
    stats: { pickups: 0, vehicles: 0, bins: 0, alerts: 0 },
    generatedAt: new Date().toISOString(),
  }));
  return <LiveMapClient snapshot={snapshot} provider={getDataProvider()} />;
}
