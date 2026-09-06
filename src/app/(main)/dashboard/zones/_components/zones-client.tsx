"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { saveServiceZone } from "@/server/wasty-actions";

export type ZoneRow = {
  id: string;
  name: string;
  slots: string;
  partners: number;
  surge: string;
  status: string;
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes("under") || s.includes("danger")) {
    return <StatusBadge label={status} tone="danger" />;
  }
  if (s.includes("healthy") || s === "active") {
    return <StatusBadge label={status} tone="success" />;
  }
  return <StatusBadge label={status} tone="muted" />;
}

export function ZonesClient({
  initialZones,
  provider,
}: {
  initialZones: ZoneRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialZones);

  useEffect(() => {
    setRows(initialZones);
  }, [initialZones]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        partners: String(row.partners),
        slots: row.slots || "—",
        surge: row.surge || "Off",
        status: statusBadge(row.status),
      })),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Zones & Slots"
        description={
          provider === "firebase"
            ? "Service areas and pickup slots from Firestore `zones` — shared with booking logic."
            : "No local SQLite zones table yet — switch to Firebase for live zone data."
        }
        actions={
          <>
            <ActionDialogButton
              label="Edit zone"
              title="Edit service zone"
              description={
                provider === "firebase" ? "Updates an existing zone doc by ID." : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Save zone"
              successMessage="Zone updated"
              fields={[
                {
                  name: "id",
                  label: "Zone",
                  type: "select",
                  required: true,
                  options:
                    rows.length > 0
                      ? rows.map((row) => ({ label: row.name, value: row.id }))
                      : [{ label: "No zones yet — add one first", value: "" }],
                },
                { name: "name", label: "Display name", required: true },
                {
                  name: "slots",
                  label: "Open slots",
                  required: true,
                  placeholder: "09:00 · 11:00 · 15:00",
                },
                { name: "partners", label: "Partners available", type: "number", defaultValue: "0" },
                { name: "surge", label: "Surge multiplier", placeholder: "Off or 1.4x", defaultValue: "Off" },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: [
                    { label: "Healthy", value: "healthy" },
                    { label: "Understaffed", value: "understaffed" },
                  ],
                  defaultValue: "healthy",
                },
              ]}
              onSubmit={async (values) => {
                if (!values.id) throw new Error("Choose a zone first");
                await saveServiceZone({
                  id: values.id,
                  name: values.name,
                  slots: values.slots,
                  partners: Number(values.partners) || 0,
                  surge: values.surge || "Off",
                  status: values.status || "healthy",
                });
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.id
                      ? {
                          ...row,
                          name: values.name,
                          slots: values.slots,
                          partners: Number(values.partners) || 0,
                          surge: values.surge || "Off",
                          status: values.status || "healthy",
                        }
                      : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Add zone"
              title="Add service zone"
              description={
                provider === "firebase" ? "Creates a new doc in Firestore `zones`." : "Requires the Firebase provider."
              }
              submitLabel="Add zone"
              successMessage="Zone saved"
              fields={[
                { name: "name", label: "Zone name", required: true, placeholder: "Jayanagar" },
                {
                  name: "slots",
                  label: "Default slots",
                  required: true,
                  defaultValue: "10:00 · 14:00",
                },
                { name: "partners", label: "Partners available", type: "number", defaultValue: "2" },
                { name: "surge", label: "Surge", defaultValue: "Off" },
              ]}
              onSubmit={async (values) => {
                const result = await saveServiceZone({
                  name: values.name,
                  slots: values.slots,
                  partners: Number(values.partners) || 0,
                  surge: values.surge || "Off",
                  status: "healthy",
                });
                setRows((prev) => [
                  {
                    id: result.id,
                    name: values.name,
                    slots: values.slots,
                    partners: Number(values.partners) || 0,
                    surge: values.surge || "Off",
                    status: "healthy",
                  },
                  ...prev,
                ]);
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <SimpleDataTable
        title="Service zones"
        description={provider === "firebase" ? "Source: Firestore (zones)" : "Source: SQLite (empty)"}
        columns={[
          { key: "name", header: "Zone" },
          { key: "partners", header: "Partners" },
          { key: "slots", header: "Open slots" },
          { key: "surge", header: "Surge" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
