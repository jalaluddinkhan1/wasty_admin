# Usage: node scripts/list-admins.mjs
# Reads FIREBASE_ADMIN_SDK_PATH from .env.local

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
  if (configured) {
    const resolved = path.isAbsolute(configured) ? configured : path.join(root, configured);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Service account file not found: ${resolved}`);
    }
    const json = JSON.parse(fs.readFileSync(resolved, "utf8"));
    return cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  throw new Error("Set FIREBASE_ADMIN_SDK_PATH in .env.local or inline Admin env vars.");
}

loadEnvLocal();

if (getApps().length === 0) {
  initializeApp({ credential: resolveCredential() });
}

const result = await getAuth().listUsers(1000);
const admins = result.users.filter((user) => user.customClaims?.role === "admin");

if (admins.length === 0) {
  console.log("No admin users found.");
  process.exit(0);
}

for (const user of admins) {
  const type = user.customClaims?.adminType ?? "owner (default)";
  console.log(`${user.email ?? user.uid}\t${user.uid}\t${type}`);
}
