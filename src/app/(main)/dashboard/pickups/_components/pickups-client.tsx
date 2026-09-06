"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { ExternalLink, Filter } from "lucide-react";

import { ActionDialogButton, ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  assignPickupPartner,
  cancelPickup,
  forcePickupStatus,
  type UnifiedPartnerRow,
  type UnifiedPickupRow,
} from "@/server/wasty-actions";

const PIPELINE = [
  { id: "all", label: "All" },
  { id: "scheduled", label: "Scheduled" },
  { id: "on_the_way", label: "On the way" },
  { id: "arrived", label: "Arrived" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const FORCE_STATUS_OPTIONS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "On the way", value: "on_the_way" },
  { label: "Arrived", value: "arrived" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function normalizeStatus(status: string) {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (s === "in_transit" || s === "on-the-way") return "on_the_way";
  return s;
}

function toneFor(status: string): StatusTone {
  const s = normalizeStatus(status);
  if (s === "cancelled") return "danger";
  if (s === "completed") return "success";
  if (s === "on_the_way" || s === "arrived") return "warning";
  return "muted";
}

function PhotoLink({ label, url }: { label: string; url?: string | null }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function PickupsClient({
  initialPickups,
  partners,
  provider,
}: {
  initialPickups: UnifiedPickupRow[];
  partners: UnifiedPartnerRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialPickups);
  const [filter, setFilter] = useState<(typeof PIPELINE)[number]["id"]>("all");
  const [detailJob, setDetailJob] = useState<UnifiedPickupRow | null>(null);

  useEffect(() => {
    setRows(initialPickups);
  }, [initialPickups]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: rows.length };
    for (const stage of PIPELINE.slice(1)) base[stage.id] = 0;
    for (const row of rows) {
      const key = normalizeStatus(row.status);
      if (key in base) base[key] += 1;
      else if (key === "in_transit") base.on_the_way += 1;
    }
    return base;
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => {
      const key = normalizeStatus(row.status);
      if (filter === "on_the_way") return key === "on_the_way" || key === "in_transit";
      return key === filter;
    });
  }, [rows, filter]);

  const partnerOptions = partners.map((partner) => ({
    label: partner.name,
    value: provider === "firebase" ? partner.id : partner.name,
  }));

  const cancellableJobs = rows.filter((row) => row.status !== "completed" && row.status !== "cancelled");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Jobs pipeline"
        description={
          provider === "firebase"
            ? "Kanban-style board for shared Firestore jobs — filter by stage, assign or cancel from here."
            : "Local SQLite jobs board — same pipeline layout."
        }
        actions={
          <>
            <ExportCsvButton
              filename="wasty-jobs.csv"
              headers={["Job ID", "User", "Slot", "Partner", "Category", "Status"]}
              rows={rows.map((row) => [row.id, row.userName, row.slot, row.partner, row.waste, row.status])}
            />
            <ActionDialogButton
              label="Force status"
              title="Force job status"
              description="Override a job's pipeline stage (Firebase syncs linked pickup docs)."
              variant="outline"
              submitLabel={pending ? "Saving…" : "Apply status"}
              successMessage="Status updated"
              fields={[
                {
                  name: "jobId",
                  label: "Job",
                  type: "select",
                  required: true,
                  options: rows.map((row) => ({ label: `${row.id} · ${row.userName}`, value: row.id })),
                },
                {
                  name: "status",
                  label: "New status",
                  type: "select",
                  required: true,
                  options: FORCE_STATUS_OPTIONS,
                },
              ]}
              onSubmit={async (values) => {
                await forcePickupStatus(values.jobId, values.status);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.jobId
                      ? { ...row, status: values.status, updatedAt: new Date().toISOString() }
                      : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Assign partner"
              title="Assign partner"
              submitLabel={pending ? "Saving…" : "Assign"}
              successMessage="Partner assigned"
              fields={[
                {
                  name: "jobId",
                  label: "Job",
                  type: "select",
                  required: true,
                  options: rows.map((row) => ({ label: `${row.id} · ${row.userName}`, value: row.id })),
                },
                {
                  name: "partner",
                  label: "Partner",
                  type: "select",
                  required: true,
                  options:
                    partnerOptions.length > 0 ? partnerOptions : [{ label: "No partners yet", value: "" }],
                },
              ]}
              onSubmit={async (values) => {
                if (!values.partner) throw new Error("Choose a partner first");
                await assignPickupPartner(values.jobId, values.partner);
                const partnerLabel =
                  partnerOptions.find((option) => option.value === values.partner)?.label ?? values.partner;
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.jobId
                      ? { ...row, partner: partnerLabel, status: "scheduled", updatedAt: new Date().toISOString() }
                      : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Cancel job"
              title="Cancel job"
              variant="destructive"
              submitLabel="Cancel job"
              successMessage="Job cancelled"
              fields={[
                {
                  name: "jobId",
                  label: "Job",
                  type: "select",
                  required: true,
                  options:
                    cancellableJobs.length > 0
                      ? cancellableJobs.map((row) => ({ label: `${row.id} · ${row.userName}`, value: row.id }))
                      : [{ label: "No cancellable jobs", value: "" }],
                },
                { name: "reason", label: "Reason", type: "textarea", placeholder: "Duplicate / no answer" },
              ]}
              onSubmit={async (values) => {
                if (!values.jobId) throw new Error("Choose a job first");
                await cancelPickup(values.jobId, values.reason);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.jobId
                      ? { ...row, status: "cancelled", updatedAt: new Date().toISOString() }
                      : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="size-4 shrink-0 text-muted-foreground" />
        {PIPELINE.map((stage) => (
          <Button
            key={stage.id}
            type="button"
            size="sm"
            variant={filter === stage.id ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setFilter(stage.id)}
          >
            {stage.label}
            <span className="ml-1 tabular-nums opacity-70">{counts[stage.id] ?? 0}</span>
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground text-sm">
            No jobs in this stage.
          </div>
        ) : (
          visible.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setDetailJob(job)}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border p-4 text-left shadow-xs transition hover:border-primary/40",
                "bg-linear-to-b from-card to-muted/20",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-muted-foreground text-xs">{job.id}</p>
                  <h3 className="font-medium">{job.userName}</h3>
                </div>
                <StatusBadge label={job.status} tone={toneFor(job.status)} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Slot</dt>
                  <dd>{job.slot || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Waste</dt>
                  <dd>{job.waste || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground text-xs">Partner</dt>
                  <dd className={job.partner === "—" || job.partner === "Unassigned" ? "text-amber-700 dark:text-amber-400" : ""}>
                    {job.partner || "Unassigned"}
                  </dd>
                </div>
              </dl>
            </button>
          ))
        )}
      </div>

      <Dialog open={detailJob !== null} onOpenChange={(open) => !open && setDetailJob(null)}>
        <DialogContent className="sm:max-w-md">
          {detailJob ? (
            <>
              <DialogHeader>
                <DialogTitle>Job {detailJob.id}</DialogTitle>
                <DialogDescription>
                  {detailJob.userName} · {detailJob.waste}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd className="mt-0.5">
                    <StatusBadge label={detailJob.status} tone={toneFor(detailJob.status)} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Location</dt>
                  <dd>{detailJob.location || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Weight</dt>
                  <dd>{detailJob.weight ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Tip</dt>
                  <dd>{detailJob.tipAmount != null ? `₹${detailJob.tipAmount}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Partner ID</dt>
                  <dd className="font-mono text-xs">{detailJob.partnerId ?? detailJob.partner ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Before photo</dt>
                  <dd className="mt-0.5">
                    <PhotoLink label="Open before photo" url={detailJob.beforePhoto} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">After photo</dt>
                  <dd className="mt-0.5">
                    <PhotoLink label="Open after photo" url={detailJob.afterPhoto} />
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
