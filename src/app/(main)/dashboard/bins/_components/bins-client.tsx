"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { upsertBin, type UnifiedBinRow } from "@/server/wasty-actions";

function fillTone(fillPercent: number): "success" | "warning" | "danger" {
  if (fillPercent >= 85) return "danger";
  if (fillPercent >= 60) return "warning";
  return "success";
}

export function BinsClient({
  initialBins,
  provider,
}: {
  initialBins: UnifiedBinRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialBins);

  useEffect(() => {
    setRows(initialBins);
  }, [initialBins]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        location: row.location,
        type: row.type,
        fill: <StatusBadge label={`${row.fillPercent}% · ${row.status}`} tone={fillTone(row.fillPercent)} />,
        agent: row.agent,
      })),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Bins"
        description={
          provider !== "sqlite"
            ? "Public and society bins from the live API (GET /v1/bins)."
            : "No local SQLite bins table yet — switch to Firebase or AWS for live data."
        }
        actions={
          <ActionDialogButton
            label="Add / edit bin"
            title="Add or edit bin"
            description={
              provider !== "sqlite"
                ? "Creates or updates a bin via POST /v1/bins."
                : "Requires the Firebase or AWS provider."
            }
            submitLabel="Save bin"
            successMessage="Bin saved"
            fields={[
              { name: "id", label: "Bin ID (leave blank to create new)", placeholder: "auto-generated" },
              { name: "location", label: "Location", required: true, placeholder: "Street / society" },
              {
                name: "type",
                label: "Type",
                type: "select",
                required: true,
                options: [
                  { label: "Dry", value: "Dry" },
                  { label: "Wet", value: "Wet" },
                  { label: "Mixed", value: "Mixed" },
                  { label: "E-waste", value: "E-waste" },
                ],
              },
              { name: "agent", label: "Bin agent", placeholder: "Optional" },
              { name: "fillPercent", label: "Fill %", type: "number", defaultValue: "0" },
              {
                name: "status",
                label: "Status",
                type: "select",
                defaultValue: "ok",
                options: [
                  { label: "OK / empty", value: "ok" },
                  { label: "Filling", value: "filling" },
                  { label: "Full", value: "full" },
                  { label: "Damaged / inactive", value: "damaged" },
                ],
              },
              { name: "lat", label: "Latitude", placeholder: "12.9716" },
              { name: "lng", label: "Longitude", placeholder: "77.5946" },
            ]}
            onSubmit={async (values) => {
              const fillPercent = Number(values.fillPercent) || 0;
              const lat = values.lat ? Number(values.lat) : undefined;
              const lng = values.lng ? Number(values.lng) : undefined;
              const result = await upsertBin({
                id: values.id || undefined,
                location: values.location,
                type: values.type,
                agent: values.agent || undefined,
                fillPercent,
                status: values.status,
                lat,
                lng,
              });
              setRows((prev) => {
                const existingIndex = prev.findIndex((row) => row.id === result.id);
                const nextRow: UnifiedBinRow = {
                  id: result.id,
                  location: values.location,
                  type: values.type,
                  agent: values.agent || "—",
                  fillPercent,
                  status: values.status || "ok",
                  lat: lat ?? null,
                  lng: lng ?? null,
                };
                if (existingIndex >= 0) {
                  const next = [...prev];
                  next[existingIndex] = nextRow;
                  return next;
                }
                return [nextRow, ...prev];
              });
              startTransition(() => router.refresh());
            }}
          />
        }
      />

      <SimpleDataTable
        title="Bin master"
        description={provider !== "sqlite" ? "Source: live API (bins)" : "Source: SQLite"}
        columns={[
          { key: "location", header: "Location" },
          { key: "type", header: "Type" },
          { key: "fill", header: "Fill" },
          { key: "agent", header: "Bin agent" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
