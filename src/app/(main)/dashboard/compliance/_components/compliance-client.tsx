"use client";

import { useState } from "react";

import { toast } from "sonner";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsRange, ComplianceDashboard } from "@/lib/analytics/types";
import { lookupPassport } from "@/server/wasty-actions";

import { AreaOversightTable } from "./area-oversight-table";
import { AreaRecoveryChart } from "./area-recovery-chart";
import { ComplianceToolbar } from "./compliance-toolbar";
import { GovernmentOverviewStrip } from "./government-overview-strip";
import { MrfOversightTable } from "./mrf-oversight-table";

function toneForStatus(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.includes("cancel")) return "danger";
  if (value.includes("complete")) return "success";
  if (value.includes("way") || value.includes("arrived") || value.includes("open")) return "warning";
  return "muted";
}

export function ComplianceClient({
  data,
  range,
  provider,
}: {
  data: ComplianceDashboard;
  range: AnalyticsRange;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const [query, setQuery] = useState("");
  const [passport, setPassport] = useState<{
    id: string;
    title: string;
    timeline: { step: string; detail: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function searchPassport() {
    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Enter a bag QR or job ID");
      return;
    }
    setLoading(true);
    try {
      const result = await Promise.resolve(lookupPassport(trimmed));
      if (!result) {
        toast.error("No chain-of-custody record found");
        setPassport(null);
        return;
      }
      setPassport(result);
      toast.success(`Opened ${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="City oversight"
        description={
          provider === "firebase"
            ? "Area-wise household coverage, waste collected vs recovered, and MRF processing for government reporting."
            : "Demo city oversight board. Connect Firebase for live zone, MRF, and job data."
        }
        actions={<ComplianceToolbar range={range} data={data} />}
      />

      <GovernmentOverviewStrip overview={data.overview} />

      <Tabs defaultValue="areas">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="mrf">MRF facilities</TabsTrigger>
          <TabsTrigger value="jobs">Job progress</TabsTrigger>
          <TabsTrigger value="audit">Audit & passport</TabsTrigger>
        </TabsList>

        <TabsContent value="areas" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <AreaRecoveryChart areas={data.areas} />
            </div>
            <div className="xl:col-span-7">
              <AreaOversightTable areas={data.areas} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mrf" className="mt-4">
          <MrfOversightTable facilities={data.mrfFacilities} />
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.statusCounts.map((item) => (
              <Card key={item.status}>
                <CardHeader className="pb-2">
                  <CardDescription className="capitalize">{item.status.replaceAll("_", " ")}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{item.count}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Job progress</CardTitle>
                <CardDescription>Scheduled → on the way → arrived → completed.</CardDescription>
              </div>
              <ExportCsvButton
                label="Export jobs"
                filename={`wasty-compliance-jobs-${range}.csv`}
                headers={["Job", "Status", "User", "Partner", "Stream", "Area", "Updated"]}
                rows={data.recentJobs.map((job) => [
                  job.id,
                  job.status,
                  job.user,
                  job.partner,
                  job.wasteType,
                  job.location,
                  job.updatedAt ?? "",
                ])}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentJobs.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">No jobs in this window.</p>
              ) : (
                data.recentJobs.map((job) => (
                  <div key={job.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{job.id}</p>
                        <p className="text-muted-foreground text-xs">
                          {job.user} · {job.partner} · {job.wasteType} · {job.location || "—"}
                        </p>
                      </div>
                      <StatusBadge label={job.status} tone={toneForStatus(job.status)} />
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {job.steps.map((step) => (
                        <div
                          key={step.step}
                          className={`rounded-md px-2 py-1 text-center text-[11px] ${
                            step.done
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {step.step.replaceAll("_", " ")}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Audit trail</CardTitle>
                <CardDescription>Recent admin actions for compliance review.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.audit.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No audit entries yet.</p>
                ) : (
                  data.audit.slice(0, 12).map((row) => (
                    <div key={row.id} className="rounded-lg border px-3 py-2 text-sm">
                      <p className="font-medium">{row.action}</p>
                      <p className="text-muted-foreground text-xs">
                        {row.actor} → {row.target}
                      </p>
                      <p className="text-muted-foreground text-xs">{row.detail}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Waste passport</CardTitle>
                <CardDescription>Look up bag QR, job, or listing ID.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="WSTY-BAG-… or job ID"
                  />
                  <Button type="button" onClick={() => void searchPassport()} disabled={loading}>
                    {loading ? "Looking…" : "Lookup"}
                  </Button>
                </div>
                {passport ? (
                  <div className="space-y-2 rounded-lg border p-3 text-sm">
                    <p className="font-medium">{passport.title}</p>
                    {passport.timeline.map((step) => (
                      <div key={`${step.step}-${step.detail}`} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{step.step}</span> · {step.detail}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Chain of custody appears here after a lookup.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
