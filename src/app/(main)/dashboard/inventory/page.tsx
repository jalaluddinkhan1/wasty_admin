import { getDataProvider } from "@/lib/firebase/config";
import { listMaterialLots } from "@/server/wasty-actions";

import { InventoryClient } from "./_components/inventory-client";

export default async function InventoryPage() {
  const lots = await listMaterialLots();
  return <InventoryClient initialLots={lots} provider={getDataProvider()} />;
}
