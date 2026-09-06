import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { filterSidebarItems } from "@/lib/auth/nav-filter";
import { ADMIN_TYPE_LABELS, defaultLandingFor } from "@/lib/auth/permissions";
import { getEffectiveSession } from "@/lib/auth/require-admin";
import { cn } from "@/lib/utils";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { getPreference } from "@/server/server-actions";

import { DashboardAccessGate } from "./_components/dashboard-access-gate";
import { AccountSwitcher } from "./_components/sidebar/account-switcher";
import { LayoutControls } from "./_components/sidebar/layout-controls";
import { SearchDialog } from "./_components/sidebar/search-dialog";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const session = await getEffectiveSession();
  const adminType = session?.adminType ?? "owner";
  const navGroups = filterSidebarItems(sidebarItems, adminType);
  // Next.js server -> client props must be plain JSON. `icon` is a React component
  // function, which causes serialization warnings and slows rendering.
  const navGroupsSafe = navGroups.map((g, groupIndex) => ({
    ...g,
    id: g.id ?? groupIndex + 1,
    items: g.items.map((item) => {
      if (item.subItems) {
        return {
          ...item,
          icon: undefined,
          subItems: item.subItems.map((sub) => ({
            ...sub,
            icon: undefined,
          })),
        };
      }
      return {
        ...item,
        icon: undefined,
      };
    }),
  }));
  const account = {
    name: session?.email?.split("@")[0] ?? "Wasty Admin",
    email: session?.email ?? "ops@wasty.app",
    role: ADMIN_TYPE_LABELS[adminType],
  };
  const [variant, collapsible] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
  ]);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant={variant}
        collapsible={collapsible}
        navGroups={navGroupsSafe}
        user={account}
        homeUrl={defaultLandingFor(adminType)}
      />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-clip",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog navGroups={navGroupsSafe} />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <ThemeSwitcher />
              <AccountSwitcher user={account} />
            </div>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          <div
            role="status"
            className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm"
          >
            <strong className="font-semibold">Live AWS mode.</strong> Dashboard data is loaded from DynamoDB through
            the Wasty API.
          </div>
          <DashboardAccessGate adminType={adminType}>{children}</DashboardAccessGate>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
