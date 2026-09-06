import { getDataProvider } from "@/lib/firebase/config";

/** Fail fast when production is misconfigured. Called from instrumentation on boot. */
export function assertProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  if (process.env.WASTY_AUTH_BYPASS === "1") {
    throw new Error("WASTY_AUTH_BYPASS must not be enabled in production.");
  }

  const provider = getDataProvider();
  if (provider === "sqlite") {
    throw new Error("Production requires WASTY_DATA_PROVIDER=firebase or aws (not sqlite).");
  }
  if (provider === "aws" && !process.env.WASTY_API_BASE_URL?.trim()) {
    throw new Error("Production AWS mode requires WASTY_API_BASE_URL.");
  }
  if (provider === "firebase") {
    // Admin SDK path/JSON checked at runtime by firebase admin helper
  }

  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing production Firebase env: ${missing.join(", ")}`);
  }
}
