#!/usr/bin/env node
/**
 * Bootstrap main Owner admin (Firebase Auth + owner claim).
 * Usage:
 *   OWNER_EMAIL=kai@example.com OWNER_PASSWORD='***' node scripts/ensure-owner.mjs
 * Reads FIREBASE_ADMIN_SDK_PATH from .env.local
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveCredential() {
  const configured = process.env.FIREBASE_ADMIN_SDK_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configured) throw new Error("Set FIREBASE_ADMIN_SDK_PATH in .env.local");
  const resolved = path.isAbsolute(configured) ? configured : path.join(root, configured);
  if (!fs.existsSync(resolved)) throw new Error(`Service account file not found: ${resolved}`);
  const json = JSON.parse(fs.readFileSync(resolved, "utf8"));
  return cert({
    projectId: json.project_id,
    clientEmail: json.client_email,
    privateKey: json.private_key,
  });
}

loadEnvLocal();

const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
const password = process.env.OWNER_PASSWORD || "";
const displayName = process.env.OWNER_NAME || "Wasty Owner";

if (!email || !password) {
  console.error("Set OWNER_EMAIL and OWNER_PASSWORD");
  process.exit(1);
}
if (password.length < 6) {
  console.error("OWNER_PASSWORD must be at least 6 characters");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: resolveCredential() });
}

const auth = getAuth();
const db = getFirestore();

let user;
let created = false;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password, displayName, emailVerified: true });
  console.log(`Updated existing user ${email}`);
} catch (err) {
  if (err?.code !== "auth/user-not-found") throw err;
  user = await auth.createUser({
    email,
    password,
    displayName,
    emailVerified: true,
  });
  created = true;
  console.log(`Created user ${email}`);
}

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  role: "admin",
  adminType: "owner",
});
console.log("Custom claims set: role=admin adminType=owner");

try {
  await db.collection("admins").doc(user.uid).set(
    {
      email,
      adminType: "owner",
      displayName,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
  console.log("Firestore admins/{uid} upserted");
} catch (err) {
  console.warn(
    "Firestore admin doc skipped (enable Cloud Firestore API if you need it):",
    err?.message || err,
  );
}

console.log(`Owner ready uid=${user.uid} created=${created} adminType=owner`);
console.log("Sign in at /auth/v2/login — then use Roles to create other admins.");
