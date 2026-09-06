# Usage:
#   node scripts/set-admin-claim.mjs user@example.com
#   node scripts/set-admin-claim.mjs user@example.com --type government
#
# Types: owner | government | ops_manager | support
# Reads FIREBASE_ADMIN_SDK_PATH from .env.local

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const ADMIN_TYPES = new Set(["owner", "government", "ops_manager", "support"]);

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

function parseArgs(argv) {
  const args = argv.slice(2);
  let email = "";
  let adminType = "owner";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--type") {
      adminType = args[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (!email) email = args[i];
  }
  return { email, adminType };
}

loadEnvLocal();

const { email, adminType } = parseArgs(process.argv);
if (!email) {
  console.error("Usage: node scripts/set-admin-claim.mjs user@example.com [--type owner|government|ops_manager|support]");
  process.exit(1);
}
if (!ADMIN_TYPES.has(adminType)) {
  console.error(`Unknown admin type "${adminType}". Use owner, government, ops_manager, or support.`);
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: resolveCredential() });
}

const auth = getAuth();
const db = getFirestore();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "admin", adminType });
await db.collection("admins").doc(user.uid).set(
  {
    email: user.email ?? email,
    adminType,
    status: "active",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: "set-admin-claim-script",
  },
  { merge: true },
);

console.log(`Set { role: 'admin', adminType: '${adminType}' } on ${email} (uid: ${user.uid})`);
