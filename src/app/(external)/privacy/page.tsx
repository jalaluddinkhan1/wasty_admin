import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";
import { PrivacyPolicyContent, PRIVACY_TOC } from "@/content/legal/privacy-policy";

import { LegalDocument } from "../_components/legal-document";

export const metadata: Metadata = {
  title: `Privacy Policy · ${APP_CONFIG.publicSite.name}`,
  description: `Comprehensive Privacy Policy for the Wasty apps and website, operated by ${APP_CONFIG.company.legalName}. Covers data collection, DPDP rights, processors, retention, and grievance redressal.`,
  openGraph: {
    title: `Privacy Policy · ${APP_CONFIG.publicSite.name}`,
    description: `How ${APP_CONFIG.company.legalName} collects and protects personal data for Wasty.`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" updated="17 September 2026" toc={PRIVACY_TOC}>
      <PrivacyPolicyContent />
    </LegalDocument>
  );
}
