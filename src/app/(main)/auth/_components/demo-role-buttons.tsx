"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { defaultLandingFor } from "@/lib/auth/permissions";
import { switchDevRole } from "@/server/dev-actions";

const ROLES = [
  {
    type: "owner" as const,
    label: "Company Owner",
    badge: "Full access",
    badgeVariant: "default" as const,
    description: "Analytics, ops, settlements, config, roles — everything",
    color: "border-violet-500/40 hover:border-violet-500 hover:bg-violet-500/5",
    badgeClass: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  },
  {
    type: "government" as const,
    label: "Government Official",
    badge: "Read only",
    badgeVariant: "secondary" as const,
    description: "City oversight — areas, MRF, coverage, exports",
    color: "border-sky-500/40 hover:border-sky-500 hover:bg-sky-500/5",
    badgeClass: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  },
  {
    type: "ops_manager" as const,
    label: "Ops Manager",
    badge: "Ops + MRF",
    badgeVariant: "secondary" as const,
    description: "Jobs, routes, partners, bags, zones, MRF",
    color: "border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/5",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  {
    type: "support" as const,
    label: "Support Analyst",
    badge: "Support",
    badgeVariant: "secondary" as const,
    description: "Tickets, users, notifications, basic analytics",
    color: "border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/5",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
];

export function DemoRoleButtons() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function enter(role: (typeof ROLES)[number]) {
    setLoading(role.type);
    try {
      await switchDevRole(role.type);
      toast.success(`Signed in as ${role.label}`);
      router.push(defaultLandingFor(role.type));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to switch role");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Demo — pick a role
      </p>
      <div className="grid grid-cols-1 gap-2">
        {ROLES.map((role) => (
          <Button
            key={role.type}
            variant="outline"
            className={`h-auto w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors ${role.color}`}
            disabled={!!loading}
            onClick={() => enter(role)}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="font-medium text-sm">{role.label}</span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${role.badgeClass}`}
              >
                {role.badge}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground font-normal">{role.description}</span>
            {loading === role.type && (
              <span className="text-[10px] text-muted-foreground mt-0.5">Signing in…</span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
