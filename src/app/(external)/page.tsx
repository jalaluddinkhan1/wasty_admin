import { APP_CONFIG } from "@/config/app-config";
import { defaultLandingFor } from "@/lib/auth/permissions";
import { getSessionUser } from "@/server/auth-actions";

import { HeroSection } from "./_components/hero-section";
import { HowItWorks } from "./_components/how-it-works";
import { ImpactHighlights } from "./_components/impact-highlights";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default async function Home() {
  const session = await getSessionUser();
  const dashboardHref = session?.role === "admin" ? defaultLandingFor(session.adminType) : null;
  const loginHref = APP_CONFIG.publicSite.loginUrl;

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader dashboardHref={dashboardHref} />
      <main>
        <HeroSection loginHref={dashboardHref ?? loginHref} />
        <HowItWorks />
        <ImpactHighlights />
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border p-6">
              <h2 className="font-semibold text-xl">For city officials</h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Track what was collected, sorted, and recovered each day. Export compliance reports without changing
                operational data.
              </p>
            </article>
            <article className="rounded-2xl border p-6">
              <h2 className="font-semibold text-xl">For operators</h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Run jobs, partners, MRF, and settlements from one console. Company owners see the full picture; field
                teams see only what they need.
              </p>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
