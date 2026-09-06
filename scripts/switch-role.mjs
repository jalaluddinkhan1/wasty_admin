/**
 * Usage: node scripts/switch-role.mjs owner
 * Roles: owner | government | ops_manager | support
 *
 * Updates WASTY_DEV_ADMIN_TYPE in .env.local and prints the landing URL.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROLES = ["owner", "government", "ops_manager", "support"];
const LANDINGS = {
  owner: "/dashboard/analytics",
  government: "/dashboard/compliance",
  ops_manager: "/dashboard/ops",
  support: "/dashboard/support",
};

const role = process.argv[2];
if (!role || !ROLES.includes(role)) {
  console.error(`❌  Usage: node scripts/switch-role.mjs <role>`);
  console.error(`   Roles: ${ROLES.join(" | ")}`);
  process.exit(1);
}

const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
let content = readFileSync(envPath, "utf8");

if (content.includes("WASTY_DEV_ADMIN_TYPE=")) {
  content = content.replace(/WASTY_DEV_ADMIN_TYPE=.*/g, `WASTY_DEV_ADMIN_TYPE=${role}`);
} else {
  content += `\nWASTY_DEV_ADMIN_TYPE=${role}\n`;
}

writeFileSync(envPath, content, "utf8");
console.log(`✅  Switched to: ${role}`);
console.log(`   Landing: http://localhost:3000${LANDINGS[role]}`);
console.log(`   Restart the dev server for the change to take effect.`);
