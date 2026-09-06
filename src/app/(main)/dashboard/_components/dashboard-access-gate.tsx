"use client";

import { type ReactNode, useEffect } from "react";

import { usePathname, useRouter } from "next/navigation";

import { type AdminType, canAccessPath, defaultLandingFor } from "@/lib/auth/permissions";

export function DashboardAccessGate({ adminType, children }: { adminType: AdminType; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(pathname, adminType);

  useEffect(() => {
    if (!allowed) {
      router.replace("/unauthorized");
    }
  }, [allowed, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-64 items-center justify-center text-muted-foreground text-sm">
        Redirecting to a page you can access…
        <span className="sr-only">Home: {defaultLandingFor(adminType)}</span>
      </div>
    );
  }

  return children;
}
