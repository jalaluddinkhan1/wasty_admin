import { getDataProvider } from "@/lib/firebase/config";
import { listUsers } from "@/server/wasty-actions";

import { UsersClient } from "./_components/users-client";

export default async function UsersPage() {
  const users = await listUsers();
  return <UsersClient initialUsers={users} provider={getDataProvider()} />;
}
