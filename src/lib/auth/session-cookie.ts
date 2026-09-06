/**
 * Shared session cookie name. Kept in its own tiny, dependency-free module
 * so it can be imported from `src/proxy.ts` (Edge runtime) without pulling
 * in `firebase-admin` (Node-only), which lives behind `@/server/auth-actions`.
 */
export const SESSION_COOKIE_NAME = "wasty_admin_session";
export const ADMIN_TYPE_COOKIE_NAME = "wasty_admin_type";
/** Short-lived Firebase ID token for AWS API calls from server actions. */
export const ID_TOKEN_COOKIE_NAME = "wasty_admin_id_token";
