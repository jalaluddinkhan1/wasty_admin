import type { ReactNode } from "react";

import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: APP_CONFIG.publicSite.title,
  description: APP_CONFIG.publicSite.description,
  openGraph: {
    title: APP_CONFIG.publicSite.title,
    description: APP_CONFIG.publicSite.description,
    url: `https://${APP_CONFIG.publicSite.domain}`,
    siteName: APP_CONFIG.publicSite.name,
  },
};

export default function ExternalLayout({ children }: { children: ReactNode }) {
  return children;
}
