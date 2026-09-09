import { type NextRequest, NextResponse } from "next/server";

import { canAccessPath, resolveAdminType } from "@/lib/auth/permissions";
import {
  ADMIN_TYPE_COOKIE_NAME,
  isLikelyFirebaseSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-cookie";
import { getDataProvider } from "@/lib/firebase/config";

const isProd = process.env.NODE_ENV === "production";

/**
 * Guards `/dashboard/*` for production providers (firebase + aws).
 * SQLite / AUTH_BYPASS only for local non-production demos.
 * Amplify Hosting SSR targets Next.js 15, which uses middleware (not proxy).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Never allow auth bypass in production.
  if (isProd && process.env.WASTY_AUTH_BYPASS === "1") {
    const loginUrl = new URL("/auth/v2/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    loginUrl.searchParams.set("error", "misconfigured");
    return NextResponse.redirect(loginUrl);
  }

  // Local demo bypass — development only.
  if (!isProd && process.env.WASTY_AUTH_BYPASS === "1") {
    return NextResponse.next();
  }

  const provider = getDataProvider();
  // Local sqlite-only demos skip the cookie gate; production never uses sqlite.
  if (!isProd && provider === "sqlite") {
    return NextResponse.next();
  }

  const sessionValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!isLikelyFirebaseSessionCookie(sessionValue)) {
    const loginUrl = new URL("/auth/v2/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const adminType = resolveAdminType(req.cookies.get(ADMIN_TYPE_COOKIE_NAME)?.value);
  if (!canAccessPath(pathname, adminType)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard/:path*",
};
