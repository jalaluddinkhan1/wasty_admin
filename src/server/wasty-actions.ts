"use server";

import { revalidatePath } from "next/cache";

/**
 * Unified data-layer facade consumed by dashboard pages/client components.
 *
 * Every export here checks `getDataProvider()` and either delegates to the
 * live Firebase Admin SDK actions (`@/server/firebase-actions`) or falls
 * back to the local SQLite database — so pages don't need their own
 * branching logic and never crash if Firebase credentials aren't set yet.
 *
 * Row shapes are intentionally kept identical across both providers (same
 * field names as the original SQLite schema) so existing Client Components
 * don't need to change their prop types.
 */
import { asc, eq } from "drizzle-orm";

import { getDb, persistDb } from "@/db";
import {
  type Bag,
  bags,
  type Partner,
  type Pickup,
  partners,
  pickups,
  type SupportTicket,
  supportTickets,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/require-admin";
import { getDataProvider } from "@/lib/firebase/config";
import { parseGeo } from "@/lib/live-map/types";
import * as aws from "@/server/aws-actions";
import * as fb from "@/server/firebase-actions";

function liveActions() {
  return getDataProvider() === "aws" ? aws : fb;
}

export type UnifiedPickupRow = {
  id: string;
  userName: string;
  slot: string;
  partner: string;
  waste: string;
  status: string;
  location?: string;
  weight?: string | null;
  beforePhoto?: string | null;
  afterPhoto?: string | null;
  tipAmount?: number | null;
  partnerId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedPartnerRow = {
  id: string;
  name: string;
  role: string;
  zone: string;
  status: string;
  kyc: string;
  rating: string;
  phone: string | null;
  createdAt: string;
};

export type UnifiedBagRow = {
  id: string;
  code: string;
  batch: string;
  userName: string;
  category: string;
  status: string;
  createdAt: string;
};

export type UnifiedTicketRow = {
  id: string;
  type: string;
  fromLabel: string;
  summary: string;
  status: string;
  note: string | null;
  createdAt: string;
};

export type UnifiedUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  points: number;
  carbonCreditsKg: number;
  wasteDivertedKg: number;
  createdAt: string;
};

export type UnifiedRouteRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  status: string;
  stopCount: number;
  estimatedEarn: number | null;
  estimatedKg: number | null;
  offeredAt: string;
};

export type UnifiedPayoutRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  jobId: string | null;
  amount: number;
  amountKg: number | null;
  date: string;
  settled: boolean;
};

export type UnifiedSellRequestRow = {
  id: string;
  customerId: string;
  categories: string;
  totalWeightKg: number | null;
  totalAmount: number | null;
  status: string;
  createdAt: string;
};

export type UnifiedProductRow = {
  id: string;
  name: string;
  price: number;
  priceValue: number;
  mrp: number;
  stock: number;
  category: string;
  description: string;
  ecoPoints: number;
  icon: string;
  accent: string;
  badge: string;
  featured: boolean;
  unit: string;
  material: string;
  brand: string;
  seller: string;
  rating: number;
  reviews: number;
  imageUrl: string;
  inStock: boolean;
  returnDays: number;
  highlights: string[];
  active: boolean;
};

export type UnifiedRewardRow = {
  id: string;
  name: string;
  pointsCost: number;
  stock: number | null;
  redeemed: number;
  active: boolean;
};

export type UnifiedBinRow = {
  id: string;
  location: string;
  type: string;
  fillPercent: number;
  agent: string;
  status: string;
  lat: number | null;
  lng: number | null;
};

function nowIso() {
  return new Date().toISOString();
}

function docsToKyc(docs: { status: string }[]): string {
  if (docs.length === 0) return "pending";
  if (docs.some((d) => d.status === "rejected")) return "rejected";
  if (docs.every((d) => d.status === "approved")) return "approved";
  return "pending";
}

function jobToPickupRow(job: fb.JobRecord): UnifiedPickupRow {
  return {
    id: job.id,
    userName: job.userId || "—",
    slot: [job.date, job.time].filter(Boolean).join(" · ") || "—",
    partner: job.assignedPartnerId ?? "—",
    partnerId: job.assignedPartnerId,
    waste: job.wasteType,
    status: job.status,
    location: job.location,
    weight: job.weight ?? (job.weightKg != null ? `${job.weightKg} kg` : null),
    beforePhoto: job.beforePhoto,
    afterPhoto: job.afterPhoto,
    tipAmount: job.tipAmount,
    createdAt: job.createdAt ?? nowIso(),
    updatedAt: job.updatedAt ?? job.createdAt ?? nowIso(),
  };
}

function partnerToRow(partner: fb.PartnerRecord): UnifiedPartnerRow {
  return {
    id: partner.id,
    name: partner.name,
    role: partner.role ?? "—",
    zone: partner.serviceArea ?? "—",
    status: partner.status.replace(/_/g, " "),
    kyc: docsToKyc(partner.docs),
    rating: partner.rating != null ? partner.rating.toFixed(1) : "—",
    phone: partner.phone,
    createdAt: partner.createdAt ?? nowIso(),
  };
}

function bagToRow(bag: fb.BagRegistryRecord): UnifiedBagRow {
  return {
    id: bag.code,
    code: bag.code,
    batch: bag.batchId || (bag.issuedAt ?? "").slice(0, 10) || "—",
    userName: bag.usedBy ?? "—",
    category: bag.status || (bag.usedAt ? "used" : "unused"),
    status: bag.voided ? "voided" : bag.usedBy ? "collected" : "unassigned",
    createdAt: bag.issuedAt ?? nowIso(),
  };
}

const OPS_STATUS_TO_TICKET_STATUS: Record<string, string> = {
  open: "open",
  acked: "acknowledged",
  closed: "resolved",
};

function opsReportToTicketRow(report: fb.OpsReportRecord): UnifiedTicketRow {
  const status =
    report.status === "open" && report.type === "sos"
      ? "urgent"
      : (OPS_STATUS_TO_TICKET_STATUS[report.status] ?? report.status);
  return {
    id: report.id,
    type: report.type.replace(/_/g, " ").toUpperCase(),
    fromLabel: report.partnerId || "—",
    summary: report.note || "—",
    status,
    note: null,
    createdAt: report.createdAt ?? nowIso(),
  };
}

function parseInr(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toProductRow(doc: Record<string, unknown> & { id: string }): UnifiedProductRow {
  const priceValue = parseInr(doc.priceValue) || parseInr(doc.price);
  const mrp = parseInr(doc.mrp) || priceValue;
  const stock = Number(doc.stock);
  const highlights = Array.isArray(doc.highlights)
    ? doc.highlights.map((item) => String(item)).filter(Boolean)
    : String(doc.highlights ?? "")
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
  return {
    id: doc.id,
    name: String(doc.name ?? "Untitled product"),
    price: priceValue,
    priceValue,
    mrp,
    stock: Number.isFinite(stock) ? stock : 0,
    category: String(doc.category ?? "Home"),
    description: String(doc.description ?? ""),
    ecoPoints: Number(doc.ecoPoints ?? 0) || 0,
    icon: String(doc.icon ?? "cube-outline"),
    accent: String(doc.accent ?? "#E8F6EE"),
    badge: String(doc.badge ?? ""),
    featured: Boolean(doc.featured),
    unit: String(doc.unit ?? ""),
    material: String(doc.material ?? ""),
    brand: String(doc.brand ?? "Wasty Co."),
    seller: String(doc.seller ?? "Wasty Eco Store"),
    rating: Number(doc.rating ?? 4.5) || 4.5,
    reviews: Number(doc.reviews ?? 0) || 0,
    imageUrl: String(doc.imageUrl ?? ""),
    inStock: doc.inStock === false ? false : !Number.isFinite(stock) || stock > 0,
    returnDays: Number(doc.returnDays ?? (doc.category === "Garden" ? 3 : 7)) || 7,
    highlights,
    active: doc.inStock !== false,
  };
}

function toRewardRow(doc: Record<string, unknown> & { id: string }): UnifiedRewardRow {
  const stock = doc.stock;
  return {
    id: doc.id,
    name: String(doc.name ?? "Untitled reward"),
    pointsCost: Number(doc.pointsCost ?? doc.cost ?? 0) || 0,
    stock: typeof stock === "number" ? stock : null,
    redeemed: Number(doc.redeemed ?? 0) || 0,
    active: doc.active !== false,
  };
}

function toBinRow(doc: Record<string, unknown> & { id: string }): UnifiedBinRow {
  const geo = parseGeo(doc);
  const lat = geo?.lat ?? null;
  const lng = geo?.lng ?? null;
  return {
    id: doc.id,
    location: String(doc.location ?? doc.address ?? doc.code ?? "—"),
    type: String(doc.type ?? "Mixed"),
    fillPercent: Number(doc.fillPercent ?? doc.fillLevel ?? 0) || 0,
    agent: String(doc.agent ?? doc.assignedPartnerId ?? "—"),
    status: String(doc.status ?? "ok"),
    lat,
    lng,
  };
}

const NO_SQLITE_TABLE = (feature: string) =>
  new Error(`${feature} requires the Firebase provider — there's no local SQLite table for this yet.`);

function assertSqlite() {
  if (getDataProvider() !== "sqlite") {
    throw new Error("This action only runs against SQLite. The Firebase provider is active.");
  }
}

export async function getDbStatus() {
  const provider = getDataProvider();
  if (provider === "aws") {
    try {
      const status = await aws.getDbStatus();
      return { provider: "aws" as const, message: status.message };
    } catch (e) {
      return {
        provider: "aws" as const,
        message: `AWS API unreachable: ${e instanceof Error ? e.message : "error"}`,
      };
    }
  }
  if (provider === "firebase") {
    const status = await liveActions().getDbStatus();
    return { provider: "firebase" as const, message: status.message };
  }
  return { provider: "sqlite" as const, message: "Using local SQLite (data/wasty-admin.sqlite)" };
}

// ---------------------------------------------------------------------------
// Jobs / Pickups
// ---------------------------------------------------------------------------

export async function listPickups(): Promise<UnifiedPickupRow[]> {
  if (getDataProvider() !== "sqlite") {
    const jobs = await liveActions().listJobs({ limit: 300 });
    return jobs.map(jobToPickupRow);
  }
  const db = await getDb();
  const rows = db.select().from(pickups).orderBy(asc(pickups.id)).all();
  return rows.map((row: Pickup) => ({
    id: row.id,
    userName: row.userName,
    slot: row.slot,
    partner: row.partner,
    waste: row.waste,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** `partnerIdentifier` is a partner uid on Firebase, or a free-text name on SQLite. */
export async function assignPickupPartner(jobId: string, partnerIdentifier: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().assignJob(jobId, partnerIdentifier);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(pickups)
    .set({ partner: partnerIdentifier, status: "scheduled", updatedAt: new Date() })
    .where(eq(pickups.id, jobId))
    .run();
  persistDb();
  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
  return { ok: true };
}

export async function cancelPickup(jobId: string, reason?: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().cancelJob(jobId, reason);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(pickups).set({ status: "cancelled", updatedAt: new Date() }).where(eq(pickups.id, jobId)).run();
  persistDb();
  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export async function listPartners(): Promise<UnifiedPartnerRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listPartners();
    return rows.map(partnerToRow);
  }
  const db = await getDb();
  const rows = db.select().from(partners).orderBy(asc(partners.id)).all();
  return rows.map((row: Partner) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function invitePartner(input: { name: string; role: string; zone: string; phone?: string }) {
  if (getDataProvider() !== "sqlite") {
    const result = await liveActions().invitePartner({
      name: input.name,
      phone: input.phone || "",
      zone: input.zone,
      vehicle: input.role,
    });
    return { ok: true, id: result.uid };
  }
  assertSqlite();
  const db = await getDb();
  const id = crypto.randomUUID();
  db.insert(partners)
    .values({
      id,
      name: input.name,
      role: input.role,
      zone: input.zone,
      phone: input.phone || null,
      status: "invited",
      kyc: "pending",
      rating: "—",
      createdAt: new Date(),
    })
    .run();
  persistDb();
  revalidatePath("/dashboard/partners");
  return { ok: true, id };
}

export async function approvePartnerKyc(partnerId: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().approvePartner(partnerId);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(partners).set({ kyc: "approved" }).where(eq(partners.id, partnerId)).run();
  persistDb();
  revalidatePath("/dashboard/partners");
  return { ok: true };
}

export async function rejectPartnerKyc(partnerId: string, reason?: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().rejectPartner(partnerId, reason);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(partners).set({ kyc: "rejected" }).where(eq(partners.id, partnerId)).run();
  persistDb();
  revalidatePath("/dashboard/partners");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bags
// ---------------------------------------------------------------------------

export async function listBags(): Promise<UnifiedBagRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listBagsRegistry();
    return rows.map(bagToRow);
  }
  const db = await getDb();
  const rows = db.select().from(bags).orderBy(asc(bags.code)).all();
  return rows.map((row: Bag) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function generateBagBatch(input: { count: number; prefix: string }) {
  if (getDataProvider() !== "sqlite") {
    const result = await liveActions().issueBagCodes(input.count, input.prefix);
    return { ok: true, batch: result.batch, count: result.count, codes: result.codes };
  }
  assertSqlite();
  const db = await getDb();
  const count = Math.min(Math.max(input.count || 1, 1), 50);
  const batch = `B-${new Date().toISOString().slice(0, 7)}-${Date.now().toString().slice(-4)}`;
  const createdAt = new Date();
  const rows = Array.from({ length: count }, (_, index) => {
    const num = 90000 + index + Math.floor(Math.random() * 1000);
    return {
      id: crypto.randomUUID(),
      code: `${input.prefix}-${num}`,
      batch,
      userName: "—",
      category: "—",
      status: "unassigned",
      createdAt,
    };
  });
  db.insert(bags).values(rows).run();
  persistDb();
  revalidatePath("/dashboard/bags");
  return { ok: true, batch, count: rows.length, codes: rows.map((row) => row.code) };
}

// ---------------------------------------------------------------------------
// Support / Ops reports
// ---------------------------------------------------------------------------

export async function listSupportTickets(): Promise<UnifiedTicketRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listOpsReports({ limit: 300 });
    return rows.map(opsReportToTicketRow);
  }
  const db = await getDb();
  const rows = db.select().from(supportTickets).orderBy(asc(supportTickets.id)).all();
  return rows.map((row: SupportTicket) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function acknowledgeSos(ticketId: string, note: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().ackOpsReport(ticketId, note);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(supportTickets).set({ status: "acknowledged", note }).where(eq(supportTickets.id, ticketId)).run();
  persistDb();
  revalidatePath("/dashboard/support");
  revalidatePath("/dashboard/ops");
  return { ok: true };
}

export async function closeSupportTicket(ticketId: string, note?: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().closeOpsReport(ticketId, note);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(supportTickets)
    .set({ status: "resolved", note: note ?? null })
    .where(eq(supportTickets.id, ticketId))
    .run();
  persistDb();
  revalidatePath("/dashboard/support");
  revalidatePath("/dashboard/ops");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users (end-users) & wallet
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<UnifiedUserRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listUsers(300);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      points: row.points,
      carbonCreditsKg: row.carbonCreditsKg,
      wasteDivertedKg: row.wasteDivertedKg,
      createdAt: row.createdAt ?? nowIso(),
    }));
  }
  // No local SQLite `users` table yet — return an empty list instead of crashing.
  return [];
}

export async function adjustUserPoints(uid: string, pointsDelta: number, reason: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().adjustWallet(uid, pointsDelta, reason);
    return { ok: true };
  }
  // SQLite dev mode: users wallet ledger not implemented yet.
  // Return a stub so the UI can be tested without Firebase.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Daily routes
// ---------------------------------------------------------------------------

export async function listDailyRoutes(): Promise<UnifiedRouteRow[]> {
  if (getDataProvider() !== "sqlite") {
    const [routes, partnerRows] = await Promise.all([fb.listDailyRoutes(100), fb.listPartners()]);
    const nameById = new Map(partnerRows.map((partner) => [partner.id, partner.name]));
    return routes.map((route) => ({
      id: route.id,
      partnerId: route.partnerId,
      partnerName: nameById.get(route.partnerId) ?? route.partnerId,
      status: route.status,
      stopCount: route.stopIds.length,
      estimatedEarn: route.estimatedEarn,
      estimatedKg: route.estimatedKg,
      offeredAt: route.offeredAt ?? nowIso(),
    }));
  }
  return [];
}

export async function createDailyRoute(input: {
  partnerId: string;
  stopIds: string[];
  estimatedEarn?: number;
  estimatedKg?: number;
}) {
  if (getDataProvider() !== "sqlite") {
    const result = await liveActions().createDailyRoute(input.partnerId, input.stopIds, {
      estimatedEarn: input.estimatedEarn,
      estimatedKg: input.estimatedKg,
    });
    return { ok: true, id: result.id };
  }
  // SQLite dev mode: dailyRoutes are Firebase-only currently.
  return { ok: true, id: "DR-DEMO" };
}

// ---------------------------------------------------------------------------
// Settlements / payouts
// ---------------------------------------------------------------------------

export async function listPayoutEntries(): Promise<UnifiedPayoutRow[]> {
  if (getDataProvider() !== "sqlite") {
    const [entries, partnerRows] = await Promise.all([fb.listPayoutEntries(500), fb.listPartners()]);
    const nameById = new Map(partnerRows.map((partner) => [partner.id, partner.name]));
    return entries.map((entry) => ({
      id: entry.id,
      partnerId: entry.partnerId,
      partnerName: nameById.get(entry.partnerId) ?? entry.partnerId,
      jobId: entry.jobId,
      amount: entry.amount,
      amountKg: entry.amountKg,
      date: entry.date ?? nowIso(),
      settled: entry.settled,
    }));
  }
  return [];
}

export async function getSettlementsSummary() {
  if (getDataProvider() !== "sqlite") {
    return liveActions().getSettlementsSummary();
  }
  return { totalAmount: 0, settledAmount: 0, pendingAmount: 0, entryCount: 0 };
}

export async function markPayoutSettled(partnerId: string, entryId: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().markPayoutSettled(partnerId, entryId);
    return { ok: true };
  }
  // SQLite dev mode: payouts ledger not implemented yet.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sell-waste requests
// ---------------------------------------------------------------------------

export async function listSellRequests(): Promise<UnifiedSellRequestRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listSellRequests(300);
    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      categories: row.items.map((item) => `${item.category} (${item.quantityKg}kg)`).join(", ") || "—",
      totalWeightKg: row.totalWeightKg,
      totalAmount: row.totalAmount,
      status: row.status,
      createdAt: row.createdAt ?? nowIso(),
    }));
  }
  return [];
}

export async function updateSellRequestStatus(customerId: string, requestId: string, status: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().updateSellRequestStatus(customerId, requestId, status);
    return { ok: true };
  }
  // SQLite dev mode: sell-waste requests are Firebase-only currently.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Marketplace products
// ---------------------------------------------------------------------------

export async function listProducts(): Promise<UnifiedProductRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listProducts();
    return rows.map(toProductRow);
  }
  return [];
}

export async function upsertProduct(input: fb.ProductWriteInput) {
  if (getDataProvider() !== "sqlite") {
    const result = await liveActions().upsertProduct(input);
    return { ok: true, id: result.id };
  }
  // SQLite dev mode: products catalog not implemented yet.
  return { ok: true, id: String(input.id ?? "PR-DEMO") };
}

export async function deleteProduct(id: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().deleteProduct(id);
    return { ok: true };
  }
  // SQLite dev mode: products not implemented yet.
  return { ok: true };
}

export async function uploadProductImage(formData: FormData) {
  if (getDataProvider() === "sqlite") {
    const productId = String(formData.get("productId") || "");
    return { ok: true, url: "", productId };
  }
  const file = formData.get("file");
  const productId = String(formData.get("productId") || "");
  if (!(file instanceof File)) throw new Error("Choose an image to upload");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return liveActions().uploadProductImage(productId, bytes, file.type || "image/jpeg");
}

// ---------------------------------------------------------------------------
// Rewards catalog
// ---------------------------------------------------------------------------

export async function listRewardsCatalog(): Promise<UnifiedRewardRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listRewardsCatalog();
    return rows.map(toRewardRow);
  }
  return [];
}

export async function upsertReward(input: {
  id?: string;
  name: string;
  pointsCost: number;
  stock?: number;
  active?: boolean;
}) {
  if (getDataProvider() !== "sqlite") {
    const result = await liveActions().upsertReward(input);
    return { ok: true, id: result.id };
  }
  // SQLite dev mode: rewards catalog not implemented yet.
  return { ok: true, id: String(input.id ?? "RW-DEMO") };
}

// ---------------------------------------------------------------------------
// Bins
// ---------------------------------------------------------------------------

export async function listBins(): Promise<UnifiedBinRow[]> {
  if (getDataProvider() !== "sqlite") {
    const rows = await liveActions().listBins();
    return rows.map(toBinRow);
  }
  return [];
}

export async function upsertBin(input: {
  id?: string;
  location: string;
  type: string;
  agent?: string;
  fillPercent?: number;
  status?: string;
  lat?: number;
  lng?: number;
}) {
  if (getDataProvider() !== "sqlite") {
    const payload: Record<string, unknown> = {
      id: input.id,
      location: input.location,
      type: input.type,
      agent: input.agent,
      fillPercent: input.fillPercent,
      fillLevel: input.fillPercent,
      status: input.status ?? "ok",
    };
    if (input.lat != null && input.lng != null) {
      payload.lat = input.lat;
      payload.lng = input.lng;
      payload.geo = { latitude: input.lat, longitude: input.lng };
    }
    const result = await liveActions().upsertBin(payload);
    return { ok: true, id: result.id };
  }
  return { ok: true, id: String(input.id ?? "BIN-DEMO") };
}

export async function forcePickupStatus(jobId: string, status: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().forceJobStatus(jobId, status);
    return { ok: true };
  }
  assertSqlite();
  const db = await getDb();
  db.update(pickups).set({ status, updatedAt: new Date() }).where(eq(pickups.id, jobId)).run();
  persistDb();
  revalidatePath("/dashboard/pickups");
  return { ok: true };
}

export async function voidBag(code: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().voidBagCode(code);
    return { ok: true };
  }
  // SQLite dev mode: bags ledger is not implemented for voiding yet.
  return { ok: true };
}

export async function setPartnerAvailability(uid: string, status: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().setPartnerStatus(uid, status);
    return { ok: true };
  }
  // SQLite dev mode: partner availability changes not implemented yet.
  return { ok: true };
}

export async function patchPartner(uid: string, patch: { serviceArea?: string; vehicle?: string; role?: string }) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().updatePartnerProfile(uid, patch);
    return { ok: true };
  }
  // SQLite dev mode: partner profile patch not implemented yet.
  return { ok: true };
}

export async function suspendUser(uid: string, suspended: boolean, reason?: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().setUserSuspended(uid, suspended, reason);
    return { ok: true };
  }
  // SQLite dev mode: user suspension not implemented yet.
  return { ok: true };
}

export async function getUserActivity(uid: string) {
  if (getDataProvider() !== "sqlite") {
    return liveActions().listUserActivity(uid);
  }
  return { pickups: [], orders: [] };
}

export async function listOrders() {
  if (getDataProvider() !== "sqlite") {
    return liveActions().listOrders();
  }
  return [];
}

export async function setOrderStatus(userId: string, orderId: string, status: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().advanceOrderStatus(userId, orderId, status);
    return { ok: true };
  }
  // SQLite dev mode: orders not implemented yet.
  return { ok: true };
}

export async function sendPush(input: {
  target: "all_users" | "all_partners" | "user" | "partner";
  uid?: string;
  title: string;
  body: string;
}) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().sendPushNotification(input);
    return { ok: true };
  }
  throw new Error("Push notifications require WASTY_DATA_PROVIDER=firebase with Admin SDK credentials.");
}

export async function listPushHistory(limitCount = 40) {
  await requirePermission("notifications:read");
  if (getDataProvider() !== "sqlite") return liveActions().listPushNotificationsHistory(limitCount);
  return [];
}

export async function loadAppConfig() {
  await requirePermission("config:write");
  if (getDataProvider() !== "sqlite") {
    return liveActions().getAppConfig();
  }
  return {
    demoMode: true,
    marketplaceEnabled: true,
    instantPayout: false,
    classifierEnabled: true,
    partnerMinVersion: "1.0.0",
    userMinVersion: "1.0.0",
    updateBanner: "",
  };
}

export async function persistAppConfig(patch: Record<string, unknown>) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().saveAppConfig(patch);
    return { ok: true };
  }
  // SQLite dev mode: config persistence can be added later.
  return { ok: true };
}

export async function listServiceZones() {
  if (getDataProvider() !== "sqlite") {
    return liveActions().listZones();
  }
  return [];
}

export async function saveServiceZone(input: {
  id?: string;
  name: string;
  slots: string;
  partners?: number;
  surge?: string;
  status?: string;
}) {
  if (getDataProvider() !== "sqlite") {
    return liveActions().upsertZone(input);
  }
  return { ok: true, id: String(input.id ?? "ZONE-DEMO") };
}

export async function replyToOps(id: string, note: string) {
  if (getDataProvider() !== "sqlite") {
    await liveActions().replyOpsReport(id, note);
    return { ok: true };
  }
  return { ok: true };
}

export async function listMrfFacilities() {
  if (getDataProvider() !== "sqlite") return liveActions().listMrfFacilities();
  return [];
}

export async function saveMrfFacility(input: {
  id?: string;
  name: string;
  zone: string;
  capacity: string;
  status?: string;
}) {
  if (getDataProvider() !== "sqlite") return liveActions().upsertMrfFacility(input);
  return { ok: true, id: String(input.id ?? "MRF-DEMO") };
}

export async function listMrfInbound() {
  if (getDataProvider() !== "sqlite") return liveActions().listMrfInbound();
  return [];
}

export async function createMrfInbound(input: {
  facility: string;
  source: string;
  weight: string;
  bags: string;
  status?: string;
}) {
  if (getDataProvider() !== "sqlite") return liveActions().logMrfInbound(input);
  return { ok: true, id: "MRF-INBOUND-DEMO" };
}

export async function listAiJobs() {
  if (getDataProvider() !== "sqlite") {
    await liveActions().ensureAiJobsFromPickups().catch(() => null);
    return liveActions().listAiJobs();
  }
  return [];
}

export async function overrideAiResult(id: string, category: string) {
  if (getDataProvider() !== "sqlite") return liveActions().overrideAiJob(id, category);
  return { ok: true };
}

export async function setLiveAiModel(model: string) {
  if (getDataProvider() !== "sqlite") return liveActions().setAiModelVersion(model);
  return { ok: true };
}

export async function getLiveAiModel() {
  if (getDataProvider() !== "sqlite") return liveActions().getAiModelVersion();
  return "v2.1";
}

export async function listMaterialLots() {
  if (getDataProvider() !== "sqlite") return liveActions().listMaterialLots();
  return [];
}

export async function saveMaterialLot(input: {
  id?: string;
  lot: string;
  stream: string;
  grade: string;
  qty: string;
  facility: string;
  status?: string;
}) {
  if (getDataProvider() !== "sqlite") return liveActions().upsertMaterialLot(input);
  return { ok: true, id: String(input.id ?? "LOT-DEMO") };
}

export async function listP2pListings() {
  if (getDataProvider() !== "sqlite") return liveActions().listP2pListings();
  return [];
}

export async function createP2pTrade(input: {
  seller: string;
  material: string;
  qty: string;
  ask: string;
  status?: string;
}) {
  if (getDataProvider() !== "sqlite") return liveActions().createP2pListing(input);
  return { ok: true, id: "P2P-DEMO" };
}

export async function resolveP2pTrade(id: string, resolution: string, note?: string) {
  if (getDataProvider() !== "sqlite") return liveActions().resolveP2pDispute(id, resolution, note);
  return { ok: true };
}

export async function listBuyers() {
  if (getDataProvider() !== "sqlite") return liveActions().listBuyers();
  return [];
}

export async function saveBuyer(input: {
  id?: string;
  name: string;
  type: string;
  streams: string;
  volume: string;
  kyc?: string;
  status?: string;
  contractVolume?: string;
  contractPrice?: string;
}) {
  if (getDataProvider() !== "sqlite") return liveActions().upsertBuyer(input);
  return { ok: true, id: String(input.id ?? "BUYER-DEMO") };
}

export async function getImpactStats() {
  await requirePermission("impact:read");
  if (getDataProvider() !== "sqlite") return liveActions().getImpactStats();
  const { demoImpactStats } = await import("@/lib/analytics/demo");
  return demoImpactStats("30d");
}

export async function lookupPassport(id: string) {
  await requirePermission("passport:read");
  if (getDataProvider() !== "sqlite") return liveActions().lookupPassport(id);
  return null;
}

export async function listAdminAudit() {
  await requirePermission("audit:read");
  if (getDataProvider() !== "sqlite") return liveActions().listAdminAudit();
  const { demoComplianceDashboard } = await import("@/lib/analytics/demo");
  return demoComplianceDashboard().audit;
}

export async function getAnalyticsDashboard(range: "7d" | "30d" | "90d" = "30d") {
  await requirePermission("analytics:read");
  if (getDataProvider() !== "sqlite") return liveActions().getAnalyticsDashboard(range);
  const { demoAnalyticsDashboard } = await import("@/lib/analytics/demo");
  return demoAnalyticsDashboard(range);
}

export type CommandCenterStats = {
  totalJobs: number;
  activeJobs: number;
  completedToday: number;
  totalPartners: number;
  onlinePartners: number;
  openAlerts: number;
};

export async function getCommandCenterStats(): Promise<CommandCenterStats> {
  await requirePermission("ops:read");
  if (getDataProvider() !== "sqlite") return liveActions().getCommandCenterStats();

  const db = await getDb();
  const [pickupRows, partnerRows, ticketRows] = await Promise.all([
    db.select().from(pickups).all(),
    db.select().from(partners).all(),
    db.select().from(supportTickets).all(),
  ]);
  const todayKey = new Date().toDateString();
  return {
    totalJobs: pickupRows.length,
    activeJobs: pickupRows.filter((row) => row.status !== "completed" && row.status !== "cancelled").length,
    completedToday: pickupRows.filter(
      (row) => row.status === "completed" && new Date(row.updatedAt).toDateString() === todayKey,
    ).length,
    totalPartners: partnerRows.length,
    onlinePartners: partnerRows.filter((row) => row.status === "online").length,
    openAlerts: ticketRows.filter((row) => row.status === "open" || row.status === "urgent").length,
  };
}

export async function getJobTrends(range: "7d" | "30d" | "90d" = "30d") {
  const dashboard = await getAnalyticsDashboard(range);
  return dashboard.jobTrends;
}

export async function getWasteStreamBreakdown(range: "7d" | "30d" | "90d" = "30d") {
  const dashboard = await getAnalyticsDashboard(range);
  return dashboard.wasteStreams;
}

export async function getPartnerUtilization() {
  const dashboard = await getAnalyticsDashboard("30d");
  return dashboard.partnerUtilization;
}

export async function getAlertTrends(range: "7d" | "30d" | "90d" = "30d") {
  const dashboard = await getAnalyticsDashboard(range);
  return dashboard.alertTrends;
}

export async function getDiversionTrends(range: "7d" | "30d" | "90d" = "30d") {
  const dashboard = await getAnalyticsDashboard(range);
  return dashboard.diversionTrends;
}

export async function getComplianceDashboard(range: "7d" | "30d" | "90d" = "30d") {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().getComplianceDashboard(range);
  const { demoComplianceDashboard } = await import("@/lib/analytics/demo");
  return demoComplianceDashboard(range);
}

export async function getCommandDeskData(range: "7d" | "30d" | "90d" = "30d") {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().getCommandDeskData(range);
  const { demoCommandDesk } = await import("@/lib/government/demo");
  return demoCommandDesk(range);
}

export async function listCitizenReports(filters?: { status?: string; issueType?: string; limit?: number }) {
  await requirePermission("citizen_reports:read");
  if (getDataProvider() !== "sqlite") return liveActions().listCitizenReports(filters);
  const { demoCitizenReports } = await import("@/lib/government/demo");
  return demoCitizenReports(filters);
}

export async function updateCitizenReportStatus(
  userId: string,
  reportId: string,
  status: "submitted" | "in_progress" | "resolved" | "escalated",
  note?: string,
) {
  await requirePermission("citizen_reports:triage");
  if (getDataProvider() !== "sqlite") return liveActions().updateCitizenReportStatus(userId, reportId, status, note);
  const { demoUpdateCitizenReport } = await import("@/lib/government/demo");
  return demoUpdateCitizenReport(userId, reportId, status, note);
}

export async function getGovernmentCaseQueue() {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().getGovernmentCaseQueue();
  const { demoCaseQueue } = await import("@/lib/government/demo");
  return demoCaseQueue();
}

export async function listGovernmentJobs(filters?: { status?: string; q?: string; limit?: number }) {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().listGovernmentJobs(filters);
  const { demoGovernmentJobs } = await import("@/lib/government/demo");
  return demoGovernmentJobs(filters);
}

export async function getGovernmentJobDetail(jobId: string) {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().getGovernmentJobDetail(jobId);
  const { demoGovernmentJobDetail } = await import("@/lib/government/demo");
  return demoGovernmentJobDetail(jobId);
}

export async function listGovernmentHouseholds(filters?: { q?: string; limit?: number }) {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().listGovernmentHouseholds(filters);
  const { demoGovernmentHouseholds } = await import("@/lib/government/demo");
  return demoGovernmentHouseholds();
}

export async function getGovernmentHouseholdProfile(uid: string) {
  await requirePermission("compliance:read");
  if (getDataProvider() !== "sqlite") return liveActions().getGovernmentHouseholdProfile(uid);
  const { demoGovernmentHouseholdProfile } = await import("@/lib/government/demo");
  return demoGovernmentHouseholdProfile(uid);
}

export async function listGovernmentAudit(limitCount = 200) {
  await requirePermission("audit:read");
  if (getDataProvider() !== "sqlite") return liveActions().listGovernmentAudit(limitCount);
  const { demoGovernmentAudit } = await import("@/lib/government/demo");
  return demoGovernmentAudit();
}

export async function getLiveMapSnapshot() {
  await requirePermission("map:read");
  if (getDataProvider() !== "sqlite") return liveActions().getLiveMapSnapshot();
  const { demoLiveMapSnapshot } = await import("@/lib/live-map/demo");
  return demoLiveMapSnapshot();
}

export async function listAdmins() {
  await requirePermission("roles:manage");
  if (getDataProvider() !== "sqlite") return liveActions().listAdmins();
  return [
    {
      uid: "dev-admin",
      email: "ops@wasty.app",
      adminType: "owner",
      status: "active",
      createdAt: new Date().toISOString(),
      createdBy: "local-dev",
    },
  ];
}

export async function grantAdminAccess(email: string, adminType: "owner" | "government" | "ops_manager" | "support") {
  if (getDataProvider() !== "sqlite") return liveActions().grantAdminAccess(email, adminType);
  return { ok: true };
}

export async function createStaffAccount(input: {
  email: string;
  password: string;
  adminType: "owner" | "government" | "ops_manager" | "support";
}) {
  await requirePermission("roles:manage");
  if (getDataProvider() !== "sqlite") return liveActions().createStaffAccount(input);
  return { ok: true, uid: "demo-staff" };
}

export async function setAdminType(uid: string, adminType: "owner" | "government" | "ops_manager" | "support") {
  if (getDataProvider() !== "sqlite") return liveActions().setAdminType(uid, adminType);
  return { ok: true };
}

export async function revokeAdminAccess(uid: string) {
  if (getDataProvider() !== "sqlite") return liveActions().revokeAdminAccess(uid);
  return { ok: true };
}
