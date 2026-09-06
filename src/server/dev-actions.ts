"use server";

import { cookies } from "next/headers";

import { type AdminType, ADMIN_TYPES, defaultLandingFor, resolveAdminType } from "@/lib/auth/permissions";
import { ADMIN_TYPE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

/**
 * Dev-only: set a fake session cookie so the dashboard treats the browser
 * as the given admin role without a real Firebase login.
 * Throws in production when WASTY_AUTH_BYPASS is not set.
 */
export async function switchDevRole(adminType: AdminType) {
  if (process.env.NODE_ENV === "production" && process.env.WASTY_AUTH_BYPASS !== "1") {
    throw new Error("Demo role switching is disabled in production.");
  }

  if (!ADMIN_TYPES.includes(adminType)) {
    throw new Error(`Unknown admin type: ${adminType}`);
  }

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  };

  // Write a placeholder session cookie + the admin-type cookie.
  // The proxy/require-admin checks WASTY_AUTH_BYPASS first, so the
  // session cookie value doesn't need to be a real Firebase token.
  cookieStore.set(SESSION_COOKIE_NAME, `dev:${adminType}`, cookieOptions);
  cookieStore.set(ADMIN_TYPE_COOKIE_NAME, adminType, cookieOptions);

  return { ok: true, adminType, landing: defaultLandingFor(adminType) };
}
