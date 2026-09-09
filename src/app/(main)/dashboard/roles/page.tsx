import { getDataProvider } from "@/lib/firebase/config";
import { listAdminAudit, listAdmins } from "@/server/wasty-actions";

import { RolesClient } from "./_components/roles-client";

export default async function RolesPage() {
  const [admins, audit] = await Promise.all([
    listAdmins().catch(() => []),
    listAdminAudit().catch(() => []),
  ]);
  return <RolesClient admins={admins} audit={audit} provider={getDataProvider()} />;
}
