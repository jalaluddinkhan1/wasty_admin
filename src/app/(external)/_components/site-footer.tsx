import Link from "next/link";

import { APP_CONFIG } from "@/config/app-config";

export function SiteFooter() {
  const { company, publicSite, copyright } = APP_CONFIG;

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-foreground">{publicSite.name}</p>
            <p className="text-muted-foreground">A product of {company.legalName}</p>
            <p className="text-muted-foreground">{copyright}</p>
            <p className="text-muted-foreground">
              <a href={`mailto:${company.supportEmail}`} className="hover:text-foreground">
                {company.supportEmail}
              </a>
              {" · "}
              <a href={`tel:${company.phoneE164}`} className="hover:text-foreground">
                {company.phoneDisplay}
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
            <Link href={publicSite.loginUrl} className="hover:text-foreground">
              Admin login
            </Link>
            <Link href={publicSite.privacyUrl} className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href={publicSite.termsUrl} className="hover:text-foreground">
              Terms of Service
            </Link>
            <a href={`mailto:${company.supportEmail}`} className="hover:text-foreground">
              Email
            </a>
            <a href={`tel:${company.phoneE164}`} className="hover:text-foreground">
              Call
            </a>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {publicSite.domain} · Operated by {company.legalName}
        </p>
      </div>
    </footer>
  );
}
