import type { AnalyticsRange } from "@/lib/analytics/types";
import type {
  CitizenReportRow,
  CommandDeskData,
  GovCaseQueue,
  GovHouseholdProfile,
  GovHouseholdRow,
  GovJobRow,
} from "@/lib/government/types";
import type { AreaOversightRow, MrfOversightRow } from "@/lib/analytics/types";

const ISSUE_TYPES = [
  "Missed Pickup",
  "Illegal Dumping",
  "Overflowing Bin",
  "Broken Bin",
  "Littering",
] as const;

const AREAS = ["Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Jayanagar"] as const;

function demoReports(): CitizenReportRow[] {
  const statuses = ["submitted", "in_progress", "resolved", "escalated"] as const;
  return Array.from({ length: 20 }, (_, i) => ({
    id: `RPT-${1000 + i}`,
    userId: `user-${(i % 8) + 1}`,
    userName: ["Aisha Khan", "Green Cafe", "Nikhil Rao", "Priya Shah", "Ravi Stores"][i % 5],
    phone: `+91 98${String(10000000 + i).slice(0, 8)}`,
    issueType: ISSUE_TYPES[i % ISSUE_TYPES.length],
    notes: `Citizen report #${i + 1}: service issue in ${AREAS[i % AREAS.length]}.`,
    status: statuses[i % statuses.length],
    area: AREAS[i % AREAS.length],
    govNotes: i % 4 === 0 ? "Acknowledged by city desk." : null,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
  }));
}

function demoJobs(): GovJobRow[] {
  const pipeline = ["scheduled", "on_the_way", "arrived", "completed"] as const;
  return Array.from({ length: 24 }, (_, i) => {
    const status = ["scheduled", "on_the_way", "arrived", "completed", "cancelled"][i % 5];
    const current = pipeline.indexOf(status as (typeof pipeline)[number]);
    return {
      id: `JOB-DEMO-${i + 1}`,
      userId: `user-${(i % 8) + 1}`,
      userName: ["Aisha Khan", "Green Cafe", "Nikhil Rao", "Priya Shah"][i % 4],
      userPhone: `+91 98${String(20000000 + i).slice(0, 8)}`,
      partnerName: i % 3 === 0 ? "Unassigned" : ["Ravi Kumar", "Meera Joshi", "Anil Das"][i % 3],
      area: AREAS[i % AREAS.length],
      location: `${AREAS[i % AREAS.length]}, Bengaluru`,
      wasteType: ["Dry", "Organic", "Plastic", "Mixed"][i % 4],
      weightKg: status === "completed" ? 8 + i : null,
      status,
      steps: pipeline.map((step, idx) => ({
        step,
        done: status !== "cancelled" && current >= 0 && idx <= current,
      })),
      updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
      beforePhoto: null,
      afterPhoto: null,
    };
  });
}

let cachedReports = demoReports();
let cachedJobs = demoJobs();

export function demoCitizenReports(filters?: {
  status?: string;
  issueType?: string;
}): CitizenReportRow[] {
  let rows = [...cachedReports];
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters?.issueType) rows = rows.filter((r) => r.issueType === filters.issueType);
  return rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export function demoUpdateCitizenReport(
  userId: string,
  reportId: string,
  status: CitizenReportRow["status"],
  note?: string,
): { ok: true } {
  cachedReports = cachedReports.map((r) =>
    r.id === reportId && r.userId === userId
      ? { ...r, status, govNotes: note ?? r.govNotes, updatedAt: new Date().toISOString() }
      : r,
  );
  return { ok: true };
}

export function demoCaseQueue(): GovCaseQueue {
  const reports = cachedReports;
  return {
    citizenPending: reports.filter((r) => r.status === "submitted").length,
    citizenInProgress: reports.filter((r) => r.status === "in_progress").length,
    citizenEscalated: reports.filter((r) => r.status === "escalated").length,
    jobsActive: cachedJobs.filter((j) => j.status !== "completed" && j.status !== "cancelled").length,
    partnerAlertsOpen: 3,
  };
}

export function demoCommandDesk(range: AnalyticsRange = "30d"): CommandDeskData {
  const reports = demoCitizenReports();
  const jobs = demoJobs();
  const completed = jobs.filter((j) => j.status === "completed");
  const collectedKg = completed.reduce((s, j) => s + (j.weightKg ?? 0), 0);
  const recoveredKg = Math.round(collectedKg * 0.82);
  return {
    range,
    queue: demoCaseQueue(),
    recentReports: reports.slice(0, 6),
    recentJobs: jobs.slice(0, 6),
    overview: {
      householdsServed: 42,
      collectedKg: Math.round(collectedKg),
      recoveredKg,
      recoveryRate: collectedKg > 0 ? Math.round((recoveredKg / collectedKg) * 100) : 0,
    },
  };
}

export function demoGovernmentJobs(filters?: { status?: string; q?: string }): GovJobRow[] {
  let rows = [...cachedJobs];
  if (filters?.status) rows = rows.filter((j) => j.status === filters.status);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (j) =>
        j.id.toLowerCase().includes(q) ||
        j.userName.toLowerCase().includes(q) ||
        j.area.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q),
    );
  }
  return rows;
}

export function demoGovernmentJobDetail(jobId: string): GovJobRow | null {
  return cachedJobs.find((j) => j.id === jobId) ?? null;
}

export function demoGovernmentHouseholds(): GovHouseholdRow[] {
  const byUser = new Map<string, GovHouseholdRow>();
  for (const job of cachedJobs) {
    const existing = byUser.get(job.userId);
    if (!existing) {
      byUser.set(job.userId, {
        uid: job.userId,
        name: job.userName,
        email: `${job.userId}@demo.wasty.app`,
        phone: job.userPhone,
        area: job.area,
        wasteDivertedKg: job.weightKg ?? 0,
        jobsCompleted: job.status === "completed" ? 1 : 0,
        openReports: cachedReports.filter((r) => r.userId === job.userId && r.status !== "resolved").length,
      });
    } else {
      existing.wasteDivertedKg += job.weightKg ?? 0;
      if (job.status === "completed") existing.jobsCompleted += 1;
    }
  }
  return [...byUser.values()];
}

export function demoGovernmentHouseholdProfile(uid: string): GovHouseholdProfile | null {
  const row = demoGovernmentHouseholds().find((h) => h.uid === uid);
  if (!row) return null;
  return {
    ...row,
    points: 420,
    carbonCreditsKg: 12.4,
    recentJobs: cachedJobs.filter((j) => j.userId === uid).slice(0, 10),
    recentReports: cachedReports.filter((r) => r.userId === uid).slice(0, 10),
  };
}

export function demoGovernmentAreas(): AreaOversightRow[] {
  return AREAS.map((area, i) => ({
    area,
    zoneId: area.toLowerCase().replace(/\s+/g, "-"),
    householdTarget: 10000 + i * 2000,
    householdsServed: 2000 + i * 400,
    coveragePct: 20 + i * 2,
    partnersActive: 10 + i,
    jobsCompleted: 40 + i * 10,
    collectedKg: 8000 + i * 1500,
    recoveredKg: 6500 + i * 1200,
    recoveryRate: 80 + i,
  }));
}

export function demoGovernmentMrf(): MrfOversightRow[] {
  return [
    {
      id: "mrf-north",
      name: "North Bengaluru MRF",
      zone: "Indiranagar · Whitefield",
      capacity: "42 t/day",
      status: "running",
      inboundKg: 28400,
      processedKg: 24120,
      recoveryRate: 85,
      householdsServed: 9060,
    },
    {
      id: "mrf-south",
      name: "South Bengaluru MRF",
      zone: "Koramangala · HSR",
      capacity: "36 t/day",
      status: "running",
      inboundKg: 22180,
      processedKg: 18240,
      recoveryRate: 82,
      householdsServed: 7540,
    },
  ];
}

export function demoGovernmentAudit() {
  return [
    {
      id: "audit-1",
      action: "citizen_report.resolved",
      actor: "gov@wasty.app",
      target: "RPT-1002",
      detail: "Missed pickup resolved after partner reassignment",
      createdAt: new Date().toISOString(),
    },
    {
      id: "audit-2",
      action: "citizen_report.escalated",
      actor: "gov@wasty.app",
      target: "RPT-1005",
      detail: "Illegal dumping — forwarded to enforcement",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}
