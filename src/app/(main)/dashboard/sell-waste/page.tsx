import { getDataProvider } from "@/lib/firebase/config";
import { listSellRequests } from "@/server/wasty-actions";

import { SellWasteClient } from "./_components/sell-waste-client";

export default async function SellWastePage() {
  const requests = await listSellRequests();
  return <SellWasteClient initialRequests={requests} provider={getDataProvider()} />;
}
