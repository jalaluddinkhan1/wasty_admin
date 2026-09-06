"use client";

import { useRouter } from "next/navigation";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsRange } from "@/lib/analytics/types";
import type {
  AreaOversightRow,
  MrfOversightRow,
} from "@/lib/analytics/types";
import type { CitizenReportRow, GovJobRow } from "@/lib/government/types";

type AuditRow = {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  createdAt: string | null;
};

export function GovExportsClient({
  range,
  areas,
  mrfFacilities,
  jobs,
  reports,
  audit,
  provider,
}: {
  range: AnalyticsRange;
  areas: AreaOversightRow[];
  mrfFacilities: MrfOversightRow[];
  jobs: GovJobRow[];
  reports: CitizenReportRow[];
  audit: AuditRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Reports & Exports"
        description={
          provider === "firebase"
            ? "One-click CSV bundles for regulatory reporting and city oversight."
            : "Demo export hub — all lists available as CSV."
        }
        actions={
          <Select value={range} onValueChange={(value) => router.push(`/dashboard/compliance/exports?range=${value}`)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Zones & coverage</CardTitle>
            <CardDescription>{areas.length} areas in range</CardDescription>
          </CardHeader>
          <CardContent>
            <ExportCsvButton
              label="Download areas CSV"
              filename={`areas-${range}.csv`}
              headers={[
                "Area",
                "Household target",
                "Households served",
                "Coverage %",
                "Partners",
                "Jobs",
                "Collected kg",
                "Recovered kg",
                "Recovery %",
              ]}
              rows={areas.map((row) => [
                row.area,
                String(row.householdTarget),
                String(row.householdsServed),
                String(row.coveragePct),
                String(row.partnersActive),
                String(row.jobsCompleted),
                String(row.collectedKg),
                String(row.recoveredKg),
                String(row.recoveryRate),
              ])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MRF facilities</CardTitle>
            <CardDescription>{mrfFacilities.length} facilities</CardDescription>
          </CardHeader>
          <CardContent>
            <ExportCsvButton
              label="Download MRF CSV"
              filename={`mrf-${range}.csv`}
              headers={["MRF", "Zone", "Capacity", "Status", "Inbound kg", "Processed kg", "Recovery %", "Households"]}
              rows={mrfFacilities.map((row) => [
                row.name,
                row.zone,
                row.capacity,
                row.status,
                String(row.inboundKg),
                String(row.processedKg),
                String(row.recoveryRate),
                String(row.householdsServed),
              ])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pickups & jobs</CardTitle>
            <CardDescription>{jobs.length} jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <ExportCsvButton
              label="Download jobs CSV"
              filename={`jobs-${range}.csv`}
              headers={["Job ID", "Household", "Partner", "Area", "Waste", "Weight kg", "Status", "Updated"]}
              rows={jobs.map((j) => [
                j.id,
                j.userName,
                j.partnerName,
                j.area,
                j.wasteType,
                j.weightKg != null ? String(j.weightKg) : "",
                j.status,
                j.updatedAt ?? "",
              ])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Citizen reports</CardTitle>
            <CardDescription>{reports.length} reports</CardDescription>
          </CardHeader>
          <CardContent>
            <ExportCsvButton
              label="Download reports CSV"
              filename={`citizen-reports-${range}.csv`}
              headers={["ID", "Reporter", "Issue", "Area", "Status", "Notes", "Created"]}
              rows={reports.map((r) => [
                r.id,
                r.userName,
                r.issueType,
                r.area,
                r.status,
                r.notes,
                r.createdAt ?? "",
              ])}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>{audit.length} entries</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <ExportCsvButton
              label="Download audit CSV"
              filename={`audit-${range}.csv`}
              headers={["ID", "Action", "Actor", "Target", "Detail", "Created"]}
              rows={audit.map((r) => [r.id, r.action, r.actor, r.target, r.detail, r.createdAt ?? ""])}
            />
            <Button variant="outline" asChild>
              <a href="/dashboard/compliance/audit">Open audit page</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
