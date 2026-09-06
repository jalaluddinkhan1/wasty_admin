import Link from "next/link";

import { APP_CONFIG } from "@/config/app-config";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-muted-foreground">
          {APP_CONFIG.copyright} {APP_CONFIG.publicSite.domain}
        </p>
        <div className="flex gap-4 text-muted-foreground">
          <Link href={APP_CONFIG.publicSite.loginUrl} className="hover:text-foreground">
            Admin login
          </Link>
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </div>
    </footer>
  );
}
