import type { AnalyticsRange } from "@/lib/analytics/types";

export type CitizenReportStatus = "submitted" | "in_progress" | "resolved" | "escalated";

export type CitizenReportRow = {
  id: string;
  userId: string;
  userName: string;
  phone: string | null;
  issueType: string;
  notes: string;
  status: CitizenReportStatus;
  area: string;
  govNotes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GovJobStep = { step: string; done: boolean };

export type GovJobRow = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string | null;
  partnerName: string;
  area: string;
  location: string;
  wasteType: string;
  weightKg: number | null;
  status: string;
  steps: GovJobStep[];
  updatedAt: string | null;
  beforePhoto: string | null;
  afterPhoto: string | null;
};

export type GovHouseholdRow = {
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  area: string;
  wasteDivertedKg: number;
  jobsCompleted: number;
  openReports: number;
};

export type GovHouseholdProfile = GovHouseholdRow & {
  points: number;
  carbonCreditsKg: number;
  recentJobs: GovJobRow[];
  recentReports: CitizenReportRow[];
};

export type GovCaseQueue = {
  citizenPending: number;
  citizenInProgress: number;
  citizenEscalated: number;
  jobsActive: number;
  partnerAlertsOpen: number;
};

export type CommandDeskData = {
  range: AnalyticsRange;
  queue: GovCaseQueue;
  recentReports: CitizenReportRow[];
  recentJobs: GovJobRow[];
  overview: {
    householdsServed: number;
    collectedKg: number;
    recoveredKg: number;
    recoveryRate: number;
  };
};

export const CITIZEN_REPORT_STATUSES: CitizenReportStatus[] = [
  "submitted",
  "in_progress",
  "resolved",
  "escalated",
];

export function normalizeCitizenStatus(value: unknown): CitizenReportStatus {
  const raw = String(value ?? "submitted").toLowerCase().replace(/\s+/g, "_");
  if (raw === "in_progress" || raw === "inprogress") return "in_progress";
  if (raw === "resolved" || raw === "closed") return "resolved";
  if (raw === "escalated") return "escalated";
  return "submitted";
}
