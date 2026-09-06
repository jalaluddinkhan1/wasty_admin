import Link from "next/link";

import { AlertTriangle, ArrowRight, Package, Radio, Truck, Users } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { getDataProvider } from "@/lib/firebase/config";
import {
  getAnalyticsDashboard,
  getCommandCenterStats,
  getDbStatus,
  listPickups,
  listSupportTickets,
} from "@/server/wasty-actions";

import { OpsSparkline } from "./_components/ops-sparkline";

function toneForStatus(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("cancel") || s.includes("urgent") || s.includes("sos")) return "danger";
  if (s.includes("complete") || s.includes("online") || s.includes("acked") || s.includes("resolved")) return "success";
  if (s.includes("way") || s.includes("transit") || s.includes("open") || s.includes("arrived")) return "warning";
  return "muted";
}

export default async function OpsPage() {
  const provider = getDataProvider();
  const dbStatus = await getDbStatus();
  const trends = await getAnalyticsDashboard("7d")
    .then((d) => d.jobTrends ?? [])
    .catch(() => [] as Awaited<ReturnType<typeof getAnalyticsDashboard>>["jobTrends"]);

  const [commandStats, pickupRows, tickets] = await Promise.all([
    getCommandCenterStats(),
    listPickups(),
    listSupportTickets(),
  ]);

  const stats = {
    activeJobs: commandStats.activeJobs,
    onlinePartners: commandStats.onlinePartners,
    totalPartners: commandStats.totalPartners,
    openAlerts: commandStats.openAlerts,
  };

  const recentJobs = pickupRows.slice(0, 8).map((row) => ({
    id: row.id,
    user: row.userName,
    partner: row.partner,
    status: row.status,
    slot: row.slot,
  }));

  const alerts = tickets.slice(0, 8).map((t) => ({
    id: t.id,
    type: t.type,
    from: t.fromLabel,
    summary: t.summary,
    status: t.status,
  }));

  const pulse = [
    {
      label: "Active jobs",
      value: stats.activeJobs,
      hint: "In motion right now",
      icon: Package,
      href: "/dashboard/pickups",
      accent: "from-emerald-500/20 to-transparent",
    },
    {
      label: "Partners online",
      value: stats.onlinePartners,
      hint: `${stats.totalPartners} on roster`,
      icon: Truck,
      href: "/dashboard/partners",
      accent: "from-sky-500/20 to-transparent",
    },
    {
      label: "Open alerts",
      value: stats.openAlerts,
      hint: "Needs ops eyes",
      icon: AlertTriangle,
      href: "/dashboard/support",
      accent: "from-amber-500/25 to-transparent",
    },
    {
      label: "Workforce",
      value: stats.totalPartners,
      hint: "Total partners",
      icon: Users,
      href: "/dashboard/partners",
      accent: "from-violet-500/15 to-transparent",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,var(--color-primary)_0%,transparent_55%)] opacity-15" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 font-medium text-xs backdrop-blur">
              <Radio className="size-3.5 text-emerald-600" />
              Live ops · {dbStatus.provider}
            </div>
            <h1 className="font-semibold text-3xl tracking-tight md:text-4xl">Command Center</h1>
            <p className="max-w-xl text-muted-foreground text-sm">{dbStatus.message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/support">Open alerts</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/pickups">
                Dispatch jobs
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {pulse.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group relative overflow-hidden rounded-2xl border bg-linear-to-b ${item.accent} p-4 transition hover:border-primary/40`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-sm">{item.label}</p>
                  <p className="mt-2 font-semibold text-3xl tabular-nums tracking-tight">{item.value}</p>
                  <p className="mt-1 text-muted-foreground text-xs">{item.hint}</p>
                </div>
                <div className="rounded-xl border bg-background/80 p-2 text-muted-foreground group-hover:text-foreground">
                  <Icon className="size-4" />
                </div>
              </div>
            </Link>
          );
        })}
        {trends.length > 0 ? <OpsSparkline data={trends} /> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-medium">Live board</h2>
              <p className="text-muted-foreground text-xs">Latest jobs moving through the city</p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/pickups">View all</Link>
            </Button>
          </div>
          <div className="divide-y">
            {recentJobs.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground text-sm">No jobs yet.</p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{job.id}</p>
                      <StatusBadge label={job.status} tone={toneForStatus(job.status)} />
                    </div>
                    <p className="truncate text-muted-foreground text-sm">
                      {job.user} → {job.partner}
                      {job.slot ? ` · ${job.slot}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-muted/20">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-medium">Alert radar</h2>
              <p className="text-muted-foreground text-xs">SOS, support, contamination…</p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/support">Inbox</Link>
            </Button>
          </div>
          <div className="space-y-2 p-3">
            {alerts.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground text-sm">All quiet.</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{alert.type}</p>
                      <p className="text-muted-foreground text-xs">{alert.from}</p>
                      <p className="mt-1 line-clamp-2 text-sm">{alert.summary}</p>
                    </div>
                    <StatusBadge label={alert.status} tone={toneForStatus(alert.status)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
