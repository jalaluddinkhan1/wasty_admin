import {
  type AlertTrendPoint,
  type AnalyticsDashboard,
  type AnalyticsRange,
  type AreaOversightRow,
  type ComplianceDashboard,
  type DiversionPoint,
  emptyDayKeys,
  formatDayLabel,
  type ImpactStats,
  type JobTrendPoint,
  type MrfOversightRow,
  type SettlementPoint,
  slugStream,
} from "@/lib/analytics/types";

function wave(index: number, amplitude: number, base: number) {
  return Math.max(0, Math.round(base + Math.sin(index / 2.4) * amplitude + (index % 5) - 2));
}

function jobTrends(range: AnalyticsRange): JobTrendPoint[] {
  return emptyDayKeys(range).map((date, index) => ({
    date,
    label: formatDayLabel(date),
    completed: wave(index, 8, 14),
    active: wave(index + 1, 4, 6),
    cancelled: Math.max(0, wave(index + 3, 2, 2) - 2),
  }));
}

function diversionTrends(range: AnalyticsRange): DiversionPoint[] {
  return emptyDayKeys(range).map((date, index) => {
    const kg = wave(index, 40, 90);
    return { date, label: formatDayLabel(date), kg, co2eKg: Math.round(kg * 2.2) };
  });
}

function alertTrends(range: AnalyticsRange): AlertTrendPoint[] {
  return emptyDayKeys(range).map((date, index) => ({
    date,
    label: formatDayLabel(date),
    open: wave(index, 3, 4),
    resolved: wave(index + 2, 4, 5),
  }));
}

function settlementTrends(range: AnalyticsRange): SettlementPoint[] {
  return emptyDayKeys(range).map((date, index) => ({
    date,
    label: formatDayLabel(date),
    pending: wave(index, 1200, 2800),
    settled: wave(index + 1, 1600, 4200),
  }));
}

export function demoAnalyticsDashboard(range: AnalyticsRange): AnalyticsDashboard {
  const trends = jobTrends(range);
  const diversion = diversionTrends(range);
  const completedJobs = trends.reduce((sum, row) => sum + row.completed, 0);
  const activeJobs = trends.at(-1)?.active ?? 0;
  const cancelledJobs = trends.reduce((sum, row) => sum + row.cancelled, 0);
  const divertedKg = diversion.reduce((sum, row) => sum + row.kg, 0);

  return {
    overview: {
      range,
      totalJobs: completedJobs + activeJobs + cancelledJobs,
      completedJobs,
      activeJobs,
      cancelledJobs,
      completedToday: trends.at(-1)?.completed ?? 0,
      divertedKg,
      recoveryRate: 78,
      openAlerts: 6,
      partnersOnline: 18,
      partnersTotal: 24,
      pendingSettlements: 18400,
      settledAmount: 64200,
    },
    jobTrends: trends,
    wasteStreams: [
      { stream: "Dry recyclables", kg: Math.round(divertedKg * 0.38), key: slugStream("Dry recyclables") },
      { stream: "Organic", kg: Math.round(divertedKg * 0.27), key: slugStream("Organic") },
      { stream: "Plastic", kg: Math.round(divertedKg * 0.18), key: slugStream("Plastic") },
      { stream: "E-waste", kg: Math.round(divertedKg * 0.09), key: slugStream("E-waste") },
      { stream: "Mixed", kg: Math.round(divertedKg * 0.08), key: slugStream("Mixed") },
    ],
    partnerUtilization: [
      { status: "Online", count: 18, key: "online" },
      { status: "Offline", count: 4, key: "offline" },
      { status: "Pending KYC", count: 2, key: "pending" },
    ],
    alertTrends: alertTrends(range),
    diversionTrends: diversion,
    settlementTrends: settlementTrends(range),
  };
}

export function demoImpactStats(range: AnalyticsRange = "30d"): ImpactStats {
  const dashboard = demoAnalyticsDashboard(range);
  const divertedKg = dashboard.overview.divertedKg;
  return {
    divertedTons: (divertedKg / 1000).toFixed(1),
    recoveryRate: String(dashboard.overview.recoveryRate),
    carbonTons: ((divertedKg * 2.2) / 1000).toFixed(1),
    bagsRecycled: "128",
    divertedKg,
    recoveryRateValue: dashboard.overview.recoveryRate,
    streamRows: dashboard.wasteStreams.map((row) => ({
      stream: row.stream,
      value: row.kg >= 1000 ? `${(row.kg / 1000).toFixed(1)} t` : `${row.kg} kg`,
    })),
    streamSlices: dashboard.wasteStreams,
    diversionTrends: dashboard.diversionTrends,
  };
}

export function demoComplianceDashboard(range: AnalyticsRange = "30d"): ComplianceDashboard {
  const statuses = ["scheduled", "on_the_way", "arrived", "completed", "cancelled"] as const;
  const areas: AreaOversightRow[] = [
    {
      area: "Indiranagar",
      zoneId: "indiranagar",
      householdTarget: 12400,
      householdsServed: 3820,
      coveragePct: 31,
      partnersActive: 18,
      jobsCompleted: 412,
      collectedKg: 18420,
      recoveredKg: 15280,
      recoveryRate: 83,
    },
    {
      area: "Koramangala",
      zoneId: "koramangala",
      householdTarget: 15800,
      householdsServed: 4510,
      coveragePct: 29,
      partnersActive: 22,
      jobsCompleted: 498,
      collectedKg: 22150,
      recoveredKg: 17840,
      recoveryRate: 81,
    },
    {
      area: "HSR Layout",
      zoneId: "hsr-layout",
      householdTarget: 11200,
      householdsServed: 2890,
      coveragePct: 26,
      partnersActive: 14,
      jobsCompleted: 318,
      collectedKg: 14280,
      recoveredKg: 11420,
      recoveryRate: 80,
    },
    {
      area: "Whitefield",
      zoneId: "whitefield",
      householdTarget: 18600,
      householdsServed: 5240,
      coveragePct: 28,
      partnersActive: 26,
      jobsCompleted: 562,
      collectedKg: 26840,
      recoveredKg: 21910,
      recoveryRate: 82,
    },
    {
      area: "Jayanagar",
      zoneId: "jayanagar",
      householdTarget: 9800,
      householdsServed: 2140,
      coveragePct: 22,
      partnersActive: 11,
      jobsCompleted: 244,
      collectedKg: 10920,
      recoveredKg: 8640,
      recoveryRate: 79,
    },
  ];

  const mrfFacilities: MrfOversightRow[] = [
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
      zone: "Koramangala · HSR · Jayanagar",
      capacity: "36 t/day",
      status: "running",
      inboundKg: 22180,
      processedKg: 18240,
      recoveryRate: 82,
      householdsServed: 9540,
    },
    {
      id: "mrf-east",
      name: "East Sorting Hub",
      zone: "Whitefield",
      capacity: "18 t/day",
      status: "maintenance",
      inboundKg: 8200,
      processedKg: 6100,
      recoveryRate: 74,
      householdsServed: 2100,
    },
  ];

  const collectedKg = areas.reduce((s, a) => s + a.collectedKg, 0);
  const recoveredKg = areas.reduce((s, a) => s + a.recoveredKg, 0);
  const householdsServed = areas.reduce((s, a) => s + a.householdsServed, 0);
  const householdTarget = areas.reduce((s, a) => s + a.householdTarget, 0);

  return {
    range,
    overview: {
      range,
      householdsRegistered: 28400,
      householdsServed,
      coveragePct: Math.round((householdsServed / householdTarget) * 100),
      collectedKg,
      recoveredKg,
      landfillKg: Math.max(0, collectedKg - recoveredKg),
      recoveryRate: collectedKg > 0 ? Math.round((recoveredKg / collectedKg) * 100) : 0,
      activeZones: areas.length,
      mrfCount: mrfFacilities.length,
      partnersActive: areas.reduce((s, a) => s + a.partnersActive, 0),
      jobsCompleted: areas.reduce((s, a) => s + a.jobsCompleted, 0),
    },
    areas,
    mrfFacilities,
    statusCounts: [
      { status: "scheduled", count: 11 },
      { status: "on_the_way", count: 7 },
      { status: "arrived", count: 4 },
      { status: "completed", count: 42 },
      { status: "cancelled", count: 3 },
    ],
    recentJobs: Array.from({ length: 8 }, (_, index) => {
      const status = statuses[index % statuses.length];
      const pipeline = ["scheduled", "on_the_way", "arrived", "completed"];
      const current = pipeline.indexOf(status);
      const area = areas[index % areas.length];
      return {
        id: `JOB-DEMO-${index + 1}`,
        user: `Household ${120 + index}`,
        partner: index % 3 === 0 ? "Unassigned" : `Partner ${index + 1}`,
        wasteType: ["Dry", "Organic", "Plastic", "Mixed"][index % 4],
        status,
        weightKg: status === "completed" ? 12 + index : null,
        location: area.area,
        createdAt: new Date(Date.now() - index * 36e5).toISOString(),
        updatedAt: new Date(Date.now() - index * 18e5).toISOString(),
        steps: pipeline.map((step, stepIndex) => ({
          step,
          done: status === "cancelled" ? false : current >= 0 && stepIndex <= current,
        })),
      };
    }),
    audit: [
      {
        id: "audit-1",
        action: "job.completed",
        actor: "ops@wasty.app",
        target: "JOB-DEMO-1",
        detail: "Pickup closed after photo verification",
        createdAt: new Date().toISOString(),
      },
      {
        id: "audit-2",
        action: "partner.approved",
        actor: "ops@wasty.app",
        target: "partner-9",
        detail: "KYC approved for zone North",
        createdAt: new Date(Date.now() - 7200_000).toISOString(),
      },
    ],
  };
}
