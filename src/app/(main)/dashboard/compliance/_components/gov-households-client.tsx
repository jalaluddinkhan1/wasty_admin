"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { D3HorizontalBars } from "@/components/d3/radial";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GovHouseholdRow } from "@/lib/government/types";

export function GovHouseholdsClient({
  households,
  provider,
}: {
  households: GovHouseholdRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return households;
    const q = search.toLowerCase();
    return households.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q) ||
        h.uid.toLowerCase().includes(q),
    );
  }, [households, search]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Households"
        description={
          provider === "firebase"
            ? "Read-only household profiles with diversion history and open citizen reports."
            : "Demo household list for government oversight."
        }
        actions={
          <ExportCsvButton
            label="Export CSV"
            filename="households.csv"
            headers={["UID", "Name", "Email", "Phone", "Area", "Diverted kg", "Jobs completed", "Open reports"]}
            rows={filtered.map((h) => [
              h.uid,
              h.name,
              h.email,
              h.phone ?? "",
              h.area,
              String(h.wasteDivertedKg),
              String(h.jobsCompleted),
              String(h.openReports),
            ])}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Diversion leaders</CardTitle>
          <CardDescription>Households with the most recovered waste in this view.</CardDescription>
        </CardHeader>
        <CardContent>
          <D3HorizontalBars
            data={[...households]
              .sort((a, b) => b.wasteDivertedKg - a.wasteDivertedKg)
              .slice(0, 8)
              .map((h) => ({ key: h.uid, label: h.name, value: h.wasteDivertedKg }))}
            height={240}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search name, email, area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Household</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Diverted</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Open reports</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No households match search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow
                    key={row.uid}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/compliance/households/${row.uid}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-muted-foreground text-xs">{row.email}</div>
                    </TableCell>
                    <TableCell>{row.area}</TableCell>
                    <TableCell>{row.wasteDivertedKg} kg</TableCell>
                    <TableCell>{row.jobsCompleted}</TableCell>
                    <TableCell>{row.openReports}</TableCell>
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

export function GovHouseholdProfileClient({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof import("@/server/wasty-actions").getGovernmentHouseholdProfile>>>;
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title={profile.name}
        description={`${profile.area} · ${profile.email}`}
        actions={
          <Link href="/dashboard/compliance/households" className="text-sm underline-offset-4 hover:underline">
            Back to list
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Phone</div>
            <div className="font-medium">{profile.phone ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Waste diverted</div>
            <div className="font-medium">{profile.wasteDivertedKg} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Points</div>
            <div className="font-medium">{profile.points}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Open reports</div>
            <div className="font-medium">{profile.openReports}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 font-medium">Recent jobs</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Waste</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.recentJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No jobs yet.
                  </TableCell>
                </TableRow>
              ) : (
                profile.recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link href={`/dashboard/compliance/jobs/${job.id}`} className="font-mono text-xs underline">
                        {job.id}
                      </Link>
                    </TableCell>
                    <TableCell>{job.partnerName}</TableCell>
                    <TableCell>{job.wasteType}</TableCell>
                    <TableCell>{job.status.replaceAll("_", " ")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 font-medium">Citizen reports</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.recentReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No reports filed.
                  </TableCell>
                </TableRow>
              ) : (
                profile.recentReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.issueType}</TableCell>
                    <TableCell>{report.status.replaceAll("_", " ")}</TableCell>
                    <TableCell className="max-w-md truncate">{report.notes}</TableCell>
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
