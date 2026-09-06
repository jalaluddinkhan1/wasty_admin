import { getDataProvider } from "@/lib/firebase/config";
import { listProducts } from "@/server/wasty-actions";

import { MarketplaceClient } from "./_components/marketplace-client";

export default async function MarketplacePage() {
  const products = await listProducts();
  return <MarketplaceClient initialProducts={products} provider={getDataProvider()} />;
}
