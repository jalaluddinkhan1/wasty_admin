export const ADMIN_TYPES = [
  "owner",
  "government",
  "ops_manager",
  "support",
  "finance",
  "warehouse",
] as const;

export type AdminType = (typeof ADMIN_TYPES)[number];

export const PERMISSIONS = [
  "analytics:read",
  "impact:read",
  "compliance:read",
  "citizen_reports:read",
  "citizen_reports:triage",
  "audit:read",
  "passport:read",
  "ops:read",
  "ops:write",
  "people:read",
  "people:write",
  "assets:read",
  "assets:write",
  "mrf:read",
  "mrf:write",
  "commerce:read",
  "commerce:write",
  "settlements:read",
  "settlements:write",
  "notifications:read",
  "notifications:write",
  "config:write",
  "roles:manage",
  "map:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ADMIN_TYPE_LABELS: Record<AdminType, string> = {
  owner: "Company Owner",
  government: "Government Official",
  ops_manager: "Operations Manager",
  support: "Support Analyst",
  finance: "Finance",
  warehouse: "Warehouse",
};

export const ADMIN_TYPE_DESCRIPTIONS: Record<AdminType, string> = {
  owner: "Full visibility and control across operations, commerce, settlements, and platform settings.",
  government: "City oversight — citizen reports, jobs, households, zones, MRF. Triage complaints; read-only elsewhere.",
  ops_manager: "Jobs, routes, partners, assets, and MRF. Settlements read-only.",
  support: "Tickets, users, notifications, and high-level analytics. No commercial or config writes.",
  finance: "Settlements, orders, subscriptions, invoices. Jobs read.",
  warehouse: "Bags QR print, bins, dump/MRF, inventory. No payout settle.",
};

const ALL_PERMISSIONS = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<AdminType, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  government: [
    "compliance:read",
    "citizen_reports:read",
    "citizen_reports:triage",
    "audit:read",
    "passport:read",
    "map:read",
    "analytics:read",
    "impact:read",
  ],
  ops_manager: [
    "analytics:read",
    "impact:read",
    "ops:read",
    "ops:write",
    "people:read",
    "people:write",
    "assets:read",
    "assets:write",
    "mrf:read",
    "mrf:write",
    "notifications:read",
    "notifications:write",
    "passport:read",
    "map:read",
    "settlements:read",
  ],
  support: ["analytics:read", "ops:read", "ops:write", "people:read", "notifications:read", "notifications:write"],
  finance: [
    "settlements:read",
    "settlements:write",
    "commerce:read",
    "commerce:write",
    "ops:read",
    "people:read",
    "analytics:read",
  ],
  warehouse: ["assets:read", "assets:write", "mrf:read", "mrf:write", "ops:read", "map:read"],
};

export const DEFAULT_LANDING: Record<AdminType, string> = {
  owner: "/dashboard/analytics",
  government: "/dashboard/compliance",
  ops_manager: "/dashboard/ops",
  support: "/dashboard/support",
  finance: "/dashboard/settlements",
  warehouse: "/dashboard/bags",
};

export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/dashboard/analytics", permission: "analytics:read" },
  { prefix: "/dashboard/impact", permission: "impact:read" },
  { prefix: "/dashboard/compliance/reports", permission: "citizen_reports:read" },
  { prefix: "/dashboard/compliance", permission: "compliance:read" },
  { prefix: "/dashboard/passport", permission: "passport:read" },
  { prefix: "/dashboard/live-map", permission: "map:read" },
  { prefix: "/dashboard/ops", permission: "ops:read" },
  { prefix: "/dashboard/pickups", permission: "ops:read" },
  { prefix: "/dashboard/routes", permission: "ops:read" },
  { prefix: "/dashboard/support", permission: "ops:read" },
  { prefix: "/dashboard/notifications", permission: "notifications:read" },
  { prefix: "/dashboard/users", permission: "people:read" },
  { prefix: "/dashboard/partners", permission: "people:read" },
  { prefix: "/dashboard/buyers", permission: "people:read" },
  { prefix: "/dashboard/roles", permission: "roles:manage" },
  { prefix: "/dashboard/bags", permission: "assets:read" },
  { prefix: "/dashboard/bins", permission: "assets:read" },
  { prefix: "/dashboard/zones", permission: "assets:read" },
  { prefix: "/dashboard/mrf", permission: "mrf:read" },
  { prefix: "/dashboard/ai-segregation", permission: "mrf:read" },
  { prefix: "/dashboard/inventory", permission: "mrf:read" },
  { prefix: "/dashboard/p2p", permission: "commerce:read" },
  { prefix: "/dashboard/sell-waste", permission: "commerce:read" },
  { prefix: "/dashboard/marketplace", permission: "commerce:read" },
  { prefix: "/dashboard/orders", permission: "commerce:read" },
  { prefix: "/dashboard/rewards", permission: "commerce:read" },
  { prefix: "/dashboard/settlements", permission: "settlements:read" },
  { prefix: "/dashboard/config", permission: "config:write" },
];

export function isAdminType(value: unknown): value is AdminType {
  return typeof value === "string" && (ADMIN_TYPES as readonly string[]).includes(value);
}

export function parseAdminType(value: unknown): AdminType | null {
  return isAdminType(value) ? value : null;
}

/** Legacy admins with `role: "admin"` but no `adminType` default to company owner. */
export function resolveAdminType(value: unknown): AdminType {
  return parseAdminType(value) ?? "owner";
}

export function permissionsFor(adminType: AdminType): readonly Permission[] {
  return ROLE_PERMISSIONS[adminType];
}

export function hasPermission(adminType: AdminType, permission: Permission): boolean {
  return ROLE_PERMISSIONS[adminType].includes(permission);
}

export function canAccessPath(pathname: string, adminType: AdminType): boolean {
  const match = ROUTE_PERMISSIONS.filter(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  if (match) {
    return hasPermission(adminType, match.permission);
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return false;
  }

  return true;
}

export function defaultLandingFor(adminType: AdminType): string {
  return DEFAULT_LANDING[adminType];
}
