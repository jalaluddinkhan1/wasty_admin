import { getDataProvider } from "@/lib/firebase/config";
import { loadAppConfig } from "@/server/wasty-actions";

import { ConfigClient } from "./_components/config-client";

export default async function ConfigPage() {
  const config = await loadAppConfig();
  return <ConfigClient initialConfig={config} provider={getDataProvider()} />;
}
