import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

export function HeroSection({ loginHref }: { loginHref: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-emerald-500/15 via-background to-background" />
      <div className="absolute -top-24 right-0 size-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border bg-background/70 px-3 py-1 font-medium text-xs">
            {APP_CONFIG.publicSite.domain}
          </p>
          <h1 className="max-w-xl font-semibold text-4xl tracking-tight sm:text-5xl">
            Smart waste management for cities and communities
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Collect, sort, and recover waste with live jobs, partner dispatch, material intelligence, and impact
            reporting that governments and operators can trust.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={loginHref}>
                Login to Wasty
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#impact">See the impact</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Jobs tracked", value: "Live" },
            { label: "Material recovery", value: "MRF + AI" },
            { label: "City reporting", value: "ESG ready" },
            { label: "Chain of custody", value: "QR passport" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border bg-background/80 p-5 shadow-sm">
              <p className="text-muted-foreground text-sm">{item.label}</p>
              <p className="mt-2 font-semibold text-2xl">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
