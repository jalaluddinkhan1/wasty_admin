import { redirect } from "next/navigation";

import { defaultLandingFor } from "@/lib/auth/permissions";
import { getEffectiveSession } from "@/lib/auth/require-admin";

export default async function DashboardIndex() {
  const session = await getEffectiveSession();
  redirect(defaultLandingFor(session?.adminType ?? "owner"));
}
