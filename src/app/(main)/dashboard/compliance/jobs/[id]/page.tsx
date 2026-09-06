import { notFound } from "next/navigation";

import { getDataProvider } from "@/lib/firebase/config";
import { getGovernmentJobDetail } from "@/server/wasty-actions";

import { GovJobDetailClient } from "../../_components/gov-job-detail-client";

export default async function GovJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getGovernmentJobDetail(id);
  if (!job) notFound();
  return <GovJobDetailClient job={job} provider={getDataProvider()} />;
}
