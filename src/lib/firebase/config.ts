/**
 * Firebase wiring for Wasty Admin.
 *
 * Your user + partner apps already use Firebase Auth + Firestore.
 * Fill `.env.local` from `.env.example`, then set:
 *   WASTY_DATA_PROVIDER=firebase
 *
 * Until then, the app uses local SQLite (`data/wasty-admin.sqlite`).
 *
 * NOTE: this module is imported by both server code and the browser
 * client (`./client.ts`), so it must stay free of Node-only imports
 * (no `fs`, no `firebase-admin`). The admin-readiness check below only
 * inspects env var *presence* — the real Admin SDK init/validation lives
 * in `./admin.ts`, which is server-only.
 */

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export function isFirebaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  if (!isFirebaseConfigured()) return null;
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

/** Env-only presence check for the Admin SDK (no Node imports here — see note above). */
export function isFirebaseAdminEnvPresent(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_SDK_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_ADMIN_SDK_JSON_BASE64 ||
      process.env.FIREBASE_ADMIN_SDK_JSON ||
      (process.env.FIREBASE_ADMIN_PROJECT_ID &&
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
        process.env.FIREBASE_ADMIN_PRIVATE_KEY),
  );
}

/**
 * Resolves which backend server actions should use.
 *
 * - `WASTY_DATA_PROVIDER=sqlite` always forces local SQLite.
 * - `WASTY_DATA_PROVIDER=firebase` uses Firebase if Admin credentials are
 *   present, otherwise falls back to SQLite with a console warning.
 * - Unset → prefer Firebase automatically once Admin credentials are
 *   present, otherwise SQLite (keeps local dev working with zero config).
 */
export function getDataProvider(): "sqlite" | "firebase" | "aws" {
  const raw = (process.env.WASTY_DATA_PROVIDER ?? "").trim().toLowerCase();

  if (raw === "sqlite") return "sqlite";

  if (raw === "aws") {
    if (!process.env.WASTY_API_BASE_URL?.trim()) {
      console.warn(
        "[wasty] WASTY_DATA_PROVIDER=aws but WASTY_API_BASE_URL is missing — falling back to sqlite",
      );
      return "sqlite";
    }
    return "aws";
  }

  if (raw === "firebase") {
    if (!isFirebaseAdminEnvPresent()) {
      console.warn("[wasty] WASTY_DATA_PROVIDER=firebase but Admin credentials are missing — falling back to sqlite");
      return "sqlite";
    }
    return "firebase";
  }

  return isFirebaseAdminEnvPresent() ? "firebase" : "sqlite";
}
