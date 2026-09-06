import { getDataProvider } from "@/lib/firebase/config";
import { listBins } from "@/server/wasty-actions";

import { BinsClient } from "./_components/bins-client";

export default async function BinsPage() {
  const bins = await listBins();
  return <BinsClient initialBins={bins} provider={getDataProvider()} />;
}
