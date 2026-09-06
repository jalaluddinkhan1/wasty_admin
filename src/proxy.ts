import { type NextRequest, NextResponse } from "next/server";

import { canAccessPath, resolveAdminType } from "@/lib/auth/permissions";
import { ADMIN_TYPE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { getDataProvider } from "@/lib/firebase/config";

/**
 * Guards `/dashboard/*` for production providers (firebase + aws).
 * SQLite stays open only for local demo without auth setup.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Local demo bypass — never enable in production.
  if (process.env.WASTY_AUTH_BYPASS === "1") {
    return NextResponse.next();
  }

  const provider = getDataProvider();
  // Local sqlite-only demos skip the cookie gate; firebase/aws require a session.
  if (provider === "sqlite") {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSession) {
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
