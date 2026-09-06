/**
 * Server-only Firebase Admin SDK wiring.
 *
 * Initializes a dedicated named app so this never collides with other
 * Firebase usage in the process. Credentials are resolved in this order:
 *   1. FIREBASE_ADMIN_SDK_PATH or GOOGLE_APPLICATION_CREDENTIALS
 *      → path to a service account JSON file (absolute or relative to cwd)
 *   2. FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY
 *      → inline credential triple (private key may contain literal \n)
 *
 * Never import this file from a Client Component — it uses Node-only APIs
 * (fs, firebase-admin) and must stay on the server.
 */

import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

import fs from "node:fs";
import path from "node:path";

const ADMIN_APP_NAME = "wasty-admin-sdk";

type ServiceAccountLike = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedStorage: Storage | null = null;
let readyChecked = false;
let readyValue = false;

function resolveServiceAccountPath(): string | null {
  const configured = process.env.FIREBASE_ADMIN_SDK_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configured) return null;
  const resolved = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  return fs.existsSync(resolved) ? resolved : null;
}

function loadServiceAccountFromJsonEnv(): ServiceAccountLike | null {
  const b64 = process.env.FIREBASE_ADMIN_SDK_JSON_BASE64?.trim();
  const raw = b64
    ? Buffer.from(b64, "base64").toString("utf8")
    : process.env.FIREBASE_ADMIN_SDK_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccountLike;
  } catch (error) {
    console.error("[wasty] Failed to parse FIREBASE_ADMIN_SDK_JSON(_BASE64):", error);
    return null;
  }
}

function loadServiceAccountFromFile(): ServiceAccountLike | null {
  const filePath = resolveServiceAccountPath();
  if (!filePath) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as ServiceAccountLike;
  } catch (error) {
    console.error("[wasty] Failed to read Firebase Admin service account JSON:", error);
    return null;
  }
}

function loadInlineServiceAccount(): ServiceAccountLike | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;
  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function loadCredential(): ServiceAccountLike | null {
  return loadServiceAccountFromJsonEnv() ?? loadServiceAccountFromFile() ?? loadInlineServiceAccount();
}

/** Cheap check — does NOT initialize the SDK. Safe to call repeatedly. */
export function isFirebaseAdminReady(): boolean {
  if (readyChecked) return readyValue;
  readyChecked = true;
  readyValue = Boolean(loadCredential());
  return readyValue;
}

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) {
    cachedApp = existing;
    return existing;
  }

  const credential = loadCredential();
  if (!credential) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_SDK_PATH (or GOOGLE_APPLICATION_CREDENTIALS) " +
        "to a service account JSON path, or set FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / " +
        "FIREBASE_ADMIN_PRIVATE_KEY in .env.local.",
    );
  }

  const projectId = credential.project_id ?? credential.projectId;
  const clientEmail = credential.client_email ?? credential.clientEmail;
  const privateKey = credential.private_key ?? credential.privateKey;

  cachedApp = initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
    },
    ADMIN_APP_NAME,
  );
  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

export function getAdminStorage(): Storage {
  if (!cachedStorage) cachedStorage = getStorage(getAdminApp());
  return cachedStorage;
}

export function getFirebaseAdminStatus() {
  const ready = isFirebaseAdminReady();
  return {
    ready,
    message: ready ? "Firebase Admin credentials detected" : "Firebase Admin not configured — using SQLite local DB",
  };
}
