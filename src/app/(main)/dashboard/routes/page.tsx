import { getDataProvider } from "@/lib/firebase/config";
import { listDailyRoutes, listPartners, listPickups } from "@/server/wasty-actions";

import { RoutesClient } from "./_components/routes-client";

export default async function RoutesPage() {
  const [routes, partners, pickups] = await Promise.all([listDailyRoutes(), listPartners(), listPickups()]);
  return (
    <RoutesClient initialRoutes={routes} partners={partners} jobs={pickups} provider={getDataProvider()} />
  );
}
