import { parseAnalyticsRange } from "@/lib/analytics/types";
import { getDataProvider } from "@/lib/firebase/config";
import { getCommandDeskData } from "@/server/wasty-actions";

import { CommandDeskClient } from "./_components/command-desk-client";

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseAnalyticsRange(params.range);
  const { demoCommandDesk } = await import("@/lib/government/demo");
  const data = await getCommandDeskData(range).catch(() => demoCommandDesk(range));
  return <CommandDeskClient data={data} range={range} provider={getDataProvider()} />;
}
