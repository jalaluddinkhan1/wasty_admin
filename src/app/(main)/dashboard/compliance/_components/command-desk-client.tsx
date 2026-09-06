"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  ArrowRight,
  Inbox,
  Package,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCards } from "@/components/stat-cards";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { D3DonutChart } from "@/components/d3/donut-chart";
import { D3RadialGauge } from "@/components/d3/radial";
import { formatKg } from "@/components/d3/core";
import type { AnalyticsRange } from "@/lib/analytics/types";
import type { CommandDeskData } from "@/lib/government/types";

function toneForStatus(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.includes("cancel") || value === "escalated") return "danger";
  if (value.includes("complete") || value === "resolved") return "success";
  if (value.includes("progress") || value.includes("way") || value.includes("arrived") || value === "submitted")
    return "warning";
  return "muted";
}

const QUICK_LINKS = [
  { href: "/dashboard/compliance/reports", label: "Citizen Reports", icon: Inbox },
  { href: "/dashboard/compliance/jobs", label: "Pickups & Jobs", icon: Package },
  { href: "/dashboard/compliance/households", label: "Households", icon: Users },
  { href: "/dashboard/compliance/zones", label: "Zones & Coverage", icon: Truck },
  { href: "/dashboard/compliance/audit", label: "Audit Log", icon: AlertTriangle },
  { href: "/dashboard/compliance/exports", label: "Reports & Exports", icon: ArrowRight },
] as const;

export function CommandDeskClient({
  data,
  range,
  provider,
}: {
  data: CommandDeskData;
  range: AnalyticsRange;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const { queue, overview } = data;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Command Desk"
        description={
          provider === "firebase"
            ? "Pending citizen reports, active pickups, and quick access to city oversight modules."
            : "Demo command desk — connect Firebase for live citizen reports and job data."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(value) => router.push(`/dashboard/compliance?range=${value}`)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" aria-label="Refresh" onClick={() => router.refresh()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />

      <StatCards
        items={[
          {
            title: "Citizen reports pending",
            value: String(queue.citizenPending),
            hint: `${queue.citizenInProgress} in progress · ${queue.citizenEscalated} escalated`,
            icon: Inbox,
          },
          {
            title: "Active pickups",
            value: String(queue.jobsActive),
            hint: "Jobs not yet completed or cancelled",
            icon: Package,
          },
          {
            title: "Partner alerts",
            value: String(queue.partnerAlertsOpen),
            hint: "Open ops reports from partners",
            icon: AlertTriangle,
          },
          {
            title: "Recovery rate",
            value: `${overview.recoveryRate}%`,
            hint: `${formatKg(overview.recoveredKg)} recovered of ${formatKg(overview.collectedKg)}`,
            icon: Truck,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Case mix</CardTitle>
            <CardDescription>Citizen reports by current status.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3DonutChart
              data={[
                { key: "submitted", label: "Pending", value: queue.citizenPending, color: "var(--chart-4)" },
                { key: "in_progress", label: "In progress", value: queue.citizenInProgress, color: "var(--chart-2)" },
                { key: "escalated", label: "Escalated", value: queue.citizenEscalated, color: "var(--chart-5)" },
              ]}
              centerHint="open cases"
              height={220}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recovery</CardTitle>
            <CardDescription>City-wide recovered share of collected waste.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3RadialGauge
              value={overview.recoveryRate}
              label="recovery rate"
              hint={`${formatKg(overview.recoveredKg)} of ${formatKg(overview.collectedKg)}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active pickups</CardTitle>
            <CardDescription>Jobs still in the field versus the open partner-alert load.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3DonutChart
              data={[
                { key: "jobs", label: "Active jobs", value: queue.jobsActive, color: "var(--chart-1)" },
                { key: "alerts", label: "Partner alerts", value: queue.partnerAlertsOpen, color: "var(--chart-5)" },
              ]}
              centerHint="ops load"
              height={220}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Recent citizen reports</CardTitle>
              <CardDescription>Latest complaints from the consumer app</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/compliance/reports">View inbox</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No citizen reports yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentReports.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.issueType}</TableCell>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>{row.area}</TableCell>
                      <TableCell>
                        <StatusBadge label={row.status.replaceAll("_", " ")} tone={toneForStatus(row.status)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick navigation</CardTitle>
            <CardDescription>Jump to oversight modules</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Button key={link.href} variant="outline" className="justify-start gap-2" asChild>
                  <Link href={link.href}>
                    <Icon className="size-4" />
                    {link.label}
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Recent pickups & jobs</CardTitle>
            <CardDescription>
              {overview.householdsServed} households served in selected range
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/compliance/jobs">View all jobs</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Household</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No jobs in range.
                  </TableCell>
                </TableRow>
              ) : (
                data.recentJobs.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/compliance/jobs/${row.id}`)}>
                    <TableCell className="font-mono text-xs">{row.id.slice(0, 12)}</TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell>{row.partnerName}</TableCell>
                    <TableCell>{row.area}</TableCell>
                    <TableCell>
                      <StatusBadge label={row.status.replaceAll("_", " ")} tone={toneForStatus(row.status)} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
