"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { BrainCircuit, CheckCircle2, ScanLine, TriangleAlert } from "lucide-react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { StatCards } from "@/components/stat-cards";
import { overrideAiResult, setLiveAiModel } from "@/server/wasty-actions";

type JobDoc = Record<string, unknown> & { id: string };

function toneForJobStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "accepted" || s === "overridden") return "success" as const;
  if (s.includes("override") || s === "needs override") return "warning" as const;
  if (s.includes("contam")) return "danger" as const;
  return "default" as const;
}

function coerceJob(row: JobDoc) {
  return {
    id: row.id,
    source: String(row.source ?? "—"),
    ai: String(row.ai ?? "—"),
    confidence: String(row.confidence ?? "—"),
    contam: String(row.contam ?? "—"),
    status: String(row.status ?? "pending"),
  };
}

const MODEL_OPTIONS = [
  { label: "wasty-seg-v2.1", value: "v2.1" },
  { label: "wasty-seg-v2.2 (candidate)", value: "v2.2" },
  { label: "wasty-seg-v1.9 (rollback)", value: "v1.9" },
];

const CATEGORY_OPTIONS = [
  { label: "PET bottles", value: "PET bottles" },
  { label: "Cardboard", value: "Cardboard" },
  { label: "Mixed paper", value: "Mixed paper" },
  { label: "Dry recyclables", value: "Dry recyclables" },
  { label: "Reject", value: "Reject" },
];

export function AiSegregationClient({
  initialJobs,
  liveModel,
  provider,
}: {
  initialJobs: JobDoc[];
  liveModel: string;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(() => initialJobs.map(coerceJob));
  const [model, setModel] = useState(liveModel);

  useEffect(() => {
    setRows(initialJobs.map(coerceJob));
  }, [initialJobs]);

  useEffect(() => {
    setModel(liveModel);
  }, [liveModel]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        source: row.source,
        ai: row.ai,
        confidence: row.confidence,
        contam: row.contam,
        status: <StatusBadge label={row.status} tone={toneForJobStatus(row.status)} />,
      })),
    [rows],
  );

  const overrideQueue = rows.filter((row) => row.status.toLowerCase().includes("override"));
  const acceptedCount = rows.filter((row) => {
    const s = row.status.toLowerCase();
    return s === "accepted" || s === "overridden";
  }).length;
  const autoAcceptedPct = rows.length > 0 ? `${Math.round((acceptedCount / rows.length) * 100)}%` : "—";

  const overrideOptions =
    overrideQueue.length > 0
      ? overrideQueue.map((row) => ({
          label: `${row.id} · ${row.ai} (${row.confidence})`,
          value: row.id,
        }))
      : rows.length > 0
        ? rows.map((row) => ({ label: `${row.id} · ${row.ai}`, value: row.id }))
        : [{ label: "No jobs loaded", value: "" }];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="AI Segregation"
        description={
          provider === "firebase"
            ? `On-device and MRF AI recovery — live model wasty-seg-${model}.`
            : "No local SQLite AI jobs — switch to Firebase for segregation data."
        }
        actions={
          <>
            <ActionDialogButton
              label="Model versions"
              title="Model versions"
              description={
                provider === "firebase"
                  ? "Choose which classifier version is live for bag scan and MRF belt."
                  : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Set live model"
              successMessage="Live model updated"
              fields={[
                {
                  name: "model",
                  label: "Model",
                  type: "select",
                  required: true,
                  defaultValue: model,
                  options: MODEL_OPTIONS.map((opt) => ({
                    ...opt,
                    label: opt.value === model ? `${opt.label} (current)` : opt.label,
                  })),
                },
              ]}
              onSubmit={async (values) => {
                await setLiveAiModel(values.model);
                setModel(values.model);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Review queue"
              title="Override AI result"
              description={
                provider === "firebase" ? "Correct a low-confidence segregation job." : "Requires the Firebase provider."
              }
              submitLabel="Apply override"
              successMessage="Override applied"
              fields={[
                {
                  name: "jobId",
                  label: "Job",
                  type: "select",
                  required: true,
                  options: overrideOptions,
                },
                {
                  name: "category",
                  label: "Correct category",
                  type: "select",
                  required: true,
                  options: CATEGORY_OPTIONS,
                },
              ]}
              onSubmit={async (values) => {
                if (!values.jobId) throw new Error("Choose a job first");
                await overrideAiResult(values.jobId, values.category);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.jobId
                      ? { ...row, ai: values.category, confidence: "manual", status: "overridden" }
                      : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <StatCards
        items={[
          { title: "Jobs loaded", value: String(rows.length), hint: "Bag + belt scans", icon: ScanLine },
          { title: "Live model", value: `v${model.replace(/^v/, "")}`, hint: "Classifier version", icon: BrainCircuit },
          { title: "Override queue", value: String(overrideQueue.length), hint: "Low confidence / disputes", icon: TriangleAlert },
          { title: "Auto-accepted", value: autoAcceptedPct, hint: "Accepted / overridden", icon: CheckCircle2 },
        ]}
      />

      <SimpleDataTable
        title="Segregation jobs"
        description={provider === "firebase" ? "Source: Firestore (aiSegregationJobs)" : "Source: SQLite (empty)"}
        columns={[
          { key: "id", header: "Job" },
          { key: "source", header: "Source" },
          { key: "ai", header: "AI category" },
          { key: "confidence", header: "Confidence" },
          { key: "contam", header: "Contamination" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
