import { getDataProvider } from "@/lib/firebase/config";
import { listGovernmentAudit } from "@/server/wasty-actions";

import { GovAuditClient } from "../_components/gov-audit-client";

export default async function GovAuditPage() {
  const rows = await listGovernmentAudit().catch(() => []);
  return <GovAuditClient rows={rows} provider={getDataProvider()} />;
}
