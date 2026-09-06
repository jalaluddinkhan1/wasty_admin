import { cookies } from "next/headers";

import { type AdminType, hasPermission, type Permission, resolveAdminType } from "@/lib/auth/permissions";
import { ADMIN_TYPE_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { getDataProvider } from "@/lib/firebase/config";
import { getSessionUser, type SessionUser } from "@/server/auth-actions";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function isAuthBypassed() {
  if (process.env.WASTY_AUTH_BYPASS === "1") return true;
  return getDataProvider() === "sqlite";
}

async function devSession(): Promise<SessionUser> {
  // Prefer the cookie set by switchDevRole, fall back to env var.
  let adminType: AdminType;
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(ADMIN_TYPE_COOKIE_NAME)?.value;
    adminType = resolveAdminType(cookieVal ?? process.env.WASTY_DEV_ADMIN_TYPE);
  } catch {
    adminType = resolveAdminType(process.env.WASTY_DEV_ADMIN_TYPE);
  }
  return {
    uid: "dev-admin",
    email: `${adminType}@wasty.dev`,
    role: "admin",
    adminType,
  };
}

export async function getEffectiveSession(): Promise<SessionUser | null> {
  if (isAuthBypassed()) {
    return devSession();
  }
  return getSessionUser();
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getEffectiveSession();
  if (user?.role !== "admin") {
    throw new ForbiddenError("Sign in with an admin account to continue.");
  }
  return {
    ...user,
    adminType: resolveAdminType(user.adminType),
  };
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireSession();
  if (!hasPermission(user.adminType, permission)) {
    throw new ForbiddenError(`This account cannot use ${permission}.`);
  }
  return user;
}

export async function requireAdminType(adminType: AdminType): Promise<SessionUser> {
  const user = await requireSession();
  if (user.adminType !== adminType && user.adminType !== "owner") {
    throw new ForbiddenError("This account cannot access that area.");
  }
  return user;
}
