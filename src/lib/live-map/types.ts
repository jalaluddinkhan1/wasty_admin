export type MapLayerId = "all" | "pickups" | "vehicles" | "users" | "bins" | "alerts";

export type MapStatusFilter = "all" | "active" | "inactive" | "full";

export type LiveMapPointKind = "pickup" | "vehicle" | "user" | "bin" | "alert";

export type LiveMapPoint = {
  id: string;
  kind: LiveMapPointKind;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  status: string;
  color: string;
  active: boolean;
  full: boolean;
  radiusM: number | null;
  updatedAt: string | null;
  href?: string | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readCoordPair(source: unknown): { lat: number; lng: number } | null {
  if (!source || typeof source !== "object") return null;
  const rec = source as Record<string, unknown> & { latitude?: unknown; longitude?: unknown };
  const lat = asFiniteNumber(rec.lat ?? rec.latitude ?? rec._latitude);
  const lng = asFiniteNumber(rec.lng ?? rec.longitude ?? rec._longitude ?? rec.lon);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function parseGeo(data: Record<string, unknown>): { lat: number; lng: number } | null {
  return (
    readCoordPair(data) ??
    readCoordPair(data.geo) ??
    readCoordPair(data.location) ??
    readCoordPair(data.coordinates) ??
    readCoordPair(data.position)
  );
}

/** Partner heartbeat writes `Date.now()`; Firestore may also store Timestamp or ISO. */
export function parseLastSeenMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber < 1e12 ? asNumber * 1000 : asNumber;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
}

export function matchesMapLayer(point: LiveMapPoint, layer: MapLayerId) {
  if (layer === "all") return true;
  if (layer === "pickups") return point.kind === "pickup";
  if (layer === "vehicles") return point.kind === "vehicle";
  if (layer === "users") return point.kind === "user";
  if (layer === "bins") return point.kind === "bin";
  return point.kind === "alert";
}

export function matchesMapStatus(point: LiveMapPoint, status: MapStatusFilter) {
  if (status === "all") return true;
  if (status === "full") return point.kind === "bin" && point.full;
  if (status === "active") return point.active && !point.full;
  return !point.active;
}

export type LiveMapSnapshot = {
  generatedAt: string;
  center: { lat: number; lng: number };
  counts: {
    pickups: number;
    vehicles: number;
    users: number;
    bins: number;
    alerts: number;
    fullBins: number;
    activeVehicles: number;
  };
  points: LiveMapPoint[];
};

export const MAP_LAYERS: { id: MapLayerId; label: string }[] = [
  { id: "all", label: "All layers" },
  { id: "pickups", label: "Pickup points" },
  { id: "vehicles", label: "Vehicles (live GPS)" },
  { id: "users", label: "Users & geotags" },
  { id: "bins", label: "Dustbins / fill" },
  { id: "alerts", label: "SOS & alerts" },
];

export function pickupColor(status: string) {
  const value = status.toLowerCase();
  if (value.includes("cancel")) return "#94a3b8";
  if (value.includes("complete")) return "#10b981";
  if (value.includes("way") || value.includes("arrived")) return "#f59e0b";
  return "#38bdf8";
}

export function vehicleColor(status: string, active: boolean) {
  if (!active) return "#94a3b8";
  const value = status.toLowerCase();
  if (value.includes("online") || value.includes("on_job") || value.includes("busy")) return "#2563eb";
  return "#64748b";
}

export function binColor(fillPercent: number, status: string) {
  const value = status.toLowerCase();
  if (value.includes("inactive") || value.includes("damaged") || value.includes("offline")) return "#94a3b8";
  if (value.includes("full") || fillPercent >= 85) return "#ef4444";
  if (fillPercent >= 60) return "#f59e0b";
  return "#10b981";
}

