"use client";

import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "@/components/simple-data-table";

const toneByStatus: Record<string, StatusTone> = {
  "on the way": "warning",
  arrived: "default",
  complete: "success",
  completed: "success",
  scheduled: "muted",
  cancelled: "danger",
  delayed: "danger",
  online: "success",
  "on break": "warning",
  offline: "muted",
  invited: "muted",
  approved: "success",
  pending: "warning",
  active: "success",
  unassigned: "muted",
  collected: "default",
  contaminated: "danger",
  urgent: "danger",
  open: "warning",
  reviewing: "default",
  resolved: "success",
  closed: "success",
  acknowledged: "warning",
  acked: "warning",
  rejected: "danger",
};

export function statusBadge(status: string): ReactNode {
  return <StatusBadge label={status} tone={toneByStatus[status] ?? "default"} />;
}
