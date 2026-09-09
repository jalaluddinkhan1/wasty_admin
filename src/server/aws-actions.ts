"use server";

/**
 * AWS API Gateway + DynamoDB provider — same export surface as firebase-actions
 * so wasty-actions.ts can route via liveActions() without page changes.
 */
import { revalidatePath } from "next/cache";

import { api } from "@/lib/api/client";
import { parseGeo } from "@/lib/live-map/types";
import type { LiveMapSnapshot, LiveMapPoint } from "@/lib/live-map/types";
import { requirePermission } from "@/lib/auth/require-admin";

export type {
  JobRecord,
  PartnerRecord,
  BagRegistryRecord,
  OpsReportRecord,
  ProductWriteInput,
} from "@/server/firebase-actions";

import type { CitizenReportRow } from "@/lib/government/types";
import { normalizeCitizenStatus } from "@/lib/government/types";
import type { SellRequestRecord } from "@/server/firebase-actions";

type OrderRecord = {
  id: string;
  userId: string;
  userName: string;
  total: string;
  totalValue: number;
  status: string;
  paymentMethod: string;
  itemCount: number;
  createdAt: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function geoOf(raw: Record<string, unknown>) {
  const g = parseGeo(raw);
  if (g) return g;
  const geo = raw.geo as { lat?: number; lng?: number } | undefined;
  if (geo?.lat != null && geo?.lng != null) return { lat: geo.lat, lng: geo.lng };
  if (typeof raw.lat === "number" && typeof raw.lng === "number") return { lat: raw.lat, lng: raw.lng };
  return null;
}

function mapJob(raw: Record<string, unknown>): JobRecord {
  const id = String(raw.id ?? raw.jobId ?? "").replace(/^JOB#/, "") || "unknown";
  const geo = geoOf(raw);
  return {
    id,
    userId: String(raw.userId ?? ""),
    pickupId: raw.pickupId != null ? String(raw.pickupId) : null,
    wasteType: String(raw.wasteType ?? "mixed"),
    date: String(raw.date ?? ""),
    time: String(raw.time ?? ""),
    location: String(raw.location ?? ""),
    bags: Number(raw.bags ?? 1) || 1,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    status: String(raw.status ?? "scheduled"),
    assignedPartnerId:
      raw.partnerId != null
        ? String(raw.partnerId)
        : raw.assignedPartnerId != null
          ? String(raw.assignedPartnerId)
          : null,
    cancelReason: raw.cancelReason != null ? String(raw.cancelReason) : null,
    weight: raw.weight != null ? String(raw.weight) : null,
    weightKg: typeof raw.weightKg === "number" ? raw.weightKg : null,
    beforePhoto: raw.beforePhoto != null ? String(raw.beforePhoto) : null,
    afterPhoto: raw.afterPhoto != null ? String(raw.afterPhoto) : null,
    tipAmount: typeof raw.tipAmount === "number" ? raw.tipAmount : null,
    createdAt: String(raw.createdAt ?? nowIso()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? nowIso()),
  };
}

function mapPartner(raw: Record<string, unknown>): PartnerRecord {
  const uid = String(raw.uid ?? raw.id ?? String(raw.PK ?? "").replace(/^PARTNER#/, ""));
  const geo = geoOf(raw);
  const kyc = String(raw.kycStatus ?? raw.docsStatus ?? "pending");
  return {
    id: uid,
    name: String(raw.name ?? "Partner"),
    email: String(raw.email ?? ""),
    phone: raw.phone != null ? String(raw.phone) : null,
    role: raw.role != null ? String(raw.role) : null,
    status: String(raw.status ?? (raw.online ? "online" : "offline")),
    vehicle: raw.vehicle != null ? String(raw.vehicle) : null,
    plateNumber: raw.plateNumber != null ? String(raw.plateNumber) : null,
    serviceArea: String(raw.zone ?? raw.serviceArea ?? "—"),
    photoUrl: raw.photoUrl != null ? String(raw.photoUrl) : null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    lastSeenAt: raw.lastSeenAt != null ? String(raw.lastSeenAt) : null,
    docs: [{ type: "kyc", url: "", status: kyc, uploadedAt: null }],
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
  };
}

function mapBag(raw: Record<string, unknown>): BagRegistryRecord {
  const code = String(raw.code ?? raw.id ?? "");
  return {
    code,
    batchId: String(raw.batchId ?? raw.batch ?? "") || null,
    issuedAt: raw.issuedAt != null ? String(raw.issuedAt) : null,
    issuedBy: raw.issuedBy != null ? String(raw.issuedBy) : null,
    usedBy: raw.usedBy != null ? String(raw.usedBy) : raw.userId != null ? String(raw.userId) : null,
    usedAt: raw.usedAt != null ? String(raw.usedAt) : null,
    voided: Boolean(raw.voided),
    status: String(raw.status ?? (raw.voided ? "voided" : "active")),
  };
}

function mapOps(raw: Record<string, unknown>): OpsReportRecord {
  const id = String(raw.id ?? raw.SK ?? "").replace(/^OPS#/, "");
  const geoRaw = geoOf(raw);
  return {
    id,
    type: String(raw.type ?? "support"),
    status: String(raw.status ?? "open"),
    note: String(raw.note ?? raw.summary ?? ""),
    partnerId: String(raw.partnerId ?? ""),
    jobId: raw.jobId != null ? String(raw.jobId) : null,
    geo: geoRaw ? { latitude: geoRaw.lat, longitude: geoRaw.lng } : null,
    meta: (raw.meta as Record<string, unknown>) ?? {},
    createdAt: String(raw.createdAt ?? nowIso()),
  };
}

function pickupColor(status: string) {
  if (status === "completed") return "#22c55e";
  if (status === "cancelled") return "#94a3b8";
  if (status === "on_the_way" || status === "in_transit") return "#3b82f6";
  return "#f59e0b";
}

function vehicleColor(status: string, active: boolean) {
  if (!active) return "#94a3b8";
  if (status === "online" || status === "on_job") return "#22c55e";
  return "#64748b";
}

// ---------------------------------------------------------------------------
// Status / jobs
// ---------------------------------------------------------------------------

export async function getDbStatus() {
  await api.health();
  return { message: `AWS DynamoDB via ${process.env.WASTY_API_BASE_URL}` };
}

export async function listJobs(filters?: { status?: string; partnerId?: string; limit?: number }) {
  await requirePermission("ops:read");
  const res = await api.listJobs();
  let jobs = ((res.jobs as Record<string, unknown>[]) ?? []).map(mapJob);
  if (filters?.status) jobs = jobs.filter((j) => j.status === filters.status);
  if (filters?.partnerId) jobs = jobs.filter((j) => j.assignedPartnerId === filters.partnerId);
  if (filters?.limit) jobs = jobs.slice(0, filters.limit);
  return jobs;
}

export async function assignJob(jobId: string, partnerId: string) {
  await requirePermission("ops:write");
  await api.assignJob(jobId, partnerId);
  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
}

export async function cancelJob(jobId: string, reason?: string) {
  await requirePermission("ops:write");
  await api.patchJob(jobId, { status: "cancelled", cancelReason: reason ?? null });
  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
}

export async function forceJobStatus(jobId: string, status: string) {
  await requirePermission("ops:write");
  await api.patchJob(jobId, { status });
  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
}

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export async function listPartners(): Promise<PartnerRecord[]> {
  await requirePermission("people:read");
  const res = await api.listPartners();
  return ((res.partners as Record<string, unknown>[]) ?? []).map(mapPartner);
}

export async function invitePartner(_input: { name: string; phone: string; zone: string; vehicle: string }) {
  await requirePermission("people:write");
  throw new Error("Partner invite via AWS API is not implemented yet — use Partner app signup + KYC approval.");
}

export async function approvePartner(partnerId: string) {
  await requirePermission("people:write");
  await api.patchPartner(partnerId, { kycStatus: "approved" });
  revalidatePath("/dashboard/partners");
}

export async function rejectPartner(partnerId: string, reason?: string) {
  await requirePermission("people:write");
  await api.patchPartner(partnerId, { kycStatus: "rejected", rejectionReason: reason ?? null });
  revalidatePath("/dashboard/partners");
}

export async function setPartnerStatus(uid: string, status: string) {
  await requirePermission("people:write");
  await api.patchPartner(uid, { status });
  revalidatePath("/dashboard/partners");
}

export async function updatePartnerProfile(uid: string, patch: Record<string, unknown>) {
  await requirePermission("people:write");
  await api.patchPartner(uid, patch);
  revalidatePath("/dashboard/partners");
}

// ---------------------------------------------------------------------------
// Bags
// ---------------------------------------------------------------------------

export async function listBagsRegistry(): Promise<BagRegistryRecord[]> {
  await requirePermission("assets:read");
  const res = await api.listBags();
  return ((res.bags as Record<string, unknown>[]) ?? []).map(mapBag);
}

export async function issueBagCodes(count: number, prefix: string) {
  await requirePermission("assets:write");
  const res = await api.generateBagBatch({ count, prefix });
  revalidatePath("/dashboard/bags");
  return {
    batch: String(res.batch ?? ""),
    count: Number(res.count ?? count),
    codes: (res.codes as string[]) ?? [],
  };
}

export async function voidBagCode(code: string) {
  await requirePermission("assets:write");
  await api.voidBag(code);
  revalidatePath("/dashboard/bags");
}

// ---------------------------------------------------------------------------
// Ops / support
// ---------------------------------------------------------------------------

export async function listOpsReports(filters?: { limit?: number }) {
  await requirePermission("ops:read");
  const res = await api.listOps("open");
  let rows = ((res.ops as Record<string, unknown>[]) ?? []).map(mapOps);
  if (filters?.limit) rows = rows.slice(0, filters.limit);
  return rows;
}

export async function ackOpsReport(id: string, note?: string) {
  await requirePermission("ops:write");
  await api.patchOps(id, { status: "acknowledged", note });
  revalidatePath("/dashboard/support");
}

export async function closeOpsReport(id: string, note?: string) {
  await requirePermission("ops:write");
  await api.patchOps(id, { status: "closed", note });
  revalidatePath("/dashboard/support");
}

export async function replyOpsReport(id: string, note: string) {
  await requirePermission("ops:write");
  await api.patchOps(id, { note });
  revalidatePath("/dashboard/support");
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(limit = 300) {
  await requirePermission("people:read");
  const res = await api.listUsers();
  return ((res.users as Record<string, unknown>[]) ?? []).slice(0, limit).map((u) => ({
    id: String(u.uid ?? u.id ?? ""),
    name: String(u.name ?? u.displayName ?? "User"),
    email: String(u.email ?? ""),
    phone: u.phone != null ? String(u.phone) : null,
    points: Number(u.points ?? u.walletBalance ?? 0) || 0,
    carbonCreditsKg: Number(u.carbonCreditsKg ?? 0) || 0,
    wasteDivertedKg: Number(u.wasteDivertedKg ?? 0) || 0,
    suspended: Boolean(u.suspended),
    createdAt: String(u.createdAt ?? nowIso()),
  }));
}

export async function adjustWallet(uid: string, pointsDelta: number, reason?: string) {
  await requirePermission("people:write");
  await api.patchUser(uid, { pointsDelta, reason });
  revalidatePath("/dashboard/users");
}

export async function setUserSuspended(uid: string, suspended: boolean, reason?: string) {
  await requirePermission("people:write");
  await api.patchUser(uid, { suspended, suspendReason: reason ?? null });
  revalidatePath("/dashboard/users");
}

export async function listUserActivity(uid: string) {
  await requirePermission("people:read");
  return { uid, events: [] as { type: string; at: string; detail: string }[] };
}

// ---------------------------------------------------------------------------
// Routes / payouts / commerce
// ---------------------------------------------------------------------------

export async function listDailyRoutes(limit = 100) {
  await requirePermission("ops:read");
  const res = await api.listRoutes();
  return ((res.routes as Record<string, unknown>[]) ?? []).slice(0, limit).map((r) => ({
    id: String(r.id ?? ""),
    partnerId: String(r.partnerId ?? ""),
    status: String(r.status ?? "offered"),
    stopIds: Array.isArray(r.stopIds) ? r.stopIds.map(String) : [],
    date: String(r.date ?? ""),
    note: r.note != null ? String(r.note) : null,
    offeredAt: String(r.offeredAt ?? r.createdAt ?? nowIso()),
  }));
}

export async function createDailyRoute(
  partnerId: string,
  stopIds: string[],
  opts?: { date?: string; note?: string },
) {
  await requirePermission("ops:write");
  await api.offerRoute({ partnerId, stopIds, date: opts?.date, note: opts?.note });
  revalidatePath("/dashboard/routes");
  return { ok: true, id: crypto.randomUUID() };
}

export async function listPayoutEntries(limit = 500) {
  await requirePermission("settlements:read");
  const res = await api.listPayouts("requested");
  return ((res.requests as Record<string, unknown>[]) ?? []).slice(0, limit).map((p) => ({
    id: String(p.id ?? p.SK ?? "").replace(/^PAYREQ#/, ""),
    partnerId: String(p.partnerId ?? ""),
    partnerName: String(p.partnerName ?? p.partnerId ?? "—"),
    jobId: p.jobId != null ? String(p.jobId) : null,
    amount: Number(p.amount ?? 0) || 0,
    amountKg: typeof p.amountKg === "number" ? p.amountKg : null,
    date: String(p.date ?? p.createdAt ?? nowIso()),
    settled: Boolean(p.settled ?? p.status === "settled"),
  }));
}

export async function getSettlementsSummary() {
  await requirePermission("settlements:read");
  const entries = await listPayoutEntries(500);
  const pending = entries.filter((e) => !e.settled);
  return {
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, e) => s + e.amount, 0),
    settledCount: entries.length - pending.length,
  };
}

export async function markPayoutSettled(_partnerId: string, entryId: string) {
  await requirePermission("settlements:write");
  await api.settlePayout(entryId);
  revalidatePath("/dashboard/settlements");
}

function mapSellRequest(raw: Record<string, unknown>): SellRequestRecord {
  const wasteType = String(raw.wasteType ?? "");
  const quantityKg = typeof raw.quantityKg === "number" ? raw.quantityKg : null;
  const items = Array.isArray(raw.items)
    ? (raw.items as Array<{ category?: string; quantityKg?: number }>).map((line) => ({
        category: String(line.category ?? "mixed"),
        quantityKg: Number(line.quantityKg ?? 0) || 0,
      }))
    : wasteType && quantityKg != null
      ? [{ category: wasteType, quantityKg }]
      : [];
  const totalWeightKg =
    typeof raw.totalWeightKg === "number"
      ? raw.totalWeightKg
      : quantityKg != null
        ? quantityKg
        : items.reduce((sum, row) => sum + (row.quantityKg ?? 0), 0) || null;
  const estimatedValue = typeof raw.estimatedAmount === "number" ? raw.estimatedAmount : null;
  const totalAmount =
    typeof raw.totalAmount === "number"
      ? raw.totalAmount
      : estimatedValue != null
        ? estimatedValue
        : null;
  return {
    id: String(raw.id ?? ""),
    customerId: String(raw.customerId ?? raw.userId ?? ""),
    items,
    totalWeightKg,
    totalAmount,
    status: String(raw.status ?? "requested"),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
  };
}

export async function listSellRequests(limit = 300) {
  await requirePermission("commerce:read");
  const res = await api.listSell();
  return ((res.requests as Record<string, unknown>[]) ?? []).slice(0, limit).map(mapSellRequest);
}

export async function updateSellRequestStatus(
  customerId: string,
  requestId: string,
  status: string,
) {
  await requirePermission("commerce:write");
  if (!customerId || !requestId) throw new Error("customerId and requestId are required");
  if (!status.trim()) throw new Error("status is required");
  await api.patchSellRequest(customerId, requestId, { status: status.trim() });
  revalidatePath("/dashboard/sell-waste");
}

export async function listProducts() {
  await requirePermission("commerce:read");
  const res = await api.listProducts();
  return ((res.products as Record<string, unknown>[]) ?? []).map((p) => ({
    id: String(p.id ?? ""),
    ...p,
  }));
}

export async function upsertProduct(input: ProductWriteInput) {
  await requirePermission("commerce:write");
  const result = await api.upsertProduct(input as Record<string, unknown>);
  revalidatePath("/dashboard/marketplace");
  return { id: String((result as { id?: string }).id ?? input.id ?? "") };
}

export async function deleteProduct(id: string) {
  await requirePermission("commerce:write");
  await api.deleteProduct(id);
  revalidatePath("/dashboard/marketplace");
}

export async function uploadProductImage(productId: string, bytes: Uint8Array, contentType: string) {
  await requirePermission("commerce:write");
  const ext = contentType.includes("png") ? "png" : "jpg";
  const { url, key } = await api.presignUpload(`${productId}.${ext}`, contentType);
  await fetch(url, { method: "PUT", body: bytes, headers: { "Content-Type": contentType } });
  const imageUrl = url.split("?")[0];
  await api.upsertProduct({ id: productId, imageUrl, imageKey: key });
  revalidatePath("/dashboard/marketplace");
  return { ok: true, url: imageUrl, productId };
}

export async function listRewardsCatalog() {
  await requirePermission("commerce:read");
  const res = await api.listRewards();
  return res.rewards as Record<string, unknown>[];
}

export async function upsertReward(input: Record<string, unknown>) {
  await requirePermission("commerce:write");
  await apiRequest("POST", "/v1/rewards", input);
  revalidatePath("/dashboard/rewards");
  return { id: String(input.id ?? "") };
}

async function apiRequest(method: string, path: string, body?: unknown) {
  const { apiRequest: req } = await import("@/lib/api/client");
  return req(method, path, body);
}

export async function listBins() {
  await requirePermission("assets:read");
  const res = await api.listBins();
  return res.bins as Record<string, unknown>[];
}

export async function upsertBin(payload: Record<string, unknown>) {
  await requirePermission("assets:write");
  const result = (await api.upsertBin(payload)) as { bin?: Record<string, unknown> };
  revalidatePath("/dashboard/bins");
  const bin = result.bin ?? {};
  return { id: String(bin.id ?? payload.id ?? "") };
}

function mapOrder(raw: Record<string, unknown>, userNameById?: Map<string, string>): OrderRecord {
  const userId = String(raw.userId ?? "");
  const totalValue = Number(raw.total ?? raw.totalValue ?? 0) || 0;
  const userName = userNameById?.get(userId) ?? String(raw.userName ?? (userId ? userId.slice(0, 8) : "—"));
  return {
    id: String(raw.id ?? ""),
    userId,
    userName,
    total: typeof raw.total === "string" && raw.total.includes("₹") ? raw.total : `₹${totalValue}`,
    totalValue,
    status: String(raw.status ?? "placed"),
    paymentMethod: String(raw.paymentMethod ?? "—"),
    itemCount: Array.isArray(raw.items) ? raw.items.length : 0,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
  };
}

export async function listOrders(): Promise<OrderRecord[]> {
  await requirePermission("commerce:read");
  const [res, usersRes] = await Promise.all([api.listOrders(), api.listUsers()]);
  const userNameById = new Map(
    ((usersRes.users as Record<string, unknown>[]) ?? []).map((u) => [
      String(u.uid ?? u.id ?? ""),
      String(u.name ?? u.displayName ?? u.email ?? ""),
    ]),
  );
  return ((res.orders as Record<string, unknown>[]) ?? []).map((row) => mapOrder(row, userNameById));
}

export async function advanceOrderStatus(userId: string, orderId: string, status: string) {
  await requirePermission("commerce:write");
  const allowed = ["placed", "packing", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status)) throw new Error("Bad status");
  await api.updateOrderStatus(orderId, { userId, status });
  revalidatePath("/dashboard/orders");
}

export async function sendPushNotification(_input: { title: string; body: string; uids?: string[] }) {
  await requirePermission("notifications:write");
  throw new Error("Push broadcast via AWS API not wired yet.");
}

export async function listPushNotificationsHistory(_limit = 50) {
  return [];
}

export async function getAppConfig() {
  await requirePermission("config:write");
  const res = await api.getConfig("app");
  return (res.config as Record<string, unknown>) ?? {};
}

export async function saveAppConfig(patch: Record<string, unknown>) {
  await requirePermission("config:write");
  await api.putConfig("app", patch);
  revalidatePath("/dashboard/config");
}

export async function listZones() {
  await requirePermission("assets:read");
  const res = await api.listZones();
  return res.zones as Record<string, unknown>[];
}

export async function upsertZone(input: Record<string, unknown>) {
  await requirePermission("assets:write");
  await api.upsertZone(input);
  revalidatePath("/dashboard/zones");
  return { id: String(input.id ?? "") };
}

export async function listMrfFacilities() {
  const res = await api.listMrf();
  return res.mrf as Record<string, unknown>[];
}

export async function upsertMrfFacility(input: Record<string, unknown>) {
  await api.upsertMrf(input);
  revalidatePath("/dashboard/mrf");
  return { id: String(input.id ?? "") };
}

export async function listMrfInbound() {
  return [];
}

export async function logMrfInbound(_input: Record<string, unknown>) {
  revalidatePath("/dashboard/mrf");
  return { ok: true };
}

export async function ensureAiJobsFromPickups() {
  /* no-op on AWS */
}

export async function listAiJobs() {
  return [];
}

export async function overrideAiJob(_id: string, _category: string) {
  return { ok: true };
}

export async function setAiModelVersion(_model: string) {
  return { ok: true };
}

export async function getAiModelVersion() {
  return "aws-default";
}

export async function listMaterialLots() {
  const res = await api.listInventory();
  return res.lots as Record<string, unknown>[];
}

export async function upsertMaterialLot(input: Record<string, unknown>) {
  await api.upsertInventory(input);
  revalidatePath("/dashboard/inventory");
  return { id: String(input.id ?? "") };
}

export async function listP2pListings() {
  const res = await api.listP2p();
  return res.listings as Record<string, unknown>[];
}

export async function createP2pListing(_input: Record<string, unknown>) {
  throw new Error("P2P create not on AWS API yet");
}

export async function resolveP2pDispute(_id: string, _resolution: string, _note?: string) {
  return { ok: true };
}

export async function listBuyers() {
  return [];
}

export async function upsertBuyer(_input: Record<string, unknown>) {
  return { id: "" };
}

export async function getImpactStats() {
  const { demoImpactStats } = await import("@/lib/analytics/demo");
  const base = demoImpactStats("30d");
  try {
    const cov = await api.coverage();
    const divertedKg = Number(cov.wasteDivertedKg ?? base.divertedKg) || base.divertedKg;
    const carbonKg = Number(cov.carbonSavedKg ?? divertedKg * 2.2) || divertedKg * 2.2;
    return {
      ...base,
      divertedKg,
      divertedTons: (divertedKg / 1000).toFixed(1),
      carbonTons: (carbonKg / 1000).toFixed(1),
      recoveryRate: String(cov.coveragePct ?? base.recoveryRateValue),
      recoveryRateValue: Number(cov.coveragePct ?? base.recoveryRateValue) || base.recoveryRateValue,
    };
  } catch (error) {
    console.error("[wasty] AWS impact fallback:", error instanceof Error ? error.message : error);
    return base;
  }
}

export async function lookupPassport(id: string) {
  return { id, found: false, summary: "Passport lookup requires full AWS deploy" };
}

export async function listAdminAudit() {
  const res = await api.audit();
  return (res.events as Record<string, unknown>[]) ?? [];
}

export async function getAnalyticsDashboard(range: "7d" | "30d" | "90d" = "30d") {
  await requirePermission("analytics:read");
  const { demoAnalyticsDashboard } = await import("@/lib/analytics/demo");
  const base = demoAnalyticsDashboard(range);
  try {
    const [snap, cov] = await Promise.all([api.snapshot(), api.coverage()]);
    const jobs = (snap.jobs as unknown[]) ?? [];
    const partners = (snap.partners as unknown[]) ?? [];
    const alerts = (snap.alerts as unknown[]) ?? [];
    return {
      ...base,
      overview: {
        ...base.overview,
        range,
        totalJobs: jobs.length,
        activeJobs: jobs.length,
        completedToday: Number(cov.completedToday ?? 0) || 0,
        openAlerts: alerts.length,
        partnersOnline: Number(cov.partnersOnline ?? partners.length) || partners.length,
        partnersTotal: partners.length,
        recoveryRate: Number(cov.coveragePct ?? base.overview.recoveryRate) || 0,
        divertedKg: Number(cov.wasteDivertedKg ?? base.overview.divertedKg) || base.overview.divertedKg,
      },
    };
  } catch (error) {
    console.error("[wasty] AWS analytics fallback:", error instanceof Error ? error.message : error);
    return base;
  }
}

export async function getCommandCenterStats() {
  try {
    const [snap, cov] = await Promise.all([api.snapshot(), api.coverage()]);
    const jobs = (snap.jobs as unknown[]) ?? [];
    const partners = (snap.partners as unknown[]) ?? [];
    const alerts = (snap.alerts as unknown[]) ?? [];
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.length,
      onlinePartners: Number(cov.partnersOnline ?? partners.length) || partners.length,
      totalPartners: partners.length,
      openAlerts: alerts.length,
      binsMonitored: ((snap.bins as unknown[]) ?? []).length,
      coveragePct: Number(cov.coveragePct ?? 0) || 0,
      completedToday: Number(cov.completedToday ?? 0) || 0,
    };
  } catch (error) {
    console.error("[wasty] AWS command-center fallback:", error instanceof Error ? error.message : error);
    return {
      totalJobs: 0,
      activeJobs: 0,
      onlinePartners: 0,
      totalPartners: 0,
      openAlerts: 0,
      binsMonitored: 0,
      coveragePct: 0,
      completedToday: 0,
    };
  }
}

export async function getComplianceDashboard(range: "7d" | "30d" | "90d" = "30d") {
  const { demoComplianceDashboard } = await import("@/lib/analytics/demo");
  return demoComplianceDashboard(range);
}

export async function getCommandDeskData(range: "7d" | "30d" | "90d" = "30d") {
  const { demoCommandDesk } = await import("@/lib/government/demo");
  const base = demoCommandDesk(range);
  try {
    const snap = await api.snapshot();
    const jobs = (snap.jobs as unknown[]) ?? [];
    const alerts = (snap.alerts as unknown[]) ?? [];
    return {
      ...base,
      range,
      queue: {
        ...base.queue,
        jobsActive: jobs.length,
        partnerAlertsOpen: alerts.length,
      },
    };
  } catch (error) {
    console.error("[wasty] AWS command-desk fallback:", error instanceof Error ? error.message : error);
    return base;
  }
}

function mapCitizenReport(
  raw: Record<string, unknown>,
  usersById?: Map<string, { name: string; phone: string | null }>,
): CitizenReportRow {
  const userId = String(raw.userId ?? "");
  const user = usersById?.get(userId);
  return {
    id: String(raw.id ?? ""),
    userId,
    userName: user?.name ?? (userId ? userId.slice(0, 8) : "—"),
    phone: user?.phone ?? null,
    issueType: String(raw.issueType ?? raw.type ?? "Report"),
    notes: String(raw.notes ?? raw.description ?? ""),
    status: normalizeCitizenStatus(raw.status),
    area: String(raw.area ?? "—"),
    govNotes: raw.govNotes != null ? String(raw.govNotes) : null,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.createdAt != null ? String(raw.createdAt) : null,
  };
}

export async function listCitizenReports(filters?: {
  status?: string;
  issueType?: string;
  limit?: number;
}) {
  await requirePermission("citizen_reports:read");
  const [res, usersRes] = await Promise.all([api.listReports(), api.listUsers()]);
  const usersById = new Map(
    ((usersRes.users as Record<string, unknown>[]) ?? []).map((u) => {
      const uid = String(u.uid ?? u.id ?? "");
      return [
        uid,
        {
          name: String(u.name ?? u.displayName ?? (uid.slice(0, 8) || "—")),
          phone: u.phone != null ? String(u.phone) : null,
        },
      ];
    }),
  );
  let rows = ((res.reports as Record<string, unknown>[]) ?? []).map((raw) => mapCitizenReport(raw, usersById));
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters?.issueType) rows = rows.filter((r) => r.issueType === filters.issueType);
  if (filters?.limit) rows = rows.slice(0, filters.limit);
  return rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function updateCitizenReportStatus(
  _userId: string,
  _reportId: string,
  _status: string,
  _note?: string,
) {
  return { ok: true };
}

export async function getGovernmentCaseQueue() {
  return [];
}

export async function listGovernmentJobs(_filters?: Record<string, unknown>) {
  const jobs = await listJobs({ limit: 200 });
  return jobs;
}

export async function getGovernmentJobDetail(jobId: string) {
  const jobs = await listJobs({ limit: 500 });
  return jobs.find((j) => j.id === jobId) ?? null;
}

export async function listGovernmentHouseholds(_filters?: Record<string, unknown>) {
  const users = await listUsers(200);
  return users;
}

export async function getGovernmentHouseholdProfile(uid: string) {
  const users = await listUsers(500);
  return users.find((u) => u.id === uid) ?? null;
}

export async function listGovernmentAudit(limit = 100) {
  const events = await listAdminAudit();
  return events.slice(0, limit);
}

export async function getLiveMapSnapshot(): Promise<LiveMapSnapshot> {
  await requirePermission("map:read");
  const snap = await api.snapshot().catch(() => ({
    jobs: [] as unknown[],
    partners: [] as unknown[],
    alerts: [] as unknown[],
    bins: [] as unknown[],
  }));
  const points: LiveMapPoint[] = [];

  for (const raw of (snap.jobs as Record<string, unknown>[]) ?? []) {
    const job = mapJob(raw);
    const geo = geoOf(raw);
    if (!geo) continue;
    points.push({
      id: job.id,
      kind: "pickup",
      title: job.userId ? `Pickup ${job.id.slice(0, 8)}` : job.id,
      subtitle: `${job.wasteType} · ${job.status.replaceAll("_", " ")}`,
      lat: geo.lat,
      lng: geo.lng,
      status: job.status,
      color: pickupColor(job.status),
      active: job.status !== "completed" && job.status !== "cancelled",
      full: false,
      radiusM: 80,
      updatedAt: job.updatedAt,
      href: `/dashboard/compliance/jobs/${job.id}`,
    });
  }

  for (const raw of (snap.partners as Record<string, unknown>[]) ?? []) {
    const partner = mapPartner(raw);
    const geo = geoOf(raw);
    if (!geo) continue;
    const active = partner.status === "online" || partner.status === "on_job";
    points.push({
      id: partner.id,
      kind: "vehicle",
      title: partner.name,
      subtitle: `${partner.vehicle ?? "Vehicle"} · ${partner.status}`,
      lat: geo.lat,
      lng: geo.lng,
      status: partner.status,
      color: vehicleColor(partner.status, active),
      active,
      full: false,
      radiusM: 120,
      updatedAt: partner.lastSeenAt,
      href: "/dashboard/partners",
    });
  }

  for (const raw of (snap.bins as Record<string, unknown>[]) ?? []) {
    const geo = geoOf(raw);
    if (!geo) continue;
    const id = String(raw.id ?? raw.code ?? "");
    points.push({
      id,
      kind: "bin",
      title: String(raw.location ?? raw.code ?? "Bin"),
      subtitle: String(raw.type ?? "Mixed"),
      lat: geo.lat,
      lng: geo.lng,
      status: String(raw.status ?? "ok"),
      color: "#0ea5e9",
      active: true,
      full: Number(raw.fillPercent ?? 0) > 85,
      radiusM: 60,
      updatedAt: String(raw.updatedAt ?? nowIso()),
      href: "/dashboard/bins",
    });
  }

  return {
    points,
    stats: {
      pickups: points.filter((p) => p.kind === "pickup").length,
      vehicles: points.filter((p) => p.kind === "vehicle").length,
      bins: points.filter((p) => p.kind === "bin").length,
      alerts: ((snap.alerts as unknown[]) ?? []).length,
    },
    generatedAt: nowIso(),
  };
}

export async function listAdmins() {
  return [];
}

export async function grantAdminAccess(email: string, adminType: string) {
  await api.grantRole({ uid: email, adminType, email });
  revalidatePath("/dashboard/roles");
  return { ok: true };
}

export async function createStaffAccount(_input: Record<string, unknown>) {
  throw new Error("Staff account creation: use Firebase console + grantRole");
}

export async function setAdminType(uid: string, adminType: string) {
  await api.grantRole({ uid, adminType });
  revalidatePath("/dashboard/roles");
}

export async function revokeAdminAccess(_uid: string) {
  throw new Error("Revoke admin: use Firebase console");
}

export async function syncSince(since = 0) {
  return api.syncSince(since);
}
