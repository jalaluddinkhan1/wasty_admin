/**
 * Shared session cookie name. Kept in its own tiny, dependency-free module
 * so it can be imported from `src/middleware.ts` (Edge runtime) without pulling
 * in `firebase-admin` (Node-only), which lives behind `@/server/auth-actions`.
 */
export const SESSION_COOKIE_NAME = "wasty_admin_session";
export const ADMIN_TYPE_COOKIE_NAME = "wasty_admin_type";
/** Short-lived Firebase ID token for AWS API calls from server actions. */
export const ID_TOKEN_COOKIE_NAME = "wasty_admin_id_token";

/**
 * Edge-safe check: Firebase session cookies are long JWTs (header.payload.sig).
 * Rejects forged short values like "1" or "dev:owner" that used to pass middleware.
 */
export function isLikelyFirebaseSessionCookie(value: string | undefined | null): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  // Real Firebase session cookies are typically >> 100 chars
  if (value.length < 100) return false;
  return parts.every((p) => p.length > 0);
}
