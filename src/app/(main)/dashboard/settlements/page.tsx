import { getDataProvider } from "@/lib/firebase/config";
import { getSettlementsSummary, listPayoutEntries } from "@/server/wasty-actions";

import { SettlementsClient } from "./_components/settlements-client";

export default async function SettlementsPage() {
  const emptySummary = { totalAmount: 0, settledAmount: 0, pendingAmount: 0, entryCount: 0 };
  const [entries, summary] = await Promise.all([
    listPayoutEntries().catch(() => []),
    getSettlementsSummary().catch(() => emptySummary),
  ]);
  return <SettlementsClient initialEntries={entries} summary={summary} provider={getDataProvider()} />;
}
