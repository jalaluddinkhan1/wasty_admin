import { getDataProvider } from "@/lib/firebase/config";
import { listBags } from "@/server/wasty-actions";

import { BagsClient } from "./_components/bags-client";

export default async function BagsPage() {
  const bags = await listBags().catch(() => []);
  return <BagsClient initialBags={bags} provider={getDataProvider()} />;
}
