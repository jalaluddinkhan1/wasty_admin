import Link from "next/link";

import { APP_CONFIG } from "@/config/app-config";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{APP_CONFIG.publicSite.name}</p>
            <p className="text-muted-foreground">
              A product of {APP_CONFIG.company.legalName}
            </p>
            <p className="text-muted-foreground">{APP_CONFIG.copyright}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
            <Link href={APP_CONFIG.publicSite.loginUrl} className="hover:text-foreground">
              Admin login
            </Link>
            <Link href={APP_CONFIG.publicSite.privacyUrl} className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href={APP_CONFIG.publicSite.termsUrl} className="hover:text-foreground">
              Terms of Service
            </Link>
            <a
              href={`mailto:${APP_CONFIG.company.supportEmail}`}
              className="hover:text-foreground"
            >
              Contact
            </a>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {APP_CONFIG.publicSite.domain} · Operated by {APP_CONFIG.company.legalName}
        </p>
      </div>
    </footer>
  );
}
