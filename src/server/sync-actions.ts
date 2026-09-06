"use server";

import { getDataProvider } from "@/lib/firebase/config";
import { syncSince } from "@/server/aws-actions";

export async function pollSyncSince(since = 0) {
  if (getDataProvider() !== "aws") {
    return { events: [] as { type: string; payload: unknown; ts: number }[], cursor: String(Date.now()) };
  }
  return syncSince(since);
}
