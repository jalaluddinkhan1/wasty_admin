export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const { assertProductionEnvironment } = await import("@/lib/env/production");
  try {
    assertProductionEnvironment();
  } catch (error) {
    // Allow `next build` in CI/local with dev env; fail at runtime (`next start`).
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.error("[wasty]", error instanceof Error ? error.message : error);
      return;
    }
    throw error;
  }
}
