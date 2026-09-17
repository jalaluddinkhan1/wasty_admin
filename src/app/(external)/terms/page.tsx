import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";
import { TermsOfServiceContent, TERMS_TOC } from "@/content/legal/terms-of-service";

import { LegalDocument } from "../_components/legal-document";

export const metadata: Metadata = {
  title: `Terms of Service · ${APP_CONFIG.publicSite.name}`,
  description: `Terms of Service for Wasty customer and partner apps, operated by ${APP_CONFIG.company.legalName}.`,
  openGraph: {
    title: `Terms of Service · ${APP_CONFIG.publicSite.name}`,
    description: `Legal terms for using Wasty, a product of ${APP_CONFIG.company.legalName}.`,
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Terms of Service" updated="17 September 2026" toc={TERMS_TOC}>
      <TermsOfServiceContent />
    </LegalDocument>
  );
}
