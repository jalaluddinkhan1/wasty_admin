import "server-only";

import { getServerBearerToken } from "@/lib/api/auth-token";

const BASE = (process.env.WASTY_API_BASE_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!BASE) throw new ApiError(503, "config", "WASTY_API_BASE_URL is not set");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers.Authorization = `Bearer ${await getServerBearerToken()}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || "error", data.message || res.statusText);
  }
  return data as T;
}

export const api = {
  health: () => apiRequest<{ ok: boolean }>("GET", "/health"),
  snapshot: () =>
    apiRequest<{ jobs: unknown[]; partners: unknown[]; alerts: unknown[]; bins: unknown[] }>(
      "GET",
      "/v1/admin/snapshot",
    ),
  coverage: () => apiRequest<Record<string, number | string>>("GET", "/v1/admin/coverage"),
  audit: () => apiRequest<{ events: unknown[] }>("GET", "/v1/admin/audit"),
  grantRole: (body: { uid: string; adminType: string; email?: string }) =>
    apiRequest("POST", "/v1/admin/roles/grant", body),

  listJobs: () => apiRequest<{ jobs: unknown[] }>("GET", "/v1/jobs"),
  assignJob: (jobId: string, partnerId: string) =>
    apiRequest("POST", `/v1/jobs/${jobId}/assign`, { partnerId }),
  patchJob: (jobId: string, body: Record<string, unknown>) =>
    apiRequest("PATCH", `/v1/jobs/${jobId}`, body),

  listPartners: () => apiRequest<{ partners: unknown[] }>("GET", "/v1/partners"),
  patchPartner: (uid: string, body: Record<string, unknown>) =>
    apiRequest("PATCH", `/v1/partners/${uid}`, body),
  listUsers: () => apiRequest<{ users: unknown[] }>("GET", "/v1/users"),
  patchUser: (uid: string, body: Record<string, unknown>) =>
    apiRequest("PATCH", `/v1/users/${uid}`, body),

  listOps: (status = "open") => apiRequest<{ ops: unknown[] }>("GET", `/v1/ops?status=${status}`),
  patchOps: (id: string, body: { status?: string; note?: string }) =>
    apiRequest("PATCH", `/v1/ops/${id}`, body),

  listBags: () => apiRequest<{ bags: unknown[] }>("GET", "/v1/bags"),
  generateBagBatch: (body: Record<string, unknown>) => apiRequest("POST", "/v1/bags/batch", body),
  voidBag: (code: string, reason?: string) => apiRequest("POST", "/v1/bags/void", { code, reason }),

  listRewards: () => apiRequest<{ rewards: unknown[] }>("GET", "/v1/rewards"),
  listProducts: () => apiRequest<{ products: unknown[] }>("GET", "/v1/products"),
  upsertProduct: (body: Record<string, unknown>) => apiRequest("POST", "/v1/products", body),
  deleteProduct: (id: string) => apiRequest("DELETE", `/v1/products/${id}`),
  listOrders: () => apiRequest<{ orders: unknown[] }>("GET", "/v1/orders"),
  getConfig: (key: string) => apiRequest<{ config: unknown }>("GET", `/v1/config/${key}`),
  putConfig: (key: string, body: Record<string, unknown>) =>
    apiRequest("PUT", `/v1/config/${key}`, body),
  listBins: () => apiRequest<{ bins: unknown[] }>("GET", "/v1/bins"),
  upsertBin: (body: Record<string, unknown>) => apiRequest("POST", "/v1/bins", body),
  listZones: () => apiRequest<{ zones: unknown[] }>("GET", "/v1/zones"),
  upsertZone: (body: Record<string, unknown>) => apiRequest("POST", "/v1/zones", body),
  listMrf: () => apiRequest<{ mrf: unknown[] }>("GET", "/v1/mrf"),
  upsertMrf: (body: Record<string, unknown>) => apiRequest("POST", "/v1/mrf", body),
  listP2p: () => apiRequest<{ listings: unknown[] }>("GET", "/v1/p2p"),

  listPayouts: (status = "requested") =>
    apiRequest<{ requests: unknown[] }>("GET", `/v1/admin/payouts?status=${status}`),
  settlePayout: (id: string, body?: { note?: string; paidVia?: string }) =>
    apiRequest("POST", "/v1/admin/payouts/settle", { id, ...body }),

  listRoutes: () => apiRequest<{ routes: unknown[] }>("GET", "/v1/admin/routes"),
  offerRoute: (body: { partnerId: string; stopIds: string[]; date?: string; note?: string }) =>
    apiRequest("POST", "/v1/admin/routes", body),

  listInventory: () => apiRequest<{ lots: unknown[] }>("GET", "/v1/admin/inventory"),
  upsertInventory: (body: Record<string, unknown>) => apiRequest("POST", "/v1/admin/inventory", body),

  listSell: () => apiRequest<{ requests: unknown[] }>("GET", "/v1/sell-requests"),
  patchSellRequest: (customerId: string, requestId: string, body: { status?: string; totalWeightKg?: number; ratePerKg?: number }) =>
    apiRequest("PATCH", `/v1/sell-requests/${customerId}/${requestId}`, body),
  listReports: () => apiRequest<{ reports: unknown[] }>("GET", "/v1/reports"),
  updateOrderStatus: (orderId: string, body: { userId: string; status: string }) =>
    apiRequest("POST", `/v1/orders/${orderId}/status`, body),
  presignUpload: (filename: string, contentType: string) =>
    apiRequest<{ url: string; key: string }>("POST", "/v1/uploads/presign", { filename, contentType }),

  syncSince: (since = 0) =>
    apiRequest<{ events: { type: string; payload: unknown; ts: number }[]; cursor: string }>(
      "GET",
      `/v1/sync/since?since=${since}`,
    ),
};
