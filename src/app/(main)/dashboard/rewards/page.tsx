import { getDataProvider } from "@/lib/firebase/config";
import { listRewardsCatalog, listUsers } from "@/server/wasty-actions";

import { RewardsClient } from "./_components/rewards-client";

export default async function RewardsPage() {
  const [rewards, users] = await Promise.all([listRewardsCatalog(), listUsers()]);
  return <RewardsClient initialRewards={rewards} users={users} provider={getDataProvider()} />;
}
