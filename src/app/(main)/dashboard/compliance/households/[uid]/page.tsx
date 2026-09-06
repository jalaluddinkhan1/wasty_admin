import { notFound } from "next/navigation";

import { getDataProvider } from "@/lib/firebase/config";
import { getGovernmentHouseholdProfile } from "@/server/wasty-actions";

import { GovHouseholdProfileClient } from "../../_components/gov-households-client";

export default async function GovHouseholdProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const profile = await getGovernmentHouseholdProfile(uid);
  if (!profile) notFound();
  return <GovHouseholdProfileClient profile={profile} />;
}
