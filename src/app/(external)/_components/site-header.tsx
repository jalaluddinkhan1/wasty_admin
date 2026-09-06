import Link from "next/link";

import { Recycle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

export function SiteHeader({ dashboardHref }: { dashboardHref?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Recycle className="size-4" />
          </span>
          {APP_CONFIG.publicSite.name}
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="#how-it-works">How it works</Link>
          </Button>
          <Button asChild>
            <Link href={dashboardHref ?? APP_CONFIG.publicSite.loginUrl}>
              {dashboardHref ? "Open dashboard" : "Login"}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
