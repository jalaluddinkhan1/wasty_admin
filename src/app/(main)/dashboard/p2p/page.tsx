import { getDataProvider } from "@/lib/firebase/config";
import { listP2pListings } from "@/server/wasty-actions";

import { P2pClient } from "./_components/p2p-client";

export default async function P2pPage() {
  const listings = await listP2pListings();
  return <P2pClient initialListings={listings} provider={getDataProvider()} />;
}
