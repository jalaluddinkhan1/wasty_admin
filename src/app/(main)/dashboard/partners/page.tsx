import { getDataProvider } from "@/lib/firebase/config";
import { listPartners } from "@/server/wasty-actions";

import { PartnersClient } from "./_components/partners-client";

export default async function PartnersPage() {
  const partners = await listPartners();
  return <PartnersClient initialPartners={partners} provider={getDataProvider()} />;
}
