"use client";

import Link from "next/link";
import { useState } from "react";

import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { GovJobRow } from "@/lib/government/types";
import { lookupPassport } from "@/server/wasty-actions";

function toneFor(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.includes("cancel")) return "danger";
  if (value.includes("complete")) return "success";
  if (value.includes("way") || value.includes("arrived")) return "warning";
  return "muted";
}

export function GovJobDetailClient({
  job,
  provider,
}: {
  job: GovJobRow;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const [passportQuery, setPassportQuery] = useState(job.id);
  const [passport, setPassport] = useState<{
    id: string;
    title: string;
    timeline: { step: string; detail: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function searchPassport() {
    const trimmed = passportQuery.trim();
    if (!trimmed) {
      toast.error("Enter a job or bag ID");
      return;
    }
    setLoading(true);
    try {
      const result = await lookupPassport(trimmed);
      if (!result) {
        toast.error("No chain-of-custody record found");
        setPassport(null);
        return;
      }
      setPassport(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title={`Job ${job.id}`}
        description={`${job.wasteType} pickup · ${job.area}`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/compliance/jobs">Back to jobs</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{job.userName}</div>
            <div className="text-muted-foreground">{job.userPhone ?? "No phone"}</div>
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href={`/dashboard/compliance/households/${job.userId}`}>View profile</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Partner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{job.partnerName}</div>
            <div className="text-muted-foreground">{job.location}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusBadge label={job.status.replaceAll("_", " ")} tone={toneFor(job.status)} />
            {job.weightKg != null ? (
              <div className="text-muted-foreground text-sm">Weight: {job.weightKg} kg</div>
            ) : null}
            <div className="text-muted-foreground text-xs">Updated {job.updatedAt?.slice(0, 16) ?? "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pickup pipeline</CardTitle>
          <CardDescription>Step timeline for this job</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap gap-3">
            {job.steps.map((step) => (
              <li
                key={step.step}
                className={`rounded-lg border px-3 py-2 text-sm capitalize ${step.done ? "border-emerald-500/40 bg-emerald-500/10" : "text-muted-foreground"}`}
              >
                {step.step.replaceAll("_", " ")}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {(job.beforePhoto || job.afterPhoto) && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {job.beforePhoto ? (
              <div>
                <div className="mb-1 text-muted-foreground text-xs">Before</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.beforePhoto} alt="Before pickup" className="max-h-48 rounded-md border" />
              </div>
            ) : null}
            {job.afterPhoto ? (
              <div>
                <div className="mb-1 text-muted-foreground text-xs">After</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.afterPhoto} alt="After pickup" className="max-h-48 rounded-md border" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Waste passport</CardTitle>
          <CardDescription>
            {provider === "firebase"
              ? "Chain-of-custody lookup for this job or bag QR."
              : "Passport lookup requires Firebase provider."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input value={passportQuery} onChange={(e) => setPassportQuery(e.target.value)} className="max-w-sm" />
            <Button type="button" onClick={searchPassport} disabled={loading}>
              {loading ? "Searching…" : "Lookup passport"}
            </Button>
          </div>
          {passport ? (
            <div className="rounded-lg border p-4">
              <div className="font-medium">{passport.title}</div>
              <ul className="mt-2 space-y-2 text-sm">
                {passport.timeline.map((item) => (
                  <li key={item.step}>
                    <span className="font-medium">{item.step}:</span> {item.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
