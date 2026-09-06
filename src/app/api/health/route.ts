import { NextResponse } from "next/server";

import { getDataProvider } from "@/lib/firebase/config";
import { isFirebaseAdminReady } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const provider = getDataProvider();
  const firebaseReady = provider === "firebase" ? isFirebaseAdminReady() : true;
  const authBypass = process.env.WASTY_AUTH_BYPASS === "1";
  const isProd = process.env.NODE_ENV === "production";

  const misconfig: string[] = [];
  if (isProd && authBypass) misconfig.push("WASTY_AUTH_BYPASS must be disabled in production");
  if (isProd && provider === "sqlite") misconfig.push("WASTY_DATA_PROVIDER must be firebase or aws in production");
  if (isProd && provider === "aws" && !process.env.WASTY_API_BASE_URL?.trim()) {
    misconfig.push("WASTY_API_BASE_URL is required when WASTY_DATA_PROVIDER=aws");
  }
  if (isProd && provider === "firebase" && !firebaseReady) {
    misconfig.push("Firebase Admin SDK credentials missing");
  }

  const healthy =
    (provider === "aws" || provider === "firebase" || (!isProd && provider === "sqlite")) &&
    (provider !== "firebase" || firebaseReady) &&
    misconfig.length === 0;
  const status = healthy ? 200 : 503;

  return NextResponse.json(
    {
      ok: healthy,
      service: "wasty-admin",
      provider,
      firebaseAdmin: firebaseReady,
      authBypassEnabled: authBypass,
      misconfig,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
