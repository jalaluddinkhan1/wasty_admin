import { getDataProvider } from "@/lib/firebase/config";
import { listPushHistory } from "@/server/wasty-actions";

import { NotificationsClient } from "./_components/notifications-client";

export default async function NotificationsPage() {
  const provider = getDataProvider();
  const history = provider === "firebase" ? await listPushHistory().catch(() => []) : [];

  return <NotificationsClient provider={provider} history={history} />;
}
