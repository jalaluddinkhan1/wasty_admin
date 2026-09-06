"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { D3DonutChart } from "@/components/d3/donut-chart";
import { D3HorizontalBars } from "@/components/d3/radial";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GovJobRow } from "@/lib/government/types";

function toneFor(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.includes("cancel")) return "danger";
  if (value.includes("complete")) return "success";
  if (value.includes("way") || value.includes("arrived")) return "warning";
  return "muted";
}

const STATUSES = ["scheduled", "on_the_way", "arrived", "completed", "cancelled"];

export function GovJobsClient({
  jobs,
  provider,
}: {
  jobs: GovJobRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          job.id.toLowerCase().includes(q) ||
          job.userName.toLowerCase().includes(q) ||
          job.partnerName.toLowerCase().includes(q) ||
          job.area.toLowerCase().includes(q) ||
          job.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [jobs, search, statusFilter]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Pickups & Jobs"
        description={
          provider === "firebase"
            ? "Operational job list with household, partner, area, waste type, and weight."
            : "Demo enriched job rows for government oversight."
        }
        actions={
          <ExportCsvButton
            label="Export CSV"
            filename="government-jobs.csv"
            headers={[
              "Job ID",
              "Household",
              "Phone",
              "Partner",
              "Area",
              "Location",
              "Waste",
              "Weight kg",
              "Status",
              "Updated",
            ]}
            rows={filtered.map((j) => [
              j.id,
              j.userName,
              j.userPhone ?? "",
              j.partnerName,
              j.area,
              j.location,
              j.wasteType,
              j.weightKg != null ? String(j.weightKg) : "",
              j.status,
              j.updatedAt ?? "",
            ])}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job pipeline</CardTitle>
            <CardDescription>How pickups sit across the operational steps.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3DonutChart
              data={STATUSES.map((status) => ({
                key: status,
                label: status.replaceAll("_", " "),
                value: jobs.filter((j) => j.status === status).length,
              }))}
              centerHint="jobs"
              height={240}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Waste by area</CardTitle>
            <CardDescription>Completed weight recorded in each zone.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3HorizontalBars
              data={Object.entries(
                jobs.reduce<Record<string, number>>((acc, job) => {
                  acc[job.area] = (acc[job.area] ?? 0) + (job.weightKg ?? 0);
                  return acc;
                }, {}),
              ).map(([area, value]) => ({ key: area, label: area, value }))}
              height={240}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search job, household, partner, area…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Household</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Area / Location</TableHead>
                <TableHead>Waste</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No jobs match filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/compliance/jobs/${job.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{job.id}</TableCell>
                    <TableCell>
                      <div>{job.userName}</div>
                      <div className="text-muted-foreground text-xs">{job.userPhone ?? "—"}</div>
                    </TableCell>
                    <TableCell>{job.partnerName}</TableCell>
                    <TableCell>
                      <div>{job.area}</div>
                      <div className="text-muted-foreground text-xs truncate max-w-[200px]">{job.location}</div>
                    </TableCell>
                    <TableCell>
                      {job.wasteType}
                      {job.weightKg != null ? (
                        <div className="text-muted-foreground text-xs">{job.weightKg} kg</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={job.status.replaceAll("_", " ")} tone={toneFor(job.status)} />
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
