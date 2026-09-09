import { getDataProvider } from "@/lib/firebase/config";
import { loadAppConfig } from "@/server/wasty-actions";

import { ConfigClient } from "./_components/config-client";

const EMPTY_CONFIG = {
  demoMode: false,
  marketplaceEnabled: true,
  instantPayout: false,
  classifierEnabled: true,
  partnerMinVersion: "1.0.0",
  userMinVersion: "1.0.0",
  updateBanner: "",
};

export default async function ConfigPage() {
  const config = await loadAppConfig().catch(() => EMPTY_CONFIG);
  return <ConfigClient initialConfig={config} provider={getDataProvider()} />;
}
