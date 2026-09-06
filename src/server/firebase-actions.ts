"use server";

/**
 * Firebase Admin SDK server actions for Wasty Admin.
 *
 * These read/write the SAME Firestore collections used by the consumer
 * app (Application_mvp) and the partner app (Partner_Mvp):
 *   jobs, partners, bagsRegistry, opsReports, users/{uid}/wallet/main,
 *   partners/{uid}/dailyRoutes, partners/{uid}/payoutEntries, products, etc.
 *
 * All Admin SDK access bypasses Firestore security rules by design — every
 * function here is meant to be called only from trusted server code
 * (Server Components / Server Actions), never exposed directly to
 * untrusted input without validation.
 *
 * Dates are always serialized to ISO strings (or null) so results are
 * safe to pass straight into Client Components.
 */
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import {
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  Timestamp,
} from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb, getAdminStorage, isFirebaseAdminReady } from "@/lib/firebase/admin";
import {
  type AnalyticsDashboard,
  type AnalyticsRange,
  type AreaOversightRow,
  type ComplianceDashboard,
  type ComplianceJob,
  type DiversionPoint,
  type GovernmentOverview,
  type MrfOversightRow,
  emptyDayKeys,
  formatDayLabel,
  type ImpactStats,
  rangeStartIso,
  slugStream,
} from "@/lib/analytics/types";
import {
  type CitizenReportRow,
  type CitizenReportStatus,
  type CommandDeskData,
  type GovCaseQueue,
  type GovHouseholdProfile,
  type GovHouseholdRow,
  type GovJobRow,
  normalizeCitizenStatus,
} from "@/lib/government/types";
import {
  binColor,
  type LiveMapPoint,
  type LiveMapSnapshot,
  parseGeo,
  parseLastSeenMs,
  pickupColor,
  vehicleColor,
} from "@/lib/live-map/types";
import { bustAnalyticsCache, CACHE_TAGS, CACHE_TTL } from "@/lib/cache/tags";
import { type AdminType, type Permission, resolveAdminType } from "@/lib/auth/permissions";
import { requirePermission, requireSession } from "@/lib/auth/require-admin";
import { getSessionUser } from "@/server/auth-actions";

function assertFirebaseReady() {
  if (!isFirebaseAdminReady()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_SDK_PATH (or GOOGLE_APPLICATION_CREDENTIALS) in .env.local.",
    );
  }
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }
  return null;
}

async function getCurrentAdminUid(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.uid ?? null;
}

async function assertAdminRead(permission?: Permission) {
  if (permission) {
    await requirePermission(permission);
  } else {
    await requireSession();
  }
}

export async function getDbStatus() {
  await requireSession();
  const ready = isFirebaseAdminReady();
  return {
    provider: "firebase" as const,
    ready,
    message: ready
      ? "Connected to Firebase (Admin SDK)"
      : "Firebase Admin not configured — set FIREBASE_ADMIN_SDK_PATH",
  };
}

// ---------------------------------------------------------------------------
// jobs/{id}
// ---------------------------------------------------------------------------

export type JobRecord = {
  id: string;
  userId: string;
  pickupId: string | null;
  wasteType: string;
  date: string;
  time: string;
  location: string;
  bags: number;
  lat: number | null;
  lng: number | null;
  status: string;
  assignedPartnerId: string | null;
  cancelReason: string | null;
  weight: string | null;
  weightKg: number | null;
  beforePhoto: string | null;
  afterPhoto: string | null;
  tipAmount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function mapJobDoc(doc: QueryDocumentSnapshot | DocumentSnapshot): JobRecord {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    userId: String(data.userId ?? ""),
    pickupId: data.pickupId != null ? String(data.pickupId) : null,
    wasteType: String(data.wasteType ?? "mixed"),
    date: String(data.date ?? ""),
    time: String(data.time ?? ""),
    location: String(data.location ?? ""),
    bags: Number(data.bags ?? 1) || 1,
    lat: parseGeo(data)?.lat ?? null,
    lng: parseGeo(data)?.lng ?? null,
    status: String(data.status ?? "scheduled"),
    assignedPartnerId: data.assignedPartnerId ?? null,
    cancelReason: data.cancelReason ?? null,
    weight: data.weight != null ? String(data.weight) : null,
    weightKg: typeof data.weightKg === "number" ? data.weightKg : null,
    beforePhoto: data.beforePhoto != null ? String(data.beforePhoto) : null,
    afterPhoto: data.afterPhoto != null ? String(data.afterPhoto) : null,
    tipAmount: typeof data.tipAmount === "number" ? data.tipAmount : null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function listJobs(filters?: {
  status?: string;
  partnerId?: string;
  limit?: number;
}): Promise<JobRecord[]> {
  await assertAdminRead("ops:read");
  assertFirebaseReady();
  const db = getAdminDb();
  let q: Query = db.collection("jobs");
  if (filters?.status) q = q.where("status", "==", filters.status);
  if (filters?.partnerId) q = q.where("assignedPartnerId", "==", filters.partnerId);

  try {
    const snap = await q
      .orderBy("createdAt", "desc")
      .limit(filters?.limit ?? 200)
      .get();
    return snap.docs.map(mapJobDoc);
  } catch {
    // Missing composite index for the filter+orderBy combo — fall back unsorted.
    const snap = await q.limit(filters?.limit ?? 200).get();
    return snap.docs.map(mapJobDoc);
  }
}

export async function assignJob(jobId: string, partnerId: string) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  if (!jobId || !partnerId) throw new Error("jobId and partnerId are required");
  const db = getAdminDb();
  const jobRef = db.collection("jobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new Error("Job not found");
  const job = jobSnap.data()!;
  if (job.status === "completed" || job.status === "cancelled") {
    throw new Error(`Cannot assign a ${job.status} job`);
  }

  const partnerSnap = await db.collection("partners").doc(partnerId).get();
  if (!partnerSnap.exists) throw new Error("Partner not found");

  await jobRef.update({
    assignedPartnerId: partnerId,
    status: job.status === "scheduled" ? "scheduled" : job.status,
    updatedAt: new Date().toISOString(),
  });

  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
  revalidateTag(CACHE_TAGS.ops, "max");
  bustAnalyticsCache(revalidateTag);
  return { ok: true, jobId, partnerId };
}

/** Admin cancel — mirrors the user-app `cancelPickup` callable but runs with Admin privileges. */
export async function cancelJob(jobId: string, reason?: string) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  if (!jobId) throw new Error("jobId is required");
  const db = getAdminDb();
  const jobRef = db.collection("jobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new Error("Job not found");
  const job = jobSnap.data()!;
  if (job.status === "completed") throw new Error("Cannot cancel a completed job");

  const nowIso = new Date().toISOString();
  const cancelReason = reason?.trim() || "Cancelled by admin";

  await jobRef.update({
    status: "cancelled",
    cancelReason,
    updatedAt: nowIso,
  });

  if (job.userId && job.pickupId != null) {
    const pickupRef = db.collection("users").doc(String(job.userId)).collection("pickups").doc(String(job.pickupId));
    const pickupSnap = await pickupRef.get();
    if (pickupSnap.exists) {
      await pickupRef.update({
        status: "cancelled",
        cancelled: true,
        cancelReason,
        updatedAt: nowIso,
      });
    }
  }

  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
  revalidateTag(CACHE_TAGS.ops, "max");
  bustAnalyticsCache(revalidateTag);
  return { ok: true, jobId };
}

// ---------------------------------------------------------------------------
// partners/{uid}
// ---------------------------------------------------------------------------

export type PartnerDocRecord = {
  type: string;
  url: string;
  status: string;
  uploadedAt: string | null;
};

export type PartnerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  status: string;
  vehicle: string | null;
  plateNumber: string | null;
  serviceArea: string | null;
  photoUrl: string | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  docs: PartnerDocRecord[];
  createdAt: string | null;
};

function mapPartnerDoc(doc: QueryDocumentSnapshot | DocumentSnapshot): PartnerRecord {
  const data = doc.data() ?? {};
  const docs = Array.isArray(data.docs) ? data.docs : [];
  return {
    id: doc.id,
    name: String(data.name ?? "—"),
    email: String(data.email ?? ""),
    phone: data.phone ?? null,
    role: data.role ?? null,
    status: String(data.status ?? "offline"),
    vehicle: data.vehicle ?? null,
    plateNumber: data.plateNumber ?? null,
    serviceArea: data.serviceArea ?? null,
    photoUrl: data.photoUrl ?? null,
    rating: typeof data.rating === "number" ? data.rating : null,
    lat: parseGeo(data)?.lat ?? null,
    lng: parseGeo(data)?.lng ?? null,
    lastSeenAt: toIso(data.lastSeenAt ?? data.lastSeenAtServer),
    docs: docs.map((d: Record<string, unknown>) => ({
      type: String(d?.type ?? "id"),
      url: String(d?.url ?? ""),
      status: String(d?.status ?? "not_uploaded"),
      uploadedAt: toIso(d?.uploadedAt),
    })),
    createdAt: toIso(data.createdAt),
  };
}

export async function listPartners(): Promise<PartnerRecord[]> {
  await assertAdminRead("people:read");
  assertFirebaseReady();
  const db = getAdminDb();
  try {
    const snap = await db.collection("partners").orderBy("createdAt", "desc").get();
    return snap.docs.map(mapPartnerDoc);
  } catch {
    const snap = await db.collection("partners").get();
    return snap.docs.map(mapPartnerDoc);
  }
}

/** Marks all uploaded docs approved and grants the `partner` custom claim. */
export async function approvePartner(uid: string) {
  await requirePermission("people:write");
  assertFirebaseReady();
  if (!uid) throw new Error("uid is required");
  const db = getAdminDb();
  const auth = getAdminAuth();

  const ref = db.collection("partners").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Partner not found");
  const data = snap.data()!;
  const docs: PartnerDocRecord[] = Array.isArray(data.docs) ? data.docs : [];
  const approvedDocs = docs.map((d) => ({ ...d, status: "approved" }));

  await ref.update({
    docs: approvedDocs,
    approvedAt: new Date().toISOString(),
    approvedBy: (await getCurrentAdminUid()) ?? "admin-console",
  });

  const user = await auth.getUser(uid).catch(() => null);
  await auth.setCustomUserClaims(uid, { ...(user?.customClaims ?? {}), role: "partner" });

  revalidatePath("/dashboard/partners");
  return { ok: true, uid };
}

export async function rejectPartner(uid: string, reason?: string) {
  await requirePermission("people:write");
  assertFirebaseReady();
  if (!uid) throw new Error("uid is required");
  const db = getAdminDb();

  const ref = db.collection("partners").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Partner not found");
  const data = snap.data()!;
  const docs: PartnerDocRecord[] = Array.isArray(data.docs) ? data.docs : [];
  const rejectedDocs = docs.map((d) => ({ ...d, status: "rejected" }));

  await ref.update({
    docs: rejectedDocs,
    status: "offline",
    rejectionReason: reason?.trim() || null,
    rejectedAt: new Date().toISOString(),
    rejectedBy: (await getCurrentAdminUid()) ?? "admin-console",
  });

  revalidatePath("/dashboard/partners");
  return { ok: true, uid };
}

/** Creates a pending partner shell. Partner still completes signup/claim in the Partner app. */
export async function invitePartner(input: {
  name: string;
  phone: string;
  zone?: string;
  vehicle?: string;
}): Promise<{ uid: string }> {
  await requirePermission("people:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const ref = db.collection("partners").doc();
  await ref.set({
    name: input.name,
    phone: input.phone,
    serviceArea: input.zone ?? "",
    vehicle: input.vehicle ?? "",
    status: "offline",
    kycStatus: "pending",
    invitedAt: new Date().toISOString(),
    invitedBy: (await getCurrentAdminUid()) ?? "admin-console",
    note: "Invited from admin — partner must open Partner app with this phone and complete KYC.",
  });
  revalidatePath("/dashboard/partners");
  return { uid: ref.id };
}

// ---------------------------------------------------------------------------
// opsReports/{id}
// ---------------------------------------------------------------------------

export type OpsReportRecord = {
  id: string;
  type: string;
  partnerId: string;
  note: string;
  jobId: string | null;
  geo: { latitude: number; longitude: number } | null;
  meta: Record<string, unknown>;
  status: string;
  createdAt: string | null;
};

function mapOpsReportDoc(doc: QueryDocumentSnapshot | DocumentSnapshot): OpsReportRecord {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    type: String(data.type ?? "other"),
    partnerId: String(data.partnerId ?? ""),
    note: String(data.note ?? ""),
    jobId: data.jobId ?? null,
    geo: data.geo ?? null,
    meta: (data.meta as Record<string, unknown>) ?? {},
    status: String(data.status ?? "open"),
    createdAt: toIso(data.createdAt),
  };
}

export async function listOpsReports(filters?: {
  status?: string;
  type?: string;
  limit?: number;
}): Promise<OpsReportRecord[]> {
  await assertAdminRead("ops:read");
  assertFirebaseReady();
  const db = getAdminDb();
  let q: Query = db.collection("opsReports");
  if (filters?.status) q = q.where("status", "==", filters.status);
  if (filters?.type) q = q.where("type", "==", filters.type);

  try {
    const snap = await q
      .orderBy("createdAt", "desc")
      .limit(filters?.limit ?? 200)
      .get();
    return snap.docs.map(mapOpsReportDoc);
  } catch {
    const snap = await q.limit(filters?.limit ?? 200).get();
    return snap.docs.map(mapOpsReportDoc);
  }
}

export async function ackOpsReport(id: string, note?: string) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  if (!id) throw new Error("id is required");
  const db = getAdminDb();
  const ref = db.collection("opsReports").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Ops report not found");

  await ref.update({
    status: "acked",
    ackNote: note?.trim() || null,
    ackedAt: new Date().toISOString(),
    ackedBy: (await getCurrentAdminUid()) ?? "admin-console",
  });

  revalidatePath("/dashboard/support");
  revalidatePath("/dashboard/ops");
  return { ok: true, id };
}

export async function closeOpsReport(id: string, note?: string) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  if (!id) throw new Error("id is required");
  const db = getAdminDb();
  const ref = db.collection("opsReports").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Ops report not found");

  await ref.update({
    status: "closed",
    closeNote: note?.trim() || null,
    closedAt: new Date().toISOString(),
    closedBy: (await getCurrentAdminUid()) ?? "admin-console",
  });

  revalidatePath("/dashboard/support");
  revalidatePath("/dashboard/ops");
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// bagsRegistry/{code}
// ---------------------------------------------------------------------------

export type BagRegistryRecord = {
  code: string;
  issuedBy: string | null;
  issuedAt: string | null;
  usedBy: string | null;
  usedAt: string | null;
  voided: boolean;
  batchId: string | null;
  status: string;
};

function mapBagRegistryDoc(doc: QueryDocumentSnapshot | DocumentSnapshot): BagRegistryRecord {
  const data = doc.data() ?? {};
  const voided = Boolean(data.voided);
  const usedBy = data.usedBy ?? null;
  return {
    code: doc.id,
    issuedBy: data.issuedBy ?? null,
    issuedAt: toIso(data.issuedAt),
    usedBy,
    usedAt: toIso(data.usedAt),
    voided,
    batchId: data.batchId ? String(data.batchId) : null,
    status: String(data.status ?? (voided ? "voided" : usedBy ? "used" : "unused")),
  };
}

export async function listBagsRegistry(limitCount = 200): Promise<BagRegistryRecord[]> {
  await assertAdminRead("assets:read");
  assertFirebaseReady();
  const db = getAdminDb();
  try {
    const snap = await db.collection("bagsRegistry").orderBy("issuedAt", "desc").limit(limitCount).get();
    return snap.docs.map(mapBagRegistryDoc);
  } catch {
    const snap = await db.collection("bagsRegistry").limit(limitCount).get();
    return snap.docs.map(mapBagRegistryDoc);
  }
}

export async function issueBagCodes(count: number, prefix: string) {
  await requirePermission("assets:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const safeCount = Math.min(Math.max(Math.floor(count) || 1, 1), 200);
  const safePrefix =
    (prefix || "WSTY-BAG")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "") || "WSTY-BAG";
  const issuedBy = (await getCurrentAdminUid()) ?? "admin-console";
  const issuedAt = new Date().toISOString();
  const stamp = Date.now().toString(36).toUpperCase();

  const batch = db.batch();
  const codes: string[] = [];
  const batchId = `${safePrefix}-${stamp}`;
  for (let i = 0; i < safeCount; i += 1) {
    const code = `${safePrefix}-${stamp}-${String(i + 1).padStart(3, "0")}`;
    codes.push(code);
    batch.set(
      db.collection("bagsRegistry").doc(code),
      {
        code,
        qrPayload: code,
        batchId,
        status: "unused",
        issuedBy,
        issuedAt,
        usedBy: null,
        usedAt: null,
        voided: false,
      },
      { merge: true },
    );
  }
  await batch.commit();

  revalidatePath("/dashboard/bags");
  return { ok: true, count: codes.length, codes, batch: batchId };
}

// ---------------------------------------------------------------------------
// users/{uid} + users/{uid}/wallet/main
// ---------------------------------------------------------------------------

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  points: number;
  carbonCreditsKg: number;
  wasteDivertedKg: number;
  createdAt: string | null;
};

export async function listUsers(limitCount = 200): Promise<UserRecord[]> {
  await assertAdminRead("people:read");
  assertFirebaseReady();
  const db = getAdminDb();
  let snap: QuerySnapshot;
  try {
    snap = await db.collection("users").orderBy("createdAt", "desc").limit(limitCount).get();
  } catch {
    snap = await db.collection("users").limit(limitCount).get();
  }

  return Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data() ?? {};
      const walletSnap = await doc.ref.collection("wallet").doc("main").get();
      const wallet = walletSnap.data() ?? {};
      return {
        id: doc.id,
        name: String(data.name ?? "—"),
        email: String(data.email ?? ""),
        phone: data.phone ?? null,
        points: typeof wallet.points === "number" ? wallet.points : 0,
        carbonCreditsKg: typeof wallet.carbonCreditsKg === "number" ? wallet.carbonCreditsKg : 0,
        wasteDivertedKg: typeof wallet.wasteDivertedKg === "number" ? wallet.wasteDivertedKg : 0,
        createdAt: toIso(data.createdAt),
      };
    }),
  );
}

/** Admin-only wallet write; also appends an `adminAudit/{id}` trail entry. */
export async function adjustWallet(uid: string, pointsDelta: number, reason: string) {
  await requirePermission("people:write");
  assertFirebaseReady();
  if (!uid) throw new Error("uid is required");
  if (!Number.isFinite(pointsDelta) || pointsDelta === 0) throw new Error("pointsDelta must be a non-zero number");

  const db = getAdminDb();
  const walletRef = db.collection("users").doc(uid).collection("wallet").doc("main");
  const auditRef = db.collection("adminAudit").doc();
  const performedBy = (await getCurrentAdminUid()) ?? "admin-console";
  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const current = snap.exists ? (snap.data() ?? {}) : {};
    const points = typeof current.points === "number" ? current.points : 0;
    tx.set(walletRef, { ...current, points: points + pointsDelta }, { merge: true });
    tx.set(auditRef, {
      action: "adjustWallet",
      targetUid: uid,
      pointsDelta,
      reason: reason?.trim() || "No reason given",
      performedBy,
      createdAt: nowIso,
    });
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/rewards");
  return { ok: true, uid, pointsDelta };
}

// ---------------------------------------------------------------------------
// products / rewardsCatalog
// ---------------------------------------------------------------------------

export async function listProducts(): Promise<Array<Record<string, unknown> & { id: string }>> {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const snap = await db.collection("products").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export type ProductWriteInput = {
  id?: string;
  name: string;
  priceValue: number;
  mrp?: number;
  category: string;
  description?: string;
  stock: number;
  ecoPoints?: number;
  icon?: string;
  accent?: string;
  badge?: string;
  featured?: boolean;
  unit?: string;
  material?: string;
  brand?: string;
  seller?: string;
  rating?: number;
  reviews?: number;
  imageUrl?: string;
  inStock?: boolean;
  returnDays?: number;
  highlights?: string[];
};

/** Writes the exact `products/{id}` shape the user app catalog + placeOrder read. */
export async function upsertProduct(input: ProductWriteInput) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const id = String(input.id || `p${Date.now()}`);
  const priceValue = Math.max(0, Math.round(Number(input.priceValue) || 0));
  const mrpRaw = Number(input.mrp);
  const mrp = Number.isFinite(mrpRaw) && mrpRaw > 0 ? Math.round(mrpRaw) : priceValue;
  const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
  const inStock = input.inStock === false ? false : stock > 0;
  const highlights = (input.highlights ?? []).map((h) => h.trim()).filter(Boolean);

  await db
    .collection("products")
    .doc(id)
    .set(
      {
        id,
        name: input.name.trim(),
        price: `₹${priceValue}`,
        priceValue,
        mrp,
        category: input.category || "Home",
        description: input.description?.trim() ?? "",
        stock,
        ecoPoints: Math.max(0, Math.round(Number(input.ecoPoints) || 0)),
        icon: input.icon || "cube-outline",
        accent: input.accent || "#E8F6EE",
        badge: input.badge?.trim() || null,
        featured: Boolean(input.featured),
        unit: input.unit?.trim() || null,
        material: input.material?.trim() || null,
        brand: input.brand?.trim() || "Wasty Co.",
        seller: input.seller?.trim() || "Wasty Eco Store",
        rating: Number.isFinite(Number(input.rating)) ? Number(input.rating) : 4.5,
        reviews: Math.max(0, Math.round(Number(input.reviews) || 0)),
        imageUrl: input.imageUrl?.trim() || null,
        inStock,
        returnDays: Math.max(0, Math.round(Number(input.returnDays) || (input.category === "Garden" ? 3 : 7))),
        highlights,
        updatedAt: new Date().toISOString(),
        updatedBy: (await getCurrentAdminUid()) ?? "admin-console",
      },
      { merge: true },
    );

  revalidatePath("/dashboard/marketplace");
  return { ok: true, id };
}

export async function deleteProduct(id: string) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  if (!id) throw new Error("Product id is required");
  await getAdminDb().collection("products").doc(id).delete();
  try {
    await getAdminStorage().bucket().file(`products/${id}.jpg`).delete({ ignoreNotFound: true });
  } catch {
    // Image may not exist or storage may be unconfigured.
  }
  revalidatePath("/dashboard/marketplace");
  return { ok: true };
}

export async function uploadProductImage(productId: string, bytes: Uint8Array, contentType: string) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  if (!productId) throw new Error("Product id is required");
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
  if (!contentType.startsWith("image/")) throw new Error("File must be an image");

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set");

  const token = crypto.randomUUID();
  const path = `products/${productId}.jpg`;
  const file = getAdminStorage().bucket(bucketName).file(path);
  await file.save(Buffer.from(bytes), {
    resumable: false,
    metadata: {
      contentType: contentType || "image/jpeg",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { ok: true, url, productId };
}

export async function listRewardsCatalog(): Promise<Array<Record<string, unknown> & { id: string }>> {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const snap = await db.collection("rewardsCatalog").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function upsertReward(reward: Record<string, unknown> & { id?: string }) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const id = String(reward.id ?? db.collection("rewardsCatalog").doc().id);
  await db
    .collection("rewardsCatalog")
    .doc(id)
    .set({ ...reward, id, updatedAt: new Date().toISOString() }, { merge: true });

  revalidatePath("/dashboard/rewards");
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// bins/{id}
// ---------------------------------------------------------------------------

export async function listBins(): Promise<Array<Record<string, unknown> & { id: string }>> {
  await assertAdminRead("assets:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const snap = await db.collection("bins").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function upsertBin(bin: Record<string, unknown> & { id?: string }) {
  await requirePermission("assets:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const id = String(bin.id ?? db.collection("bins").doc().id);
  await db
    .collection("bins")
    .doc(id)
    .set({ ...bin, id, updatedAt: new Date().toISOString() }, { merge: true });

  revalidatePath("/dashboard/bins");
  return { ok: true, id };
}

export async function getLiveMapSnapshot(): Promise<LiveMapSnapshot> {
  await requirePermission("map:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const staleBefore = Date.now() - 10 * 60 * 1000;

  const [jobsSnap, partnersSnap, binsSnap, usersSnap, alertsSnap] = await Promise.all([
    db.collection("jobs").limit(400).get(),
    db.collection("partners").limit(300).get(),
    db.collection("bins").limit(400).get(),
    db.collection("users").limit(400).get(),
    db.collection("opsReports").limit(150).get(),
  ]);

  const userNames = new Map<string, string>();
  for (const doc of usersSnap.docs) {
    const data = doc.data() ?? {};
    userNames.set(doc.id, String(data.name ?? data.displayName ?? "Citizen"));
  }

  const points: LiveMapPoint[] = [];

  for (const doc of jobsSnap.docs) {
    const job = mapJobDoc(doc);
    const geo = job.lat != null && job.lng != null ? { lat: job.lat, lng: job.lng } : parseGeo(doc.data() ?? {});
    if (!geo) continue;
    const active = job.status !== "completed" && job.status !== "cancelled";
    const userName = userNames.get(job.userId);
    points.push({
      id: job.id,
      kind: "pickup",
      title: userName || (job.userId ? `Pickup ${job.id.slice(0, 8)}` : job.id),
      subtitle: `${job.wasteType} · ${job.status.replaceAll("_", " ")} · ${job.location || "geotag"}`,
      lat: geo.lat,
      lng: geo.lng,
      status: job.status,
      color: pickupColor(job.status),
      active,
      full: false,
      radiusM: 80,
      updatedAt: job.updatedAt ?? job.createdAt,
      href: `/dashboard/compliance/jobs/${job.id}`,
    });
  }

  for (const doc of partnersSnap.docs) {
    const partner = mapPartnerDoc(doc);
    const data = doc.data() ?? {};
    const geo = partner.lat != null && partner.lng != null ? { lat: partner.lat, lng: partner.lng } : parseGeo(data);
    if (!geo) continue;
    const lastSeenMs = parseLastSeenMs(data.lastSeenAt ?? data.lastSeenAtServer) ?? (partner.lastSeenAt ? Date.parse(partner.lastSeenAt) : 0);
    const active =
      partner.status === "online" ||
      partner.status === "on_job" ||
      partner.status === "busy" ||
      lastSeenMs > staleBefore;
    points.push({
      id: partner.id,
      kind: "vehicle",
      title: partner.name,
      subtitle: `${partner.vehicle ?? "Vehicle"} · ${partner.status.replaceAll("_", " ")}`,
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

  const userSeen = new Set<string>();
  for (const doc of usersSnap.docs) {
    const data = doc.data() ?? {};
    const geo = parseGeo(data);
    if (!geo) continue;
    userSeen.add(doc.id);
    const name = userNames.get(doc.id) ?? doc.id.slice(0, 8);
    points.push({
      id: doc.id,
      kind: "user",
      title: name,
      subtitle: "Household geotag · 300m radius",
      lat: geo.lat,
      lng: geo.lng,
      status: String(data.status ?? "active"),
      color: "#8b5cf6",
      active: String(data.status ?? "active") !== "inactive",
      full: false,
      radiusM: 300,
      updatedAt: toIso(data.updatedAt ?? data.lastSeenAt),
      href: `/dashboard/compliance/households/${doc.id}`,
    });
  }

  const latestPickupByUser = new Map<string, LiveMapPoint>();
  for (const point of points.filter((p) => p.kind === "pickup")) {
    const job = jobsSnap.docs.find((d) => d.id === point.id);
    const userId = String(job?.data()?.userId ?? "");
    if (!userId) continue;
    const existing = latestPickupByUser.get(userId);
    if (!existing || (point.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      latestPickupByUser.set(userId, point);
    }
  }
  for (const [userId, point] of latestPickupByUser) {
    if (userSeen.has(userId)) continue;
    userSeen.add(userId);
    points.push({
      id: `user-${userId}`,
      kind: "user",
      title: userNames.get(userId) ?? point.title,
      subtitle: "User pin from latest pickup geotag",
      lat: point.lat,
      lng: point.lng,
      status: "active",
      color: "#8b5cf6",
      active: true,
      full: false,
      radiusM: 300,
      updatedAt: point.updatedAt,
      href: `/dashboard/compliance/households/${userId}`,
    });
  }

  for (const doc of binsSnap.docs) {
    const data = doc.data() ?? {};
    const geo = parseGeo(data);
    if (!geo) continue;
    const fill = Number(data.fillPercent ?? data.fillLevel ?? 0) || 0;
    const status = String(data.status ?? "ok");
    const full = fill >= 85 || status.toLowerCase() === "full";
    points.push({
      id: doc.id,
      kind: "bin",
      title: String(data.code ?? data.location ?? data.address ?? doc.id),
      subtitle: `Dustbin · ${Math.round(fill)}% · ${status}`,
      lat: geo.lat,
      lng: geo.lng,
      status,
      color: binColor(fill, status),
      active: !["damaged", "inactive", "offline"].includes(status.toLowerCase()),
      full,
      radiusM: 60,
      updatedAt: toIso(data.updatedAt ?? data.lastServicedAt),
      href: "/dashboard/bins",
    });
  }

  for (const doc of alertsSnap.docs) {
    const report = mapOpsReportDoc(doc);
    const geo = report.geo
      ? parseGeo({ geo: report.geo })
      : parseGeo(doc.data() ?? {});
    if (!geo) continue;
    const open = report.status === "open" || report.status === "urgent";
    points.push({
      id: report.id,
      kind: "alert",
      title: report.type.toUpperCase(),
      subtitle: report.note || "Ops alert",
      lat: geo.lat,
      lng: geo.lng,
      status: report.status,
      color: "#ef4444",
      active: open,
      full: false,
      radiusM: 150,
      updatedAt: report.createdAt,
      href: "/dashboard/compliance/reports",
    });
  }

  const withCoords = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const center = withCoords.length
    ? {
        lat: withCoords.reduce((s, p) => s + p.lat, 0) / withCoords.length,
        lng: withCoords.reduce((s, p) => s + p.lng, 0) / withCoords.length,
      }
    : { lat: 12.9716, lng: 77.5946 };

  return {
    generatedAt: new Date().toISOString(),
    center,
    counts: {
      pickups: withCoords.filter((p) => p.kind === "pickup").length,
      vehicles: withCoords.filter((p) => p.kind === "vehicle").length,
      users: withCoords.filter((p) => p.kind === "user").length,
      bins: withCoords.filter((p) => p.kind === "bin").length,
      alerts: withCoords.filter((p) => p.kind === "alert").length,
      fullBins: withCoords.filter((p) => p.kind === "bin" && p.full).length,
      activeVehicles: withCoords.filter((p) => p.kind === "vehicle" && p.active).length,
    },
    points: withCoords,
  };
}

// ---------------------------------------------------------------------------
// users/{uid}/sellRequests/{id} (collection group)
// ---------------------------------------------------------------------------

export type SellRequestRecord = {
  id: string;
  customerId: string;
  items: Array<{ category: string; quantityKg: number }>;
  totalWeightKg: number | null;
  totalAmount: number | null;
  status: string;
  createdAt: string | null;
};

export async function listSellRequests(limitCount = 200): Promise<SellRequestRecord[]> {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  const db = getAdminDb();

  async function run(q: Query) {
    const snap = await q.limit(limitCount).get();
    return snap.docs.map((doc) => {
      const data = doc.data() ?? {};
      const wasteType = String(data.wasteType ?? "");
      const quantityKg = typeof data.quantityKg === "number" ? data.quantityKg : null;
      const estimatedValue = typeof data.estimatedValue === "number" ? data.estimatedValue : null;
      const items = Array.isArray(data.items)
        ? data.items
        : wasteType && quantityKg != null
          ? [{ category: wasteType, quantityKg }]
          : [];
      const totalWeightKg =
        typeof data.totalWeightKg === "number"
          ? data.totalWeightKg
          : quantityKg != null
            ? quantityKg
            : items.reduce((sum, row) => sum + (row.quantityKg ?? 0), 0) || null;
      const totalAmount =
        typeof data.totalAmount === "number"
          ? data.totalAmount
          : estimatedValue != null
            ? estimatedValue
            : null;
      return {
        id: doc.id,
        customerId: doc.ref.parent.parent?.id ?? String(data.customerId ?? ""),
        items,
        totalWeightKg,
        totalAmount,
        status: String(data.status ?? "pending"),
        createdAt: toIso(data.createdAt),
      };
    });
  }

  try {
    return await run(db.collectionGroup("sellRequests").orderBy("createdAt", "desc"));
  } catch {
    return await run(db.collectionGroup("sellRequests"));
  }
}

/** Updates status on a users/{customerId}/sellRequests/{id} doc. */
export async function updateSellRequestStatus(customerId: string, requestId: string, status: string) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  if (!customerId || !requestId) throw new Error("customerId and requestId are required");
  if (!status.trim()) throw new Error("status is required");
  const db = getAdminDb();
  const ref = db.collection("users").doc(customerId).collection("sellRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Sell request not found");

  await ref.update({
    status: status.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: (await getCurrentAdminUid()) ?? "admin-console",
  });

  revalidatePath("/dashboard/sell-waste");
  return { ok: true, customerId, requestId, status };
}

// ---------------------------------------------------------------------------
// partners/{uid}/dailyRoutes/{id}
// ---------------------------------------------------------------------------

export async function createDailyRoute(
  partnerId: string,
  stopIds: string[],
  estimates?: { estimatedEarn?: number; estimatedKg?: number },
) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  if (!partnerId) throw new Error("partnerId is required");
  if (!stopIds?.length) throw new Error("stopIds must contain at least one stop");

  const db = getAdminDb();
  const partnerSnap = await db.collection("partners").doc(partnerId).get();
  if (!partnerSnap.exists) throw new Error("Partner not found");

  const ref = db.collection("partners").doc(partnerId).collection("dailyRoutes").doc();
  const payload = {
    partnerId,
    status: "offered" as const,
    stopIds,
    offeredAt: Date.now(),
    estimatedEarn: estimates?.estimatedEarn ?? null,
    estimatedKg: estimates?.estimatedKg ?? null,
  };
  await ref.set(payload);

  revalidatePath("/dashboard/routes");
  return { ok: true, id: ref.id, ...payload };
}

// ---------------------------------------------------------------------------
// partners/{uid}/payoutEntries/{id}
// ---------------------------------------------------------------------------

export type PayoutEntryRecord = {
  id: string;
  partnerId: string;
  jobId: string | null;
  amountKg: number | null;
  amount: number;
  date: string | null;
  settled: boolean;
};

export async function listPayoutEntries(limitCount = 200): Promise<PayoutEntryRecord[]> {
  await assertAdminRead("settlements:read");
  assertFirebaseReady();
  const db = getAdminDb();

  async function run(q: Query) {
    const snap = await q.limit(limitCount).get();
    return snap.docs.map((doc) => {
      const data = doc.data() ?? {};
      return {
        id: doc.id,
        partnerId: doc.ref.parent.parent?.id ?? "",
        jobId: data.jobId ?? null,
        amountKg: typeof data.amountKg === "number" ? data.amountKg : null,
        amount: typeof data.amount === "number" ? data.amount : 0,
        date: toIso(data.date),
        settled: Boolean(data.settled),
      };
    });
  }

  try {
    return await run(db.collectionGroup("payoutEntries").orderBy("date", "desc"));
  } catch {
    return await run(db.collectionGroup("payoutEntries"));
  }
}

export async function getSettlementsSummary() {
  await assertAdminRead("settlements:read");
  const entries = await listPayoutEntries(1000);
  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const settledAmount = entries.filter((e) => e.settled).reduce((sum, e) => sum + e.amount, 0);
  return {
    totalAmount,
    settledAmount,
    pendingAmount: totalAmount - settledAmount,
    entryCount: entries.length,
  };
}

/** Marks a single partner payout entry as settled (paid out). */
export async function markPayoutSettled(partnerId: string, entryId: string) {
  await requirePermission("settlements:write");
  assertFirebaseReady();
  if (!partnerId || !entryId) throw new Error("partnerId and entryId are required");
  const db = getAdminDb();
  const ref = db.collection("partners").doc(partnerId).collection("payoutEntries").doc(entryId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Payout entry not found");

  await ref.update({
    settled: true,
    settledAt: new Date().toISOString(),
    settledBy: (await getCurrentAdminUid()) ?? "admin-console",
  });

  revalidatePath("/dashboard/settlements");
  return { ok: true, partnerId, entryId };
}

// ---------------------------------------------------------------------------
// partners/{uid}/dailyRoutes/{id} — listing
// ---------------------------------------------------------------------------

export type DailyRouteRecord = {
  id: string;
  partnerId: string;
  status: string;
  stopIds: string[];
  estimatedEarn: number | null;
  estimatedKg: number | null;
  offeredAt: string | null;
};

export async function listDailyRoutes(limitCount = 100): Promise<DailyRouteRecord[]> {
  await assertAdminRead("ops:read");
  assertFirebaseReady();
  const db = getAdminDb();

  async function run(q: Query) {
    const snap = await q.limit(limitCount).get();
    return snap.docs.map((doc) => {
      const data = doc.data() ?? {};
      return {
        id: doc.id,
        partnerId: doc.ref.parent.parent?.id ?? String(data.partnerId ?? ""),
        status: String(data.status ?? "offered"),
        stopIds: Array.isArray(data.stopIds) ? data.stopIds.map(String) : [],
        estimatedEarn: typeof data.estimatedEarn === "number" ? data.estimatedEarn : null,
        estimatedKg: typeof data.estimatedKg === "number" ? data.estimatedKg : null,
        offeredAt: toIso(data.offeredAt),
      };
    });
  }

  try {
    return await run(db.collectionGroup("dailyRoutes").orderBy("offeredAt", "desc"));
  } catch {
    return await run(db.collectionGroup("dailyRoutes"));
  }
}

// ---------------------------------------------------------------------------
// Command Center aggregate stats
// ---------------------------------------------------------------------------

async function loadCommandCenterStats() {
  const db = getAdminDb();
  const [jobsSnap, partnersSnap, openOpsSnap] = await Promise.all([
    db.collection("jobs").orderBy("updatedAt", "desc").limit(500).get(),
    db.collection("partners").limit(300).get(),
    db.collection("opsReports").where("status", "==", "open").limit(200).get(),
  ]);

  const jobs = jobsSnap.docs.map(mapJobDoc);
  const partners = partnersSnap.docs.map(mapPartnerDoc);
  const todayKey = new Date().toDateString();
  const completedToday = jobs.filter(
    (job) => job.status === "completed" && job.updatedAt && new Date(job.updatedAt).toDateString() === todayKey,
  ).length;

  return {
    totalJobs: jobs.length,
    activeJobs: jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled").length,
    completedToday,
    totalPartners: partners.length,
    onlinePartners: partners.filter((p) => p.status === "online").length,
    openAlerts: openOpsSnap.size,
  };
}

const cachedCommandCenterStats = unstable_cache(loadCommandCenterStats, ["command-center-stats"], {
  revalidate: CACHE_TTL.ops,
  tags: [CACHE_TAGS.ops],
});

export async function getCommandCenterStats() {
  await assertAdminRead("ops:read");
  assertFirebaseReady();
  try {
    return await cachedCommandCenterStats();
  } catch {
    return loadCommandCenterStats();
  }
}

// ---------------------------------------------------------------------------
// Extra ops actions (job force status, suspend, orders, push, config, zones)
// ---------------------------------------------------------------------------

export async function forceJobStatus(jobId: string, status: string) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  const allowed = ["scheduled", "on_the_way", "arrived", "completed", "cancelled"];
  if (!allowed.includes(status)) throw new Error("Unsupported status");
  const db = getAdminDb();
  const jobRef = db.collection("jobs").doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new Error("Job not found");
  const job = snap.data()!;
  const nowIso = new Date().toISOString();
  await jobRef.update({ status, updatedAt: nowIso });
  if (job.userId && job.pickupId != null) {
    const pickupStatus =
      status === "on_the_way" || status === "arrived"
        ? "in_transit"
        : status === "completed"
          ? "completed"
          : status === "cancelled"
            ? "cancelled"
            : "scheduled";
    const pickupRef = db.collection("users").doc(String(job.userId)).collection("pickups").doc(String(job.pickupId));
    if ((await pickupRef.get()).exists) {
      await pickupRef.update({
        status: pickupStatus,
        ...(status === "cancelled" ? { cancelled: true } : {}),
        updatedAt: nowIso,
      });
    }
  }
  revalidatePath("/dashboard/pickups");
  revalidatePath("/dashboard/ops");
  revalidateTag(CACHE_TAGS.ops, "max");
  bustAnalyticsCache(revalidateTag);
  return { ok: true };
}

export async function voidBagCode(code: string) {
  await requirePermission("assets:write");
  assertFirebaseReady();
  const normalized = code.trim().toUpperCase();
  const db = getAdminDb();
  const ref = db.collection("bagsRegistry").doc(normalized);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Bag code not found");
  if (snap.data()?.usedBy) throw new Error("Cannot void a bag that is already activated");
  await ref.set(
    {
      voided: true,
      status: "voided",
      voidedAt: new Date().toISOString(),
      voidedBy: (await getCurrentAdminUid()) ?? "admin",
    },
    { merge: true },
  );
  revalidatePath("/dashboard/bags");
  return { ok: true };
}

export async function setPartnerStatus(uid: string, status: string) {
  await requirePermission("people:write");
  assertFirebaseReady();
  await getAdminDb().collection("partners").doc(uid).set({ status, statusUpdatedAt: new Date().toISOString() }, { merge: true });
  revalidatePath("/dashboard/partners");
  return { ok: true };
}

export async function updatePartnerProfile(
  uid: string,
  patch: { serviceArea?: string; vehicle?: string; truckCapacityKg?: number; role?: string },
) {
  await requirePermission("people:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("partners")
    .doc(uid)
    .set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  revalidatePath("/dashboard/partners");
  return { ok: true };
}

export async function setUserSuspended(uid: string, suspended: boolean, reason?: string) {
  await requirePermission("people:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        suspended,
        suspendedReason: reason || null,
        suspendedAt: suspended ? new Date().toISOString() : null,
      },
      { merge: true },
    );
  revalidatePath("/dashboard/users");
  return { ok: true };
}

export async function listUserActivity(uid: string, limitCount = 30) {
  await assertAdminRead("people:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const [pickupsSnap, ordersSnap] = await Promise.all([
    db.collection("users").doc(uid).collection("pickups").limit(limitCount).get(),
    db.collection("users").doc(uid).collection("orders").limit(limitCount).get(),
  ]);
  return {
    pickups: pickupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    orders: ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export type OrderRecord = {
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

export async function listOrders(limitCount = 100): Promise<OrderRecord[]> {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  const db = getAdminDb();
  let snap: QuerySnapshot;
  try {
    snap = await db.collectionGroup("orders").orderBy("createdAt", "desc").limit(limitCount).get();
  } catch {
    snap = await db.collectionGroup("orders").limit(limitCount).get();
  }
  const usersCache = new Map<string, string>();
  const rows: OrderRecord[] = [];
  for (const doc of snap.docs) {
    const userId = doc.ref.parent.parent?.id ?? "";
    let userName = usersCache.get(userId) ?? "";
    if (!userName && userId) {
      const u = await db.collection("users").doc(userId).get();
      userName = String(u.data()?.name || u.data()?.email || userId);
      usersCache.set(userId, userName);
    }
    const data = doc.data();
    rows.push({
      id: doc.id,
      userId,
      userName,
      total: String(data.total ?? `₹${data.totalValue ?? 0}`),
      totalValue: Number(data.totalValue ?? 0),
      status: String(data.status ?? "placed"),
      paymentMethod: String(data.paymentMethod ?? "—"),
      itemCount: Array.isArray(data.items) ? data.items.length : 0,
      createdAt: toIso(data.createdAt),
    });
  }
  return rows;
}

export async function advanceOrderStatus(userId: string, orderId: string, status: string) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  const allowed = ["placed", "packing", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status)) throw new Error("Bad status");
  await getAdminDb().collection("users").doc(userId).collection("orders").doc(String(orderId)).update({ status });
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

export async function sendPushNotification(input: {
  target: "all_users" | "all_partners" | "user" | "partner";
  uid?: string;
  title: string;
  body: string;
}) {
  await requirePermission("notifications:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const adminUid = (await getCurrentAdminUid()) ?? "admin";
  const now = Date.now();
  const payload = {
    title: input.title,
    body: input.body,
    createdAt: now,
    createdBy: adminUid,
    read: false,
  };

  const writeInbox = async (uid: string, audience: "user" | "partner") => {
    await db.collection("notifications").doc(uid).collection("items").add(payload);
    if (audience === "user") {
      const activityId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      await db.doc(`users/${uid}/activity/${activityId}`).set({
        id: activityId,
        title: input.title,
        subtitle: input.body,
        icon: "notifications-outline",
        createdAt: new Date().toISOString(),
      });
    } else {
      await db.collection("partners").doc(uid).collection("notifications").add({
        title: input.title,
        body: input.body,
        read: false,
        createdAt: new Date().toISOString(),
        createdBy: adminUid,
      });
    }
  };

  if (input.target === "user") {
    if (!input.uid) throw new Error("uid required");
    await writeInbox(input.uid, "user");
  } else if (input.target === "partner") {
    if (!input.uid) throw new Error("uid required");
    await writeInbox(input.uid, "partner");
  } else if (input.target === "all_partners") {
    const partners = await db.collection("partners").limit(200).get();
    await Promise.all(partners.docs.map((d) => writeInbox(d.id, "partner")));
  } else {
    const users = await db.collection("users").limit(200).get();
    await Promise.all(users.docs.map((d) => writeInbox(d.id, "user")));
  }

  await db.collection("adminAudit").add({
    type: "push",
    target: input.target,
    uid: input.uid ?? null,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
    createdBy: adminUid,
  });

  revalidatePath("/dashboard/notifications");
  return { ok: true };
}

export async function listPushNotificationsHistory(limitCount = 40) {
  await requirePermission("notifications:read");
  assertFirebaseReady();
  const db = getAdminDb();

  async function mapSnap(snap: QuerySnapshot) {
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        target: String(data.target ?? "—"),
        uid: data.uid ? String(data.uid) : null,
        title: String(data.title ?? ""),
        body: String(data.body ?? ""),
        createdAt: toIso(data.createdAt),
        createdBy: String(data.createdBy ?? "admin"),
      };
    });
  }

  try {
    const snap = await db
      .collection("adminAudit")
      .where("type", "==", "push")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();
    return mapSnap(snap);
  } catch {
    const snap = await db.collection("adminAudit").where("type", "==", "push").limit(limitCount).get();
    const rows = await mapSnap(snap);
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

export async function getAppConfig() {
  await assertAdminRead("config:write");
  assertFirebaseReady();
  const snap = await getAdminDb().collection("config").doc("app").get();
  const data = snap.data() ?? {};
  return {
    demoMode: Boolean(data.demoMode ?? false),
    marketplaceEnabled: data.marketplaceEnabled !== false,
    instantPayout: Boolean(data.instantPayout ?? false),
    classifierEnabled: data.classifierEnabled !== false,
    partnerMinVersion: String(data.partnerMinVersion ?? "1.0.0"),
    userMinVersion: String(data.userMinVersion ?? "1.0.0"),
    updateBanner: String(data.updateBanner ?? ""),
  };
}

export async function saveAppConfig(patch: Record<string, unknown>) {
  await requirePermission("config:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("config")
    .doc("app")
    .set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  revalidatePath("/dashboard/config");
  return { ok: true };
}

export type ZoneRecord = {
  id: string;
  name: string;
  slots: string;
  partners: number;
  surge: string;
  status: string;
};

export async function listZones(): Promise<ZoneRecord[]> {
  await assertAdminRead("ops:read");
  assertFirebaseReady();
  const snap = await getAdminDb().collection("zones").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? doc.id),
      slots: String(data.slots ?? ""),
      partners: Number(data.partners ?? 0),
      surge: String(data.surge ?? "Off"),
      status: String(data.status ?? "healthy"),
    };
  });
}

export async function upsertZone(input: {
  id?: string;
  name: string;
  slots: string;
  partners?: number;
  surge?: string;
  status?: string;
}) {
  await requirePermission("assets:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const id = input.id || input.name.toLowerCase().replace(/\s+/g, "-");
  await db
    .collection("zones")
    .doc(id)
    .set(
      {
        name: input.name,
        slots: input.slots,
        partners: Number(input.partners ?? 0),
        surge: input.surge ?? "Off",
        status: input.status ?? "healthy",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  revalidatePath("/dashboard/zones");
  return { ok: true, id };
}

export async function replyOpsReport(id: string, note: string) {
  await requirePermission("ops:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("opsReports")
    .doc(id)
    .set(
      {
        adminReply: note,
        adminRepliedAt: new Date().toISOString(),
        adminRepliedBy: (await getCurrentAdminUid()) ?? "admin",
        status: "acked",
      },
      { merge: true },
    );
  revalidatePath("/dashboard/support");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase-3 ops collections (admin-owned): MRF, AI, inventory, P2P, buyers
// ---------------------------------------------------------------------------

function mapSimpleDoc(doc: QueryDocumentSnapshot | DocumentSnapshot) {
  return { id: doc.id, ...(doc.data() ?? {}) } as Record<string, unknown> & { id: string };
}

export async function listMrfFacilities() {
  await assertAdminRead("mrf:read");
  assertFirebaseReady();
  const snap = await getAdminDb().collection("mrfFacilities").limit(100).get();
  return snap.docs.map(mapSimpleDoc);
}

export async function upsertMrfFacility(input: {
  id?: string;
  name: string;
  zone: string;
  capacity: string;
  status?: string;
}) {
  await requirePermission("mrf:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const id = input.id || input.name.toLowerCase().replace(/\s+/g, "-");
  await db
    .collection("mrfFacilities")
    .doc(id)
    .set(
      {
        name: input.name,
        zone: input.zone,
        capacity: input.capacity,
        inbound: "0 t",
        status: input.status ?? "running",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  revalidatePath("/dashboard/mrf");
  return { ok: true, id };
}

export async function listMrfInbound(limitCount = 100) {
  await assertAdminRead("mrf:read");
  assertFirebaseReady();
  try {
    const snap = await getAdminDb().collection("mrfInbound").orderBy("createdAt", "desc").limit(limitCount).get();
    return snap.docs.map(mapSimpleDoc);
  } catch {
    const snap = await getAdminDb().collection("mrfInbound").limit(limitCount).get();
    return snap.docs.map(mapSimpleDoc);
  }
}

export async function logMrfInbound(input: {
  facility: string;
  source: string;
  weight: string;
  bags: string;
  status?: string;
}) {
  await requirePermission("mrf:write");
  assertFirebaseReady();
  const ref = getAdminDb().collection("mrfInbound").doc();
  await ref.set({
    ...input,
    status: input.status ?? "received",
    createdAt: new Date().toISOString(),
    createdBy: (await getCurrentAdminUid()) ?? "admin",
  });
  revalidatePath("/dashboard/mrf");
  return { ok: true, id: ref.id };
}

export async function listAiJobs(limitCount = 100) {
  await assertAdminRead("mrf:read");
  assertFirebaseReady();
  try {
    const snap = await getAdminDb().collection("aiSegregationJobs").orderBy("createdAt", "desc").limit(limitCount).get();
    return snap.docs.map(mapSimpleDoc);
  } catch {
    const snap = await getAdminDb().collection("aiSegregationJobs").limit(limitCount).get();
    return snap.docs.map(mapSimpleDoc);
  }
}

export async function overrideAiJob(id: string, category: string, status = "accepted") {
  await requirePermission("mrf:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("aiSegregationJobs")
    .doc(id)
    .set(
      {
        ai: category,
        status,
        overriddenAt: new Date().toISOString(),
        overriddenBy: (await getCurrentAdminUid()) ?? "admin",
      },
      { merge: true },
    );
  revalidatePath("/dashboard/ai-segregation");
  return { ok: true };
}

export async function setAiModelVersion(model: string) {
  await requirePermission("mrf:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("config")
    .doc("ai")
    .set({ liveModel: model, updatedAt: new Date().toISOString() }, { merge: true });
  revalidatePath("/dashboard/ai-segregation");
  return { ok: true };
}

export async function getAiModelVersion() {
  await assertAdminRead("mrf:read");
  assertFirebaseReady();
  const doc = await getAdminDb().collection("config").doc("ai").get();
  return String(doc.data()?.liveModel ?? "v2.1");
}

/** Seed AI rows from recent completed jobs that have photos (when collection empty). */
export async function ensureAiJobsFromPickups() {
  await requirePermission("mrf:write");
  assertFirebaseReady();
  const db = getAdminDb();
  const existing = await db.collection("aiSegregationJobs").limit(1).get();
  if (!existing.empty) return { seeded: 0 };
  const jobs = await listJobs({ status: "completed", limit: 20 });
  let seeded = 0;
  for (const job of jobs) {
    if (!job.beforePhoto && !job.afterPhoto) continue;
    await db.collection("aiSegregationJobs").doc(`AI-${job.id.slice(0, 8)}`).set({
      source: job.id,
      ai: job.wasteType || "Unknown",
      confidence: "—",
      contam: "—",
      status: "needs override",
      createdAt: job.updatedAt ?? job.createdAt ?? new Date().toISOString(),
    });
    seeded += 1;
  }
  return { seeded };
}

export async function listMaterialLots(limitCount = 100) {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  const snap = await getAdminDb().collection("materialLots").limit(limitCount).get();
  return snap.docs.map(mapSimpleDoc);
}

export async function upsertMaterialLot(input: {
  id?: string;
  lot: string;
  stream: string;
  grade: string;
  qty: string;
  facility: string;
  status?: string;
}) {
  await requirePermission("mrf:write");
  assertFirebaseReady();
  const id = input.id || input.lot;
  await getAdminDb()
    .collection("materialLots")
    .doc(id)
    .set(
      {
        lot: input.lot,
        stream: input.stream,
        grade: input.grade,
        qty: input.qty,
        facility: input.facility,
        status: input.status ?? "ready to sell",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  revalidatePath("/dashboard/inventory");
  return { ok: true, id };
}

export async function listP2pListings(limitCount = 100) {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  try {
    const snap = await getAdminDb().collection("p2pListings").orderBy("createdAt", "desc").limit(limitCount).get();
    return snap.docs.map(mapSimpleDoc);
  } catch {
    const snap = await getAdminDb().collection("p2pListings").limit(limitCount).get();
    return snap.docs.map(mapSimpleDoc);
  }
}

export async function createP2pListing(input: {
  seller: string;
  material: string;
  qty: string;
  ask: string;
  status?: string;
}) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  const ref = getAdminDb().collection("p2pListings").doc();
  await ref.set({
    ...input,
    status: input.status ?? "open",
    createdAt: new Date().toISOString(),
    createdBy: (await getCurrentAdminUid()) ?? "admin",
  });
  revalidatePath("/dashboard/p2p");
  return { ok: true, id: ref.id };
}

export async function resolveP2pDispute(id: string, resolution: string, note?: string) {
  await requirePermission("commerce:write");
  assertFirebaseReady();
  await getAdminDb()
    .collection("p2pListings")
    .doc(id)
    .set(
      {
        status: resolution,
        disputeNote: note ?? "",
        resolvedAt: new Date().toISOString(),
        resolvedBy: (await getCurrentAdminUid()) ?? "admin",
      },
      { merge: true },
    );
  revalidatePath("/dashboard/p2p");
  return { ok: true };
}

export async function listBuyers(limitCount = 100) {
  await assertAdminRead("commerce:read");
  assertFirebaseReady();
  const snap = await getAdminDb().collection("buyers").limit(limitCount).get();
  return snap.docs.map(mapSimpleDoc);
}

export async function upsertBuyer(input: {
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
  await requirePermission("people:write");
  assertFirebaseReady();
  const id = input.id || input.name.toLowerCase().replace(/\s+/g, "-");
  await getAdminDb()
    .collection("buyers")
    .doc(id)
    .set(
      {
        name: input.name,
        type: input.type,
        streams: input.streams,
        volume: input.volume,
        kyc: input.kyc ?? "pending",
        status: input.status ?? "onboarding",
        contractVolume: input.contractVolume ?? null,
        contractPrice: input.contractPrice ?? null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  revalidatePath("/dashboard/buyers");
  return { ok: true, id };
}

export async function getImpactStats(range: AnalyticsRange = "30d"): Promise<ImpactStats> {
  await requirePermission("impact:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const [jobsSnap, bagsSnap, usersSnap] = await Promise.all([
    db.collection("jobs").where("status", "==", "completed").limit(500).get(),
    db.collection("bagsRegistry").limit(500).get(),
    db.collection("users").limit(500).get(),
  ]);

  const startIso = rangeStartIso(range);
  let weightKg = 0;
  const byStream: Record<string, number> = {};
  const diversionByDay = new Map<string, number>();
  for (const key of emptyDayKeys(range)) diversionByDay.set(key, 0);

  for (const doc of jobsSnap.docs) {
    const data = doc.data();
    const w = Number(data.weightKg ?? data.weight ?? 0) || 0;
    weightKg += w;
    const stream = String(data.wasteType ?? data.category ?? "Mixed");
    byStream[stream] = (byStream[stream] ?? 0) + w;
    const completedAt = toIso(data.updatedAt ?? data.createdAt);
    if (completedAt && completedAt >= startIso) {
      const key = completedAt.slice(0, 10);
      if (diversionByDay.has(key)) diversionByDay.set(key, (diversionByDay.get(key) ?? 0) + w);
    }
  }

  let divertedKg = 0;
  let carbonKg = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    divertedKg += Number(data.wasteDivertedKg ?? 0) || 0;
    carbonKg += Number(data.carbonCreditsKg ?? 0) || 0;
  }

  const bagsUsed = bagsSnap.docs.filter((d) => Boolean(d.data().usedBy)).length;
  const effectiveDivertedKg = divertedKg || weightKg;
  const divertedTons = effectiveDivertedKg / 1000;
  const mixedKg = Object.entries(byStream)
    .filter(([stream]) => stream.toLowerCase() === "mixed")
    .reduce((sum, [, kg]) => sum + kg, 0);
  const recoveryRateValue = weightKg > 0 ? Math.round(((weightKg - mixedKg) / weightKg) * 100) : 0;
  const streamRows = Object.entries(byStream)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([stream, kg]) => ({ stream, value: kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg` }));
  const streamSlices = Object.entries(byStream)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([stream, kg]) => ({ stream, kg: Math.round(kg), key: slugStream(stream) }));
  const diversionTrends: DiversionPoint[] = emptyDayKeys(range).map((date) => {
    const kg = diversionByDay.get(date) ?? 0;
    return { date, label: formatDayLabel(date), kg, co2eKg: Math.round(kg * 2.2) };
  });

  return {
    divertedTons: divertedTons.toFixed(1),
    recoveryRate: String(recoveryRateValue),
    carbonTons: (carbonKg / 1000 || divertedTons * 2.2).toFixed(1),
    bagsRecycled: String(bagsUsed),
    divertedKg: effectiveDivertedKg,
    recoveryRateValue,
    streamRows: streamRows.length ? streamRows : [{ stream: "No completed jobs yet", value: "0" }],
    streamSlices,
    diversionTrends,
  };
}

export type PassportStep = {
  step: string;
  detail: string;
  tone: "success" | "default" | "warning" | "muted" | "danger";
};

export async function lookupPassport(rawId: string): Promise<{
  id: string;
  title: string;
  timeline: PassportStep[];
} | null> {
  await requirePermission("passport:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const id = rawId.trim();
  if (!id) return null;

  const bag = await db.collection("bagsRegistry").doc(id).get();
  if (bag.exists) {
    const data = bag.data() ?? {};
    const timeline: PassportStep[] = [
      {
        step: "Bag issued",
        detail: data.issuedAt ? `Issued ${toIso(data.issuedAt)}` : "In registry",
        tone: "success",
      },
    ];
    if (data.voided) {
      timeline.push({ step: "Voided", detail: "Code voided by admin", tone: "danger" });
    } else if (data.usedBy) {
      timeline.push({
        step: "Bag activated",
        detail: `Linked to user ${data.usedBy}${data.usedAt ? ` · ${toIso(data.usedAt)}` : ""}`,
        tone: "success",
      });
    } else {
      timeline.push({ step: "Awaiting activation", detail: "Not yet scanned by a user", tone: "muted" });
    }

    const jobs = await db.collection("jobs").where("bagCode", "==", id).limit(5).get().catch(async () => {
      // bagCode field may not exist — try user pickups via usedBy
      return { empty: true, docs: [] as QueryDocumentSnapshot[] } as QuerySnapshot;
    });
    for (const doc of jobs.docs) {
      const j = mapJobDoc(doc);
      timeline.push({
        step: `Pickup ${j.status}`,
        detail: `${j.id} · ${j.wasteType || "waste"} · ${j.weightKg != null ? `${j.weightKg} kg` : "weight n/a"}`,
        tone: j.status === "completed" ? "success" : "default",
      });
    }

    const inbound = await db.collection("mrfInbound").where("bags", "==", id).limit(3).get().catch(() => null);
    for (const doc of inbound?.docs ?? []) {
      const d = doc.data();
      timeline.push({
        step: "MRF inbound",
        detail: `${d.facility ?? "MRF"} · ${d.weight ?? ""} · ${d.status ?? ""}`,
        tone: "success",
      });
    }

    const ai = await db.collection("aiSegregationJobs").where("source", "==", id).limit(3).get().catch(() => null);
    for (const doc of ai?.docs ?? []) {
      const d = doc.data();
      timeline.push({
        step: "AI segregation",
        detail: `${d.ai ?? "—"} · ${d.confidence ?? ""} · ${d.status ?? ""}`,
        tone: String(d.status).includes("contam") ? "danger" : "success",
      });
    }

    return { id, title: `Bag ${id}`, timeline };
  }

  const job = await db.collection("jobs").doc(id).get();
  if (job.exists) {
    const j = mapJobDoc(job);
    return {
      id: j.id,
      title: `Pickup ${j.id}`,
      timeline: [
        { step: "Created", detail: j.createdAt ?? "—", tone: "success" },
        { step: "Status", detail: j.status, tone: j.status === "completed" ? "success" : "warning" },
        {
          step: "Material",
          detail: `${j.wasteType || "—"} · ${j.weightKg != null ? `${j.weightKg} kg` : "no weight"} · ${j.location || "no location"}`,
          tone: "default",
        },
        {
          step: "Partner",
          detail: j.assignedPartnerId || "Unassigned",
          tone: j.assignedPartnerId ? "success" : "muted",
        },
      ],
    };
  }

  const listing = await db.collection("p2pListings").doc(id).get();
  if (listing.exists) {
    const d = listing.data() ?? {};
    return {
      id,
      title: `Listing ${id}`,
      timeline: [
        { step: "Listed", detail: `${d.seller} · ${d.material} · ${d.qty}`, tone: "success" },
        { step: "Ask", detail: String(d.ask ?? "—"), tone: "default" },
        { step: "Status", detail: String(d.status ?? "open"), tone: "warning" },
      ],
    };
  }

  return null;
}

export async function listAdminAudit(limitCount = 50) {
  await requirePermission("audit:read");
  assertFirebaseReady();
  try {
    const snap = await getAdminDb().collection("adminAudit").orderBy("createdAt", "desc").limit(limitCount).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: String(data.action ?? data.type ?? "action"),
        actor: String(data.performedBy ?? data.actor ?? data.adminUid ?? "—"),
        target: String(data.uid ?? data.target ?? data.userId ?? "—"),
        detail: String(data.reason ?? data.title ?? data.body ?? JSON.stringify(data).slice(0, 120)),
        createdAt: toIso(data.createdAt ?? data.at),
      };
    });
  } catch {
    const snap = await getAdminDb().collection("adminAudit").limit(limitCount).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: String(data.action ?? data.type ?? "action"),
        actor: String(data.performedBy ?? data.actor ?? data.adminUid ?? "—"),
        target: String(data.uid ?? data.target ?? data.userId ?? "—"),
        detail: String(data.reason ?? data.title ?? data.body ?? JSON.stringify(data).slice(0, 120)),
        createdAt: toIso(data.createdAt ?? data.at),
      };
    });
  }
}

const JOB_PIPELINE = ["scheduled", "on_the_way", "arrived", "completed"] as const;

function jobWeightKg(job: JobRecord): number {
  if (typeof job.weightKg === "number" && Number.isFinite(job.weightKg)) return job.weightKg;
  const parsed = Number(job.weight);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inRange(iso: string | null, startIso: string) {
  return Boolean(iso && iso >= startIso);
}

async function loadPayoutEntriesRaw(limitCount: number): Promise<PayoutEntryRecord[]> {
  const db = getAdminDb();

  async function run(q: Query) {
    const snap = await q.limit(limitCount).get();
    return snap.docs.map((doc) => {
      const data = doc.data() ?? {};
      return {
        id: doc.id,
        partnerId: doc.ref.parent.parent?.id ?? "",
        jobId: data.jobId ?? null,
        amountKg: typeof data.amountKg === "number" ? data.amountKg : null,
        amount: typeof data.amount === "number" ? data.amount : 0,
        date: toIso(data.date),
        settled: Boolean(data.settled),
      };
    });
  }

  try {
    return await run(db.collectionGroup("payoutEntries").orderBy("date", "desc"));
  } catch {
    return await run(db.collectionGroup("payoutEntries"));
  }
}

async function buildAnalyticsDashboard(range: AnalyticsRange): Promise<AnalyticsDashboard> {
  const db = getAdminDb();
  const startIso = rangeStartIso(range);
  const dayKeys = emptyDayKeys(range);

  const [jobsSnap, partnersSnap, reportsSnap, payouts] = await Promise.all([
    db.collection("jobs").orderBy("updatedAt", "desc").limit(800).get(),
    db.collection("partners").limit(300).get(),
    db.collection("opsReports").limit(400).get(),
    loadPayoutEntriesRaw(400).catch(() => []),
  ]);

  const jobs = jobsSnap.docs.map(mapJobDoc);
  const partners = partnersSnap.docs.map(mapPartnerDoc);
  const todayKey = new Date().toISOString().slice(0, 10);

  const completed = new Map(dayKeys.map((key) => [key, 0]));
  const active = new Map(dayKeys.map((key) => [key, 0]));
  const cancelled = new Map(dayKeys.map((key) => [key, 0]));
  const diverted = new Map(dayKeys.map((key) => [key, 0]));
  const alertsOpen = new Map(dayKeys.map((key) => [key, 0]));
  const alertsResolved = new Map(dayKeys.map((key) => [key, 0]));
  const settledByDay = new Map(dayKeys.map((key) => [key, 0]));
  const pendingByDay = new Map(dayKeys.map((key) => [key, 0]));
  const byStream: Record<string, number> = {};

  let completedJobs = 0;
  let activeJobs = 0;
  let cancelledJobs = 0;
  let completedToday = 0;
  let divertedKg = 0;

  for (const job of jobs) {
    const status = job.status.toLowerCase();
    const when = job.updatedAt ?? job.createdAt;
    const key = when?.slice(0, 10);
    const weight = jobWeightKg(job);
    if (status === "completed") {
      completedJobs += 1;
      divertedKg += weight;
      if (when?.startsWith(todayKey)) completedToday += 1;
      if (key && completed.has(key) && inRange(when, startIso)) {
        completed.set(key, (completed.get(key) ?? 0) + 1);
        diverted.set(key, (diverted.get(key) ?? 0) + weight);
      }
      const stream = job.wasteType || "Mixed";
      byStream[stream] = (byStream[stream] ?? 0) + weight;
    } else if (status === "cancelled") {
      cancelledJobs += 1;
      if (key && cancelled.has(key) && inRange(when, startIso)) {
        cancelled.set(key, (cancelled.get(key) ?? 0) + 1);
      }
    } else {
      activeJobs += 1;
      if (key && active.has(key) && inRange(when, startIso)) {
        active.set(key, (active.get(key) ?? 0) + 1);
      }
    }
  }

  for (const doc of reportsSnap.docs) {
    const data = doc.data();
    const created = toIso(data.createdAt ?? data.at);
    const key = created?.slice(0, 10);
    if (!key || !alertsOpen.has(key) || !inRange(created, startIso)) continue;
    const status = String(data.status ?? "open").toLowerCase();
    if (status === "open" || status === "urgent") alertsOpen.set(key, (alertsOpen.get(key) ?? 0) + 1);
    else alertsResolved.set(key, (alertsResolved.get(key) ?? 0) + 1);
  }

  for (const entry of payouts) {
    const key = entry.date?.slice(0, 10);
    if (!key || !settledByDay.has(key) || !inRange(entry.date, startIso)) continue;
    if (entry.settled) settledByDay.set(key, (settledByDay.get(key) ?? 0) + entry.amount);
    else pendingByDay.set(key, (pendingByDay.get(key) ?? 0) + entry.amount);
  }

  const mixedKg = Object.entries(byStream)
    .filter(([stream]) => stream.toLowerCase() === "mixed")
    .reduce((sum, [, kg]) => sum + kg, 0);
  const recoveryRate = divertedKg > 0 ? Math.round(((divertedKg - mixedKg) / divertedKg) * 100) : 0;
  const pendingSettlements = payouts.filter((e) => !e.settled).reduce((sum, e) => sum + e.amount, 0);
  const settledAmount = payouts.filter((e) => e.settled).reduce((sum, e) => sum + e.amount, 0);
  const partnerCounts: Record<string, number> = {};
  for (const partner of partners) {
    const status = partner.status || "offline";
    partnerCounts[status] = (partnerCounts[status] ?? 0) + 1;
  }

  return {
    overview: {
      range,
      totalJobs: jobs.length,
      completedJobs,
      activeJobs,
      cancelledJobs,
      completedToday,
      divertedKg,
      recoveryRate,
      openAlerts: reportsSnap.docs.filter((doc) => String(doc.data().status ?? "open").toLowerCase() === "open").length,
      partnersOnline: partners.filter((p) => p.status === "online").length,
      partnersTotal: partners.length,
      pendingSettlements,
      settledAmount,
    },
    jobTrends: dayKeys.map((date) => ({
      date,
      label: formatDayLabel(date),
      completed: completed.get(date) ?? 0,
      active: active.get(date) ?? 0,
      cancelled: cancelled.get(date) ?? 0,
    })),
    wasteStreams: Object.entries(byStream)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([stream, kg]) => ({ stream, kg: Math.round(kg), key: slugStream(stream) })),
    partnerUtilization: Object.entries(partnerCounts).map(([status, count]) => ({
      status,
      count,
      key: slugStream(status),
    })),
    alertTrends: dayKeys.map((date) => ({
      date,
      label: formatDayLabel(date),
      open: alertsOpen.get(date) ?? 0,
      resolved: alertsResolved.get(date) ?? 0,
    })),
    diversionTrends: dayKeys.map((date) => {
      const kg = diverted.get(date) ?? 0;
      return { date, label: formatDayLabel(date), kg, co2eKg: Math.round(kg * 2.2) };
    }),
    settlementTrends: dayKeys.map((date) => ({
      date,
      label: formatDayLabel(date),
      pending: pendingByDay.get(date) ?? 0,
      settled: settledByDay.get(date) ?? 0,
    })),
  };
}

export async function getAnalyticsDashboard(range: AnalyticsRange): Promise<AnalyticsDashboard> {
  await requirePermission("analytics:read");
  assertFirebaseReady();
  const cached = unstable_cache(() => buildAnalyticsDashboard(range), ["analytics-dashboard", range], {
    revalidate: CACHE_TTL.analytics,
    tags: [CACHE_TAGS.analyticsRoot, CACHE_TAGS.analytics(range)],
  });
  try {
    return await cached();
  } catch {
    return buildAnalyticsDashboard(range);
  }
}

export async function getJobTrends(range: AnalyticsRange) {
  return (await getAnalyticsDashboard(range)).jobTrends;
}

export async function getWasteStreamBreakdown(range: AnalyticsRange = "30d") {
  return (await getAnalyticsDashboard(range)).wasteStreams;
}

export async function getPartnerUtilization() {
  return (await getAnalyticsDashboard("30d")).partnerUtilization;
}

export async function getAlertTrends(range: AnalyticsRange) {
  return (await getAnalyticsDashboard(range)).alertTrends;
}

export async function getDiversionTrends(range: AnalyticsRange) {
  return (await getAnalyticsDashboard(range)).diversionTrends;
}

export async function getSettlementTrends(range: AnalyticsRange) {
  await requirePermission("settlements:read");
  return (await getAnalyticsDashboard(range)).settlementTrends;
}

function jobSteps(status: string): ComplianceJob["steps"] {
  const current = JOB_PIPELINE.indexOf(status as (typeof JOB_PIPELINE)[number]);
  const cancelled = status === "cancelled";
  return JOB_PIPELINE.map((step, index) => ({
    step,
    done: !cancelled && current >= 0 && index <= current,
  }));
}

function parseWeightKg(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").toLowerCase().trim();
  const num = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num)) return 0;
  if (raw.includes("t") && !raw.includes("kg")) return num * 1000;
  return num;
}

function jobWeightKgForCompliance(job: JobRecord): number {
  if (typeof job.weightKg === "number" && Number.isFinite(job.weightKg)) return job.weightKg;
  return parseWeightKg(job.weight);
}

function resolveJobArea(
  job: JobRecord,
  partnerZoneById: Map<string, string>,
  zoneNames: string[],
): string {
  if (job.assignedPartnerId) {
    const fromPartner = partnerZoneById.get(job.assignedPartnerId);
    if (fromPartner) return fromPartner;
  }
  const location = job.location.toLowerCase();
  for (const zone of zoneNames) {
    if (location.includes(zone.toLowerCase())) return zone;
  }
  return "Unmapped";
}

function mapAuditDoc(doc: QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    action: String(data.action ?? data.type ?? "action"),
    actor: String(data.performedBy ?? data.actor ?? data.adminUid ?? "—"),
    target: String(data.uid ?? data.target ?? data.userId ?? data.jobId ?? "—"),
    detail: String(data.reason ?? data.title ?? data.body ?? JSON.stringify(data).slice(0, 120)),
    createdAt: toIso(data.createdAt ?? data.at),
  };
}

export async function getComplianceDashboard(range: AnalyticsRange = "30d"): Promise<ComplianceDashboard> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const startIso = rangeStartIso(range);

  const [jobsSnap, partnersSnap, zonesSnap, mrfSnap, inboundSnap, auditSnap, usersSnap] = await Promise.all([
    db
      .collection("jobs")
      .orderBy("updatedAt", "desc")
      .limit(800)
      .get()
      .catch(() => db.collection("jobs").limit(800).get()),
    db.collection("partners").limit(300).get(),
    db.collection("zones").get(),
    db.collection("mrfFacilities").limit(100).get(),
    db
      .collection("mrfInbound")
      .orderBy("createdAt", "desc")
      .limit(400)
      .get()
      .catch(() => db.collection("mrfInbound").limit(400).get()),
    db
      .collection("adminAudit")
      .orderBy("createdAt", "desc")
      .limit(40)
      .get()
      .catch(() => db.collection("adminAudit").limit(40).get()),
    db.collection("users").limit(500).get(),
  ]);

  const jobs = jobsSnap.docs.map(mapJobDoc).filter((job) => {
    const when = job.updatedAt ?? job.createdAt;
    return !when || when >= startIso;
  });
  const partners = partnersSnap.docs.map(mapPartnerDoc);
  const partnerZoneById = new Map(
    partners.map((partner) => [partner.id, partner.serviceArea?.trim() || "Unmapped"]),
  );

  const zoneRows = zonesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? doc.id),
      partners: Number(data.partners ?? 0),
      householdTarget: Number(data.householdTarget ?? data.households ?? 0),
      status: String(data.status ?? "healthy"),
    };
  });

  const zoneNames = zoneRows.map((z) => z.name);
  const areaStats = new Map<
    string,
    {
      zoneId: string;
      householdTarget: number;
      partnersActive: Set<string>;
      jobsCompleted: number;
      collectedKg: number;
      recoveredKg: number;
      householdsServed: Set<string>;
    }
  >();

  for (const zone of zoneRows) {
    areaStats.set(zone.name, {
      zoneId: zone.id,
      householdTarget: zone.householdTarget > 0 ? zone.householdTarget : Math.max(zone.partners, 1) * 850,
      partnersActive: new Set(),
      jobsCompleted: 0,
      collectedKg: 0,
      recoveredKg: 0,
      householdsServed: new Set(),
    });
  }

  if (areaStats.size === 0) {
    for (const partner of partners) {
      const area = partner.serviceArea?.trim() || "City-wide";
      if (!areaStats.has(area)) {
        areaStats.set(area, {
          zoneId: area.toLowerCase().replace(/\s+/g, "-"),
          householdTarget: 8500,
          partnersActive: new Set(),
          jobsCompleted: 0,
          collectedKg: 0,
          recoveredKg: 0,
          householdsServed: new Set(),
        });
      }
    }
  }

  const counts = new Map<string, number>();
  let totalCollected = 0;
  let totalRecovered = 0;
  const servedHouseholds = new Set<string>();

  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
    const areaName = resolveJobArea(job, partnerZoneById, zoneNames);
    if (!areaStats.has(areaName)) {
      areaStats.set(areaName, {
        zoneId: areaName.toLowerCase().replace(/\s+/g, "-"),
        householdTarget: 5000,
        partnersActive: new Set(),
        jobsCompleted: 0,
        collectedKg: 0,
        recoveredKg: 0,
        householdsServed: new Set(),
      });
    }
    const bucket = areaStats.get(areaName)!;
    const weight = jobWeightKgForCompliance(job);
    const status = job.status.toLowerCase();
    const isCompleted = status === "completed";
    const isMixed = (job.wasteType || "").toLowerCase().includes("mixed");

    if (job.assignedPartnerId && partners.find((p) => p.id === job.assignedPartnerId)?.status === "online") {
      bucket.partnersActive.add(job.assignedPartnerId);
    }

    if (isCompleted) {
      bucket.jobsCompleted += 1;
      bucket.collectedKg += weight;
      const recovered = isMixed ? weight * 0.55 : weight * 0.82;
      bucket.recoveredKg += recovered;
      totalCollected += weight;
      totalRecovered += recovered;
      if (job.userId) {
        bucket.householdsServed.add(job.userId);
        servedHouseholds.add(job.userId);
      }
    }
  }

  for (const partner of partners) {
    const area = partner.serviceArea?.trim() || "Unmapped";
    if (!areaStats.has(area)) continue;
    if (partner.status === "online") {
      areaStats.get(area)!.partnersActive.add(partner.id);
    }
  }

  const areas: AreaOversightRow[] = [...areaStats.entries()]
    .map(([area, stats]) => {
      const collectedKg = Math.round(stats.collectedKg);
      const recoveredKg = Math.round(stats.recoveredKg);
      const householdsServed = stats.householdsServed.size;
      const householdTarget = stats.householdTarget;
      return {
        area,
        zoneId: stats.zoneId,
        householdTarget,
        householdsServed,
        coveragePct: householdTarget > 0 ? Math.round((householdsServed / householdTarget) * 100) : 0,
        partnersActive: stats.partnersActive.size,
        jobsCompleted: stats.jobsCompleted,
        collectedKg,
        recoveredKg,
        recoveryRate: collectedKg > 0 ? Math.round((recoveredKg / collectedKg) * 100) : 0,
      };
    })
    .sort((a, b) => b.collectedKg - a.collectedKg);

  const inboundByFacility = new Map<string, number>();
  for (const doc of inboundSnap.docs) {
    const data = doc.data();
    const facility = String(data.facility ?? data.mrf ?? "Unknown");
    const created = toIso(data.createdAt);
    if (created && created < startIso) continue;
    inboundByFacility.set(facility, (inboundByFacility.get(facility) ?? 0) + parseWeightKg(data.weight));
  }

  const mrfFacilities: MrfOversightRow[] = mrfSnap.docs.map((doc) => {
    const data = doc.data();
    const name = String(data.name ?? doc.id);
    const inboundKg = Math.round(inboundByFacility.get(name) ?? inboundByFacility.get(doc.id) ?? 0);
    const recoveryRate =
      typeof data.recoveryRate === "number"
        ? Math.round(data.recoveryRate)
        : inboundKg > 0
          ? 82
          : 0;
    const processedKg = Math.round(inboundKg * (recoveryRate / 100));
    const zone = String(data.zone ?? "—");
    const matchingAreas = areas.filter((a) => zone.toLowerCase().includes(a.area.toLowerCase()));
    const householdsServed = matchingAreas.reduce((sum, row) => sum + row.householdsServed, 0);
    return {
      id: doc.id,
      name,
      zone,
      capacity: String(data.capacity ?? "—"),
      status: String(data.status ?? "running"),
      inboundKg,
      processedKg,
      recoveryRate,
      householdsServed: householdsServed || Math.round(servedHouseholds.size / Math.max(mrfSnap.size, 1)),
    };
  });

  if (mrfFacilities.length === 0 && inboundByFacility.size > 0) {
    for (const [name, inboundKg] of inboundByFacility.entries()) {
      mrfFacilities.push({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        zone: "—",
        capacity: "—",
        status: "running",
        inboundKg: Math.round(inboundKg),
        processedKg: Math.round(inboundKg * 0.8),
        recoveryRate: 80,
        householdsServed: 0,
      });
    }
  }

  const householdTarget = areas.reduce((sum, row) => sum + row.householdTarget, 0);
  const householdsServed = servedHouseholds.size;
  const overview: GovernmentOverview = {
    range,
    householdsRegistered: usersSnap.size,
    householdsServed,
    coveragePct: householdTarget > 0 ? Math.round((householdsServed / householdTarget) * 100) : 0,
    collectedKg: Math.round(totalCollected),
    recoveredKg: Math.round(totalRecovered),
    landfillKg: Math.round(Math.max(0, totalCollected - totalRecovered)),
    recoveryRate: totalCollected > 0 ? Math.round((totalRecovered / totalCollected) * 100) : 0,
    activeZones: areas.filter((a) => a.jobsCompleted > 0).length,
    mrfCount: mrfFacilities.length,
    partnersActive: partners.filter((p) => p.status === "online").length,
    jobsCompleted: jobs.filter((j) => j.status.toLowerCase() === "completed").length,
  };

  return {
    range,
    overview,
    areas,
    mrfFacilities,
    statusCounts: [...counts.entries()].map(([status, count]) => ({ status, count })),
    recentJobs: jobs.slice(0, 20).map((job) => ({
      id: job.id,
      user: job.userId || "—",
      partner: job.assignedPartnerId ?? "Unassigned",
      wasteType: job.wasteType,
      status: job.status,
      weightKg: job.weightKg,
      location: job.location,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      steps: jobSteps(job.status),
    })),
    audit: auditSnap.docs.map(mapAuditDoc),
  };
}

// ---------------------------------------------------------------------------
// Government oversight portal
// ---------------------------------------------------------------------------

type UserLookup = { name: string; phone: string | null; area: string };

async function loadUserLookup(limitCount = 500): Promise<Map<string, UserLookup>> {
  const db = getAdminDb();
  const snap = await db.collection("users").limit(limitCount).get();
  const map = new Map<string, UserLookup>();
  for (const doc of snap.docs) {
    const data = doc.data() ?? {};
    map.set(doc.id, {
      name: String(data.name ?? data.displayName ?? "—"),
      phone: data.phone != null ? String(data.phone) : null,
      area: String(data.area ?? data.city ?? data.address?.area ?? "—"),
    });
  }
  return map;
}

async function loadPartnerNameMap(): Promise<Map<string, string>> {
  const db = getAdminDb();
  const snap = await db.collection("partners").limit(300).get();
  return new Map(
    snap.docs.map((doc) => {
      const data = doc.data() ?? {};
      return [doc.id, String(data.name ?? data.displayName ?? doc.id)];
    }),
  );
}

function mapGovJobRow(
  job: JobRecord,
  users: Map<string, UserLookup>,
  partners: Map<string, string>,
  partnerZoneById: Map<string, string>,
  zoneNames: string[],
): GovJobRow {
  const user = users.get(job.userId);
  const area = resolveJobArea(job, partnerZoneById, zoneNames);
  const weight =
    typeof job.weightKg === "number" && Number.isFinite(job.weightKg)
      ? job.weightKg
      : jobWeightKgForCompliance(job) || null;
  return {
    id: job.id,
    userId: job.userId,
    userName: user?.name ?? (job.userId.slice(0, 8) || "—"),
    userPhone: user?.phone ?? null,
    partnerName: job.assignedPartnerId ? (partners.get(job.assignedPartnerId) ?? job.assignedPartnerId) : "Unassigned",
    area,
    location: job.location || area,
    wasteType: job.wasteType,
    weightKg: weight,
    status: job.status,
    steps: jobSteps(job.status),
    updatedAt: job.updatedAt ?? job.createdAt,
    beforePhoto: job.beforePhoto,
    afterPhoto: job.afterPhoto,
  };
}

async function loadCitizenReportsRaw(limitCount = 300): Promise<CitizenReportRow[]> {
  const db = getAdminDb();
  const users = await loadUserLookup();
  let snap: QuerySnapshot;
  try {
    snap = await db.collectionGroup("reports").orderBy("createdAt", "desc").limit(limitCount).get();
  } catch {
    snap = await db.collectionGroup("reports").limit(limitCount).get();
  }

  return snap.docs.map((doc) => {
    const data = doc.data() ?? {};
    const userId = doc.ref.parent.parent?.id ?? "";
    const user = users.get(userId);
    return {
      id: doc.id,
      userId,
      userName: user?.name ?? (userId.slice(0, 8) || "—"),
      phone: user?.phone ?? null,
      issueType: String(data.issueType ?? data.type ?? "Report"),
      notes: String(data.notes ?? data.description ?? ""),
      status: normalizeCitizenStatus(data.status),
      area: String(data.area ?? user?.area ?? "—"),
      govNotes: data.govNotes != null ? String(data.govNotes) : null,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt ?? data.createdAt),
    };
  });
}

export async function listCitizenReports(filters?: {
  status?: string;
  issueType?: string;
  limit?: number;
}): Promise<CitizenReportRow[]> {
  await requirePermission("citizen_reports:read");
  assertFirebaseReady();
  let rows = await loadCitizenReportsRaw(filters?.limit ?? 300);
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters?.issueType) rows = rows.filter((r) => r.issueType === filters.issueType);
  return rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function updateCitizenReportStatus(
  userId: string,
  reportId: string,
  status: CitizenReportStatus,
  note?: string,
): Promise<{ ok: true }> {
  await requirePermission("citizen_reports:triage");
  assertFirebaseReady();
  if (!userId || !reportId) throw new Error("userId and reportId are required");

  const db = getAdminDb();
  const ref = db.collection("users").doc(userId).collection("reports").doc(reportId);
  const actor = (await getCurrentAdminUid()) ?? "admin-console";
  const nowIso = new Date().toISOString();

  await ref.set(
    {
      status,
      govNotes: note?.trim() || null,
      updatedAt: nowIso,
      triagedBy: actor,
      triagedAt: nowIso,
    },
    { merge: true },
  );

  await db.collection("adminAudit").add({
    action: `citizen_report.${status}`,
    performedBy: actor,
    target: reportId,
    userId,
    reason: note?.trim() || `Status → ${status}`,
    createdAt: nowIso,
  });

  revalidateTag(CACHE_TAGS.govDesk, "max");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard/compliance/reports");
  return { ok: true };
}

export async function getGovernmentCaseQueue(): Promise<GovCaseQueue> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const [reports, jobsSnap, opsSnap] = await Promise.all([
    loadCitizenReportsRaw(400),
    db.collection("jobs").limit(800).get(),
    db.collection("opsReports").limit(200).get(),
  ]);

  const jobs = jobsSnap.docs.map(mapJobDoc);
  return {
    citizenPending: reports.filter((r) => r.status === "submitted").length,
    citizenInProgress: reports.filter((r) => r.status === "in_progress").length,
    citizenEscalated: reports.filter((r) => r.status === "escalated").length,
    jobsActive: jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled").length,
    partnerAlertsOpen: opsSnap.docs.filter((doc) => {
      const s = String(doc.data().status ?? "open").toLowerCase();
      return s === "open" || s === "urgent";
    }).length,
  };
}

async function buildCommandDeskData(range: AnalyticsRange): Promise<CommandDeskData> {
  const dashboard = await getComplianceDashboard(range);
  const [reports, jobs] = await Promise.all([
    listCitizenReports({ limit: 20 }),
    listGovernmentJobs({ limit: 20 }),
  ]);
  const queue = await getGovernmentCaseQueue();
  return {
    range,
    queue,
    recentReports: reports.slice(0, 6),
    recentJobs: jobs.slice(0, 6),
    overview: {
      householdsServed: dashboard.overview.householdsServed,
      collectedKg: dashboard.overview.collectedKg,
      recoveredKg: dashboard.overview.recoveredKg,
      recoveryRate: dashboard.overview.recoveryRate,
    },
  };
}

export async function getCommandDeskData(range: AnalyticsRange = "30d"): Promise<CommandDeskData> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const cached = unstable_cache(() => buildCommandDeskData(range), ["gov-command-desk", range], {
    revalidate: CACHE_TTL.govDesk,
    tags: [CACHE_TAGS.govDesk],
  });
  try {
    return await cached();
  } catch {
    return buildCommandDeskData(range);
  }
}

export async function listGovernmentJobs(filters?: {
  status?: string;
  q?: string;
  limit?: number;
}): Promise<GovJobRow[]> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const [jobsSnap, partnersSnap, zonesSnap, users, partnerNames] = await Promise.all([
    db
      .collection("jobs")
      .orderBy("updatedAt", "desc")
      .limit(filters?.limit ?? 200)
      .get()
      .catch(() => db.collection("jobs").limit(filters?.limit ?? 200).get()),
    db.collection("partners").limit(300).get(),
    db.collection("zones").get(),
    loadUserLookup(),
    loadPartnerNameMap(),
  ]);

  const partners = partnersSnap.docs.map(mapPartnerDoc);
  const partnerZoneById = new Map(
    partners.map((partner) => [partner.id, partner.serviceArea?.trim() || "Unmapped"]),
  );
  const zoneNames = zonesSnap.docs.map((doc) => String(doc.data().name ?? doc.id));

  let rows = jobsSnap.docs
    .map(mapJobDoc)
    .map((job) => mapGovJobRow(job, users, partnerNames, partnerZoneById, zoneNames));

  if (filters?.status) rows = rows.filter((j) => j.status === filters.status);
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (j) =>
        j.id.toLowerCase().includes(q) ||
        j.userName.toLowerCase().includes(q) ||
        j.partnerName.toLowerCase().includes(q) ||
        j.area.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q),
    );
  }
  return rows;
}

export async function getGovernmentJobDetail(jobId: string): Promise<GovJobRow | null> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const doc = await db.collection("jobs").doc(jobId).get();
  if (!doc.exists) return null;

  const [partnersSnap, zonesSnap, users, partnerNames] = await Promise.all([
    db.collection("partners").limit(300).get(),
    db.collection("zones").get(),
    loadUserLookup(),
    loadPartnerNameMap(),
  ]);
  const partners = partnersSnap.docs.map(mapPartnerDoc);
  const partnerZoneById = new Map(
    partners.map((partner) => [partner.id, partner.serviceArea?.trim() || "Unmapped"]),
  );
  const zoneNames = zonesSnap.docs.map((z) => String(z.data().name ?? z.id));
  return mapGovJobRow(mapJobDoc(doc), users, partnerNames, partnerZoneById, zoneNames);
}

export async function listGovernmentHouseholds(filters?: { q?: string; limit?: number }): Promise<GovHouseholdRow[]> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const [usersSnap, jobs, reports] = await Promise.all([
    getAdminDb().collection("users").limit(filters?.limit ?? 300).get(),
    listGovernmentJobs({ limit: 800 }),
    listCitizenReports({ limit: 400 }),
  ]);

  const jobStats = new Map<string, { jobsCompleted: number; wasteDivertedKg: number; area: string }>();
  for (const job of jobs) {
    const existing = jobStats.get(job.userId) ?? { jobsCompleted: 0, wasteDivertedKg: 0, area: job.area };
    existing.wasteDivertedKg += job.weightKg ?? 0;
    if (job.status === "completed") existing.jobsCompleted += 1;
    if (existing.area === "—" || existing.area === "Unmapped") existing.area = job.area;
    jobStats.set(job.userId, existing);
  }

  let rows: GovHouseholdRow[] = usersSnap.docs.map((doc) => {
    const data = doc.data() ?? {};
    const stats = jobStats.get(doc.id);
    return {
      uid: doc.id,
      name: String(data.name ?? data.displayName ?? "—"),
      email: String(data.email ?? ""),
      phone: data.phone != null ? String(data.phone) : null,
      area: stats?.area ?? String(data.area ?? data.city ?? "—"),
      wasteDivertedKg: Math.round(stats?.wasteDivertedKg ?? 0),
      jobsCompleted: stats?.jobsCompleted ?? 0,
      openReports: reports.filter((r) => r.userId === doc.id && r.status !== "resolved").length,
    };
  });

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q) ||
        h.uid.toLowerCase().includes(q),
    );
  }
  return rows.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
}

export async function getGovernmentHouseholdProfile(uid: string): Promise<GovHouseholdProfile | null> {
  await requirePermission("compliance:read");
  assertFirebaseReady();
  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return null;

  const data = userDoc.data() ?? {};
  const walletSnap = await userDoc.ref.collection("wallet").doc("main").get();
  const wallet = walletSnap.data() ?? {};
  const [recentJobs, recentReports, households] = await Promise.all([
    listGovernmentJobs({ limit: 800 }),
    listCitizenReports({ limit: 400 }),
    listGovernmentHouseholds({ limit: 500 }),
  ]);
  const summary = households.find((h) => h.uid === uid);
  if (!summary) {
    return {
      uid,
      name: String(data.name ?? "—"),
      email: String(data.email ?? ""),
      phone: data.phone != null ? String(data.phone) : null,
      area: String(data.area ?? "—"),
      wasteDivertedKg: 0,
      jobsCompleted: 0,
      openReports: recentReports.filter((r) => r.userId === uid && r.status !== "resolved").length,
      points: typeof wallet.points === "number" ? wallet.points : 0,
      carbonCreditsKg: typeof wallet.carbonCreditsKg === "number" ? wallet.carbonCreditsKg : 0,
      recentJobs: recentJobs.filter((j) => j.userId === uid).slice(0, 10),
      recentReports: recentReports.filter((r) => r.userId === uid).slice(0, 10),
    };
  }
  return {
    ...summary,
    points: typeof wallet.points === "number" ? wallet.points : 0,
    carbonCreditsKg: typeof wallet.carbonCreditsKg === "number" ? wallet.carbonCreditsKg : 0,
    recentJobs: recentJobs.filter((j) => j.userId === uid).slice(0, 10),
    recentReports: recentReports.filter((r) => r.userId === uid).slice(0, 10),
  };
}

export async function listGovernmentAudit(limitCount = 200) {
  await requirePermission("audit:read");
  assertFirebaseReady();
  try {
    const snap = await getAdminDb()
      .collection("adminAudit")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();
    return snap.docs.map(mapAuditDoc);
  } catch {
    const snap = await getAdminDb().collection("adminAudit").limit(limitCount).get();
    return snap.docs.map(mapAuditDoc);
  }
}

export async function listAdmins() {
  await requirePermission("roles:manage");
  assertFirebaseReady();
  const auth = getAdminAuth();
  const db = getAdminDb();
  const [listed, docs] = await Promise.all([auth.listUsers(1000), db.collection("admins").get()]);
  const extras = new Map(docs.docs.map((doc) => [doc.id, doc.data()]));
  return listed.users
    .filter((user) => user.customClaims?.role === "admin")
    .map((user) => {
      const extra = extras.get(user.uid) ?? {};
      return {
        uid: user.uid,
        email: user.email ?? "",
        adminType: resolveAdminType(user.customClaims?.adminType ?? extra.adminType),
        status: String(extra.status ?? "active"),
        createdAt: toIso(extra.createdAt) ?? user.metadata.creationTime ?? null,
        createdBy: extra.createdBy ? String(extra.createdBy) : null,
      };
    });
}

async function writeAdminRecord(uid: string, email: string, adminType: AdminType, status: string) {
  const actor = (await getCurrentAdminUid()) ?? "admin-console";
  await getAdminDb()
    .collection("admins")
    .doc(uid)
    .set(
      {
        email,
        adminType,
        status,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: actor,
      },
      { merge: true },
    );
  await getAdminDb().collection("adminAudit").add({
    action: `admin.${status === "revoked" ? "revoked" : "updated"}`,
    performedBy: actor,
    target: uid,
    reason: `${email} → ${adminType} (${status})`,
    createdAt: new Date().toISOString(),
  });
}

export async function grantAdminAccess(email: string, adminType: AdminType) {
  await requirePermission("roles:manage");
  assertFirebaseReady();
  const auth = getAdminAuth();
  const user = await auth.getUserByEmail(email.trim());
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "admin", adminType });
  await writeAdminRecord(user.uid, user.email ?? email, adminType, "active");
  revalidatePath("/dashboard/roles");
  return { ok: true, uid: user.uid };
}

export async function createStaffAccount(input: {
  email: string;
  password: string;
  adminType: AdminType;
}) {
  await requirePermission("roles:manage");
  assertFirebaseReady();
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || input.password.length < 8) {
    throw new Error("Email and a password of at least 8 characters are required");
  }
  const auth = getAdminAuth();
  let uid: string;
  try {
    const created = await auth.createUser({
      email,
      password: input.password,
      emailVerified: false,
      disabled: false,
    });
    uid = created.uid;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code.includes("email-already-exists")) {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } else {
      throw error;
    }
  }
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...user.customClaims, role: "admin", adminType: input.adminType });
  await writeAdminRecord(uid, email, input.adminType, "active");
  revalidatePath("/dashboard/roles");
  return { ok: true, uid };
}

export async function setAdminType(uid: string, adminType: AdminType) {
  await requirePermission("roles:manage");
  assertFirebaseReady();
  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...user.customClaims, role: "admin", adminType });
  await writeAdminRecord(uid, user.email ?? "", adminType, "active");
  revalidatePath("/dashboard/roles");
  return { ok: true };
}

export async function revokeAdminAccess(uid: string) {
  await requirePermission("roles:manage");
  assertFirebaseReady();
  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  const nextClaims = { ...(user.customClaims ?? {}) };
  delete nextClaims.role;
  delete nextClaims.adminType;
  await auth.setCustomUserClaims(uid, nextClaims);
  await writeAdminRecord(uid, user.email ?? "", resolveAdminType(user.customClaims?.adminType), "revoked");
  revalidatePath("/dashboard/roles");
  return { ok: true };
}
