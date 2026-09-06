"use server";

/**
 * Session bridge between Firebase client Auth (browser) and the admin
 * console. The login form signs in with the Firebase Web SDK, then calls
 * `createSession` here with the resulting ID token. We verify it with the
 * Admin SDK, require the `admin` custom claim, and set an httpOnly cookie
 * that `src/proxy.ts` checks on every `/dashboard/*` request.
 */
import { cookies, headers } from "next/headers";

import { type AdminType, resolveAdminType } from "@/lib/auth/permissions";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  ADMIN_TYPE_COOKIE_NAME,
  ID_TOKEN_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-cookie";
import { getAdminAuth, isFirebaseAdminReady } from "@/lib/firebase/admin";

const SESSION_COOKIE = SESSION_COOKIE_NAME;

const DEFAULT_SESSION_MS = 1000 * 60 * 60 * 24 * 5; // 5 days
const REMEMBER_SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  uid: string;
  email: string | null;
  role: string | null;
  adminType: AdminType;
};

export async function createSession(idToken: string, remember = false) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";
  const limited = checkRateLimit(`login:${ip}`, 12, 60_000);
  if (!limited.ok) {
    throw new Error(`Too many login attempts. Try again in ${limited.retryAfterSec} seconds.`);
  }

  if (!isFirebaseAdminReady()) {
    throw new Error("Firebase Admin is not configured on the server. Set FIREBASE_ADMIN_SDK_PATH in .env.local.");
  }
  if (!idToken) throw new Error("Missing ID token");

  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken, true);

  if (decoded.role !== "admin") {
    throw new Error("This account does not have admin access. Ask an administrator to grant the admin role.");
  }

  const adminType = resolveAdminType(decoded.adminType);

  const expiresIn = remember ? REMEMBER_SESSION_MS : DEFAULT_SESSION_MS;
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(expiresIn / 1000),
  };
  cookieStore.set(SESSION_COOKIE, sessionCookie, cookieOptions);
  cookieStore.set(ADMIN_TYPE_COOKIE_NAME, adminType, cookieOptions);
  // Firebase ID tokens expire ~1h — used by AWS server actions as Bearer token.
  cookieStore.set(ID_TOKEN_COOKIE_NAME, idToken, {
    ...cookieOptions,
    maxAge: 55 * 60,
  });

  return { ok: true, uid: decoded.uid, email: decoded.email ?? null, adminType };
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ADMIN_TYPE_COOKIE_NAME);
  cookieStore.delete(ID_TOKEN_COOKIE_NAME);
  return { ok: true };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isFirebaseAdminReady()) return null;
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const role = typeof decoded.role === "string" ? decoded.role : null;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role,
      adminType: resolveAdminType(decoded.adminType),
    };
  } catch {
    return null;
  }
}
