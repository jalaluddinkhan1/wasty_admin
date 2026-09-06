import { getDataProvider } from "@/lib/firebase/config";
import { listBuyers } from "@/server/wasty-actions";

import { BuyersClient } from "./_components/buyers-client";

export default async function BuyersPage() {
  const buyers = await listBuyers();
  return <BuyersClient initialBuyers={buyers} provider={getDataProvider()} />;
}
