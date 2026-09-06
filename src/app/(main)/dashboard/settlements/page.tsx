import { getDataProvider } from "@/lib/firebase/config";
import { getSettlementsSummary, listPayoutEntries } from "@/server/wasty-actions";

import { SettlementsClient } from "./_components/settlements-client";

export default async function SettlementsPage() {
  const [entries, summary] = await Promise.all([listPayoutEntries(), getSettlementsSummary()]);
  return <SettlementsClient initialEntries={entries} summary={summary} provider={getDataProvider()} />;
}
