export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type AnalyticsOverview = {
  range: AnalyticsRange;
  totalJobs: number;
  completedJobs: number;
  activeJobs: number;
  cancelledJobs: number;
  completedToday: number;
  divertedKg: number;
  recoveryRate: number;
  openAlerts: number;
  partnersOnline: number;
  partnersTotal: number;
  pendingSettlements: number;
  settledAmount: number;
};

export type JobTrendPoint = {
  date: string;
  label: string;
  completed: number;
  active: number;
  cancelled: number;
};

export type WasteStreamSlice = {
  stream: string;
  kg: number;
  key: string;
};

export type PartnerUtilPoint = {
  status: string;
  count: number;
  key: string;
};

export type AlertTrendPoint = {
  date: string;
  label: string;
  open: number;
  resolved: number;
};

export type DiversionPoint = {
  date: string;
  label: string;
  kg: number;
  co2eKg: number;
};

export type SettlementPoint = {
  date: string;
  label: string;
  pending: number;
  settled: number;
};

export type AnalyticsDashboard = {
  overview: AnalyticsOverview;
  jobTrends: JobTrendPoint[];
  wasteStreams: WasteStreamSlice[];
  partnerUtilization: PartnerUtilPoint[];
  alertTrends: AlertTrendPoint[];
  diversionTrends: DiversionPoint[];
  settlementTrends: SettlementPoint[];
};

export type ImpactStats = {
  divertedTons: string;
  recoveryRate: string;
  carbonTons: string;
  bagsRecycled: string;
  divertedKg: number;
  recoveryRateValue: number;
  streamRows: { stream: string; value: string }[];
  streamSlices: WasteStreamSlice[];
  diversionTrends: DiversionPoint[];
};

export type ComplianceJob = {
  id: string;
  user: string;
  partner: string;
  wasteType: string;
  status: string;
  weightKg: number | null;
  location: string;
  createdAt: string | null;
  updatedAt: string | null;
  steps: { step: string; done: boolean }[];
};

export type GovernmentOverview = {
  range: AnalyticsRange;
  householdsRegistered: number;
  householdsServed: number;
  coveragePct: number;
  collectedKg: number;
  recoveredKg: number;
  landfillKg: number;
  recoveryRate: number;
  activeZones: number;
  mrfCount: number;
  partnersActive: number;
  jobsCompleted: number;
};

export type AreaOversightRow = {
  area: string;
  zoneId: string;
  householdTarget: number;
  householdsServed: number;
  coveragePct: number;
  partnersActive: number;
  jobsCompleted: number;
  collectedKg: number;
  recoveredKg: number;
  recoveryRate: number;
};

export type MrfOversightRow = {
  id: string;
  name: string;
  zone: string;
  capacity: string;
  status: string;
  inboundKg: number;
  processedKg: number;
  recoveryRate: number;
  householdsServed: number;
};

export type ComplianceDashboard = {
  range: AnalyticsRange;
  overview: GovernmentOverview;
  areas: AreaOversightRow[];
  mrfFacilities: MrfOversightRow[];
  statusCounts: { status: string; count: number }[];
  recentJobs: ComplianceJob[];
  audit: {
    id: string;
    action: string;
    actor: string;
    target: string;
    detail: string;
    createdAt: string | null;
  }[];
};

export type AdminRecord = {
  uid: string;
  email: string;
  adminType: string;
  status: string;
  createdAt: string | null;
  createdBy: string | null;
};

export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  if (typeof value === "string" && (ANALYTICS_RANGES as readonly string[]).includes(value)) {
    return value as AnalyticsRange;
  }
  return "30d";
}

export function rangeDays(range: AnalyticsRange): number {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

export function rangeStartIso(range: AnalyticsRange): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (rangeDays(range) - 1));
  return start.toISOString();
}

export function dayKey(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function emptyDayKeys(range: AnalyticsRange): string[] {
  const days = rangeDays(range);
  const keys: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i += 1) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function slugStream(stream: string): string {
  return (
    stream
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "mixed"
  );
}
