export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { assertProductionEnvironment } = await import("@/lib/env/production");
  try {
    assertProductionEnvironment();
  } catch (error) {
    // Never crash the whole SSR process — Amplify Hosting returns opaque 500s if we throw here.
    // Health + login surfaces misconfig instead of taking the site down.
    console.error("[wasty] production env check:", error instanceof Error ? error.message : error);
  }
}
