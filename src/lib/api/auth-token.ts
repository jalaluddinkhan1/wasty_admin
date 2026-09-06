import { cookies } from "next/headers";

import { resolveAdminType } from "@/lib/auth/permissions";
import { ADMIN_TYPE_COOKIE_NAME, ID_TOKEN_COOKIE_NAME } from "@/lib/auth/session-cookie";

/** Bearer token for AWS API Gateway (server-side). */
export async function getServerBearerToken(): Promise<string> {
  if (process.env.WASTY_AUTH_BYPASS === "1") {
    let adminType = resolveAdminType(process.env.WASTY_DEV_ADMIN_TYPE);
    try {
      const cookieStore = await cookies();
      adminType = resolveAdminType(
        cookieStore.get(ADMIN_TYPE_COOKIE_NAME)?.value ?? process.env.WASTY_DEV_ADMIN_TYPE,
      );
    } catch {
      /* build / static */
    }
    return `dev:local-dev-admin:admin:${adminType}`;
  }

  try {
    const cookieStore = await cookies();
    const idToken = cookieStore.get(ID_TOKEN_COOKIE_NAME)?.value;
    if (idToken) return idToken;
  } catch {
    /* outside request */
  }

  throw new Error("Sign in required — no API token available.");
}
