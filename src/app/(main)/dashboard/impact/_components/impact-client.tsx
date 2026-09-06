"use client";

import { Leaf, Recycle, Scale, Trees } from "lucide-react";
import { toast } from "sonner";

import { DiversionTrendChart } from "@/app/(main)/dashboard/analytics/_components/diversion-trend-chart";
import { WasteStreamChart } from "@/app/(main)/dashboard/analytics/_components/waste-stream-chart";
import { ExportCsvButton } from "@/components/action-dialog-button";
import { D3SankeyChart } from "@/components/d3/sankey-chart";
import { D3RadialGauge } from "@/components/d3/radial";
import { formatKg } from "@/components/d3/core";
import { PageHeader } from "@/components/page-header";
import { StatCards } from "@/components/stat-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImpactStats } from "@/lib/analytics/types";

export function ImpactClient({ stats, provider }: { stats: ImpactStats; provider: "sqlite" | "firebase" | "aws" }) {
  const streamRows = stats.streamRows;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Impact & ESG"
        description={
          provider === "firebase"
            ? "Landfill diversion, recovery rates, and reporting for cities, buyers, and investors."
            : "Demo impact metrics while SQLite is active. Connect Firebase for live city totals."
        }
        actions={
          <ExportCsvButton
            label="Export report"
            filename="wasty-impact-report.csv"
            headers={["Stream", "Tons"]}
            rows={streamRows.map((row) => [row.stream, row.value])}
          />
        }
      />

      <StatCards
        items={[
          { title: "Diverted", value: `${stats.divertedTons} t`, hint: "From landfill", icon: Scale },
          {
            title: "Recovery rate",
            value: `${stats.recoveryRate}%`,
            hint: "Non-mixed recovered material",
            icon: Recycle,
          },
          { title: "CO₂e avoided", value: `${stats.carbonTons} t`, hint: "Proxy estimate", icon: Leaf },
          { title: "Bags recycled", value: stats.bagsRecycled, hint: "QR-tracked completions", icon: Trees },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>Material flow</CardTitle>
            <CardDescription>Collected waste split into recovered streams versus residual landfill.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3SankeyChart
              nodes={[
                { id: "collected", label: "Collected" },
                { id: "recovered", label: "Recovered" },
                { id: "landfill", label: "Landfill" },
                ...stats.streamSlices.map((s) => ({ id: s.key, label: s.stream })),
              ]}
              links={[
                {
                  source: "collected",
                  target: "recovered",
                  value: Math.round(stats.divertedKg * (stats.recoveryRateValue / 100)),
                },
                {
                  source: "collected",
                  target: "landfill",
                  value: Math.round(stats.divertedKg * (1 - stats.recoveryRateValue / 100)),
                },
                ...stats.streamSlices.map((s) => ({
                  source: "recovered",
                  target: s.key,
                  value: s.kg,
                })),
              ]}
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Recovery gauge</CardTitle>
            <CardDescription>{formatKg(stats.divertedKg)} processed in this window.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3RadialGauge value={stats.recoveryRateValue} label="city recovery" hint={`${stats.carbonTons} t CO₂e`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <WasteStreamChart data={stats.streamSlices} />
        </div>
        <div className="xl:col-span-7">
          <DiversionTrendChart data={stats.diversionTrends} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By stream</CardTitle>
            <CardDescription>
              {provider === "firebase"
                ? "Recovered material from completed jobs."
                : "Demo series until Firebase is connected."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {streamRows.map((row) => (
              <div key={row.stream} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>{row.stream}</span>
                <span className="font-medium tabular-nums">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificates</CardTitle>
            <CardDescription>Buyer and city diversion certificates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground text-sm">
            <p>Generate a demo diversion certificate for the current month.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                toast.success("Certificate generated", {
                  description: "Wasty Diversion Certificate · demo PDF stub",
                });
              }}
            >
              Generate certificate
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
