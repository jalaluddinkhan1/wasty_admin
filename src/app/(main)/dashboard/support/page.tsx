import { getDataProvider } from "@/lib/firebase/config";
import { listSupportTickets } from "@/server/wasty-actions";

import { SupportClient } from "./_components/support-client";

export default async function SupportPage() {
  const tickets = await listSupportTickets().catch(() => []);
  return <SupportClient initialTickets={tickets} provider={getDataProvider()} />;
}
