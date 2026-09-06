import type { LiveMapSnapshot } from "./types";
import { binColor, pickupColor, vehicleColor } from "./types";

const BLR = { lat: 12.9716, lng: 77.5946 };

function offset(lat: number, lng: number, dLat: number, dLng: number) {
  return { lat: lat + dLat, lng: lng + dLng };
}

export function demoLiveMapSnapshot(): LiveMapSnapshot {
  const now = new Date().toISOString();
  const pickups = [
    { id: "JOB-1", title: "Aisha Khan", status: "scheduled", pos: offset(BLR.lat, BLR.lng, 0.012, 0.01) },
    { id: "JOB-2", title: "Green Cafe", status: "on_the_way", pos: offset(BLR.lat, BLR.lng, -0.008, 0.018) },
    { id: "JOB-3", title: "Nikhil Rao", status: "arrived", pos: offset(BLR.lat, BLR.lng, 0.02, -0.012) },
    { id: "JOB-4", title: "Priya Shah", status: "completed", pos: offset(BLR.lat, BLR.lng, -0.016, -0.008) },
  ];
  const vehicles = [
    { id: "P-1", title: "Ravi Kumar", status: "online", active: true, pos: offset(BLR.lat, BLR.lng, 0.006, 0.004) },
    { id: "P-2", title: "Meera Joshi", status: "on_job", active: true, pos: offset(BLR.lat, BLR.lng, -0.004, 0.014) },
    { id: "P-3", title: "Anil Das", status: "offline", active: false, pos: offset(BLR.lat, BLR.lng, 0.018, 0.02) },
  ];
  const users = [
    { id: "U-1", title: "Aisha Khan", pos: offset(BLR.lat, BLR.lng, 0.012, 0.01) },
    { id: "U-2", title: "Green Cafe", pos: offset(BLR.lat, BLR.lng, -0.008, 0.018) },
    { id: "U-3", title: "Society gate", pos: offset(BLR.lat, BLR.lng, 0.004, -0.016) },
  ];
  const bins = [
    { id: "BIN-1", title: "Indiranagar 100ft", fill: 32, status: "ok", pos: offset(BLR.lat, BLR.lng, 0.01, -0.004) },
    { id: "BIN-2", title: "Koramangala 5th", fill: 72, status: "ok", pos: offset(BLR.lat, BLR.lng, -0.012, 0.006) },
    { id: "BIN-3", title: "HSR Sector 2", fill: 94, status: "full", pos: offset(BLR.lat, BLR.lng, 0.002, 0.022) },
    { id: "BIN-4", title: "Jayanagar 4th", fill: 18, status: "damaged", pos: offset(BLR.lat, BLR.lng, -0.02, -0.014) },
  ];
  const alerts = [
    { id: "SOS-1", title: "Partner SOS", pos: offset(BLR.lat, BLR.lng, -0.003, 0.009) },
  ];

  const points = [
    ...pickups.map((row) => ({
      id: row.id,
      kind: "pickup" as const,
      title: row.title,
      subtitle: `Pickup · ${row.status.replaceAll("_", " ")}`,
      lat: row.pos.lat,
      lng: row.pos.lng,
      status: row.status,
      color: pickupColor(row.status),
      active: row.status !== "completed" && row.status !== "cancelled",
      full: false,
      radiusM: 80,
      updatedAt: now,
      href: "/dashboard/compliance/jobs",
    })),
    ...vehicles.map((row) => ({
      id: row.id,
      kind: "vehicle" as const,
      title: row.title,
      subtitle: `Vehicle · ${row.status.replaceAll("_", " ")}`,
      lat: row.pos.lat,
      lng: row.pos.lng,
      status: row.status,
      color: vehicleColor(row.status, row.active),
      active: row.active,
      full: false,
      radiusM: 120,
      updatedAt: now,
      href: "/dashboard/partners",
    })),
    ...users.map((row) => ({
      id: row.id,
      kind: "user" as const,
      title: row.title,
      subtitle: "Household geotag · 300m radius",
      lat: row.pos.lat,
      lng: row.pos.lng,
      status: "active",
      color: "#8b5cf6",
      active: true,
      full: false,
      radiusM: 300,
      updatedAt: now,
      href: "/dashboard/compliance/households",
    })),
    ...bins.map((row) => ({
      id: row.id,
      kind: "bin" as const,
      title: row.title,
      subtitle: `Dustbin · ${row.fill}% · ${row.status}`,
      lat: row.pos.lat,
      lng: row.pos.lng,
      status: row.status,
      color: binColor(row.fill, row.status),
      active: row.status !== "damaged",
      full: row.fill >= 85 || row.status === "full",
      radiusM: 60,
      updatedAt: now,
      href: "/dashboard/bins",
    })),
    ...alerts.map((row) => ({
      id: row.id,
      kind: "alert" as const,
      title: row.title,
      subtitle: "Open SOS pin",
      lat: row.pos.lat,
      lng: row.pos.lng,
      status: "open",
      color: "#ef4444",
      active: true,
      full: false,
      radiusM: 150,
      updatedAt: now,
      href: "/dashboard/compliance/reports",
    })),
  ];

  return {
    generatedAt: now,
    center: BLR,
    counts: {
      pickups: pickups.length,
      vehicles: vehicles.length,
      users: users.length,
      bins: bins.length,
      alerts: alerts.length,
      fullBins: bins.filter((b) => b.fill >= 85).length,
      activeVehicles: vehicles.filter((v) => v.active).length,
    },
    points,
  };
}
