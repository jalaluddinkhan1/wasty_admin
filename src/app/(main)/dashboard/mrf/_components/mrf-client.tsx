"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { Factory, Scale, Truck, Warehouse } from "lucide-react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { StatCards } from "@/components/stat-cards";
import { createMrfInbound, saveMrfFacility } from "@/server/wasty-actions";

type FacilityDoc = Record<string, unknown> & { id: string };
type InboundDoc = Record<string, unknown> & { id: string };

function toneForFacilityStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "running") return "success" as const;
  if (s === "maintenance") return "warning" as const;
  return "default" as const;
}

function toneForInboundStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "received") return "success" as const;
  if (s === "weighing") return "warning" as const;
  return "default" as const;
}

function coerceFacility(row: FacilityDoc) {
  return {
    id: row.id,
    name: String(row.name ?? "—"),
    zone: String(row.zone ?? "—"),
    capacity: String(row.capacity ?? "—"),
    inbound: String(row.inbound ?? "0 t"),
    status: String(row.status ?? "running"),
  };
}

function coerceInbound(row: InboundDoc) {
  return {
    id: row.id,
    facility: String(row.facility ?? "—"),
    source: String(row.source ?? "—"),
    weight: String(row.weight ?? "—"),
    bags: String(row.bags ?? "—"),
    status: String(row.status ?? "received"),
  };
}

export function MrfClient({
  initialFacilities,
  initialInbound,
  provider,
}: {
  initialFacilities: FacilityDoc[];
  initialInbound: InboundDoc[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [facilities, setFacilities] = useState(() => initialFacilities.map(coerceFacility));
  const [inbound, setInbound] = useState(() => initialInbound.map(coerceInbound));

  useEffect(() => {
    setFacilities(initialFacilities.map(coerceFacility));
    setInbound(initialInbound.map(coerceInbound));
  }, [initialFacilities, initialInbound]);

  const facilityRows: DataRow[] = useMemo(
    () =>
      facilities.map((row) => ({
        id: row.id,
        name: row.name,
        zone: row.zone,
        capacity: row.capacity,
        inbound: row.inbound,
        status: <StatusBadge label={row.status} tone={toneForFacilityStatus(row.status)} />,
      })),
    [facilities],
  );

  const inboundRows: DataRow[] = useMemo(
    () =>
      inbound.map((row) => ({
        id: row.id,
        facility: row.facility,
        source: row.source,
        weight: row.weight,
        bags: row.bags,
        status: <StatusBadge label={row.status} tone={toneForInboundStatus(row.status)} />,
      })),
    [inbound],
  );

  const facilityOptions =
    facilities.length > 0
      ? facilities.map((row) => ({ label: row.name, value: row.name }))
      : [{ label: "No facilities loaded", value: "" }];

  const runningCount = facilities.filter((row) => row.status.toLowerCase() === "running").length;
  const utilization =
    facilities.length > 0 ? `${Math.round((runningCount / facilities.length) * 100)}%` : "—";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="MRF Facilities"
        description={
          provider === "firebase"
            ? "Material Recovery Facilities — inbound trucks, unload QR, capacity, and outbound loads from Firestore."
            : "No local SQLite MRF tables — switch to Firebase for live facility and inbound data."
        }
        actions={
          <>
            <ActionDialogButton
              label="Log inbound"
              title="Log inbound load"
              description={
                provider === "firebase"
                  ? "Record a truck or partner dump at the weighbridge."
                  : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Log inbound"
              successMessage="Inbound load logged"
              fields={[
                {
                  name: "facility",
                  label: "Facility",
                  type: "select",
                  required: true,
                  options: facilityOptions,
                },
                { name: "source", label: "Source / route", required: true, placeholder: "RT-25 · Partner" },
                { name: "weight", label: "Weight", required: true, placeholder: "500 kg" },
                { name: "bags", label: "Bags / lots", required: true, placeholder: "24 bags" },
              ]}
              onSubmit={async (values) => {
                const result = await createMrfInbound({
                  facility: values.facility,
                  source: values.source,
                  weight: values.weight,
                  bags: values.bags,
                });
                if (!result?.ok) return false;
                setInbound((prev) => [
                  {
                    id: result.id,
                    facility: values.facility,
                    source: values.source,
                    weight: values.weight,
                    bags: values.bags,
                    status: "received",
                  },
                  ...prev,
                ]);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Add facility"
              title="Add MRF facility"
              description={provider === "firebase" ? "Creates or updates mrfFacilities/{id}." : "Requires the Firebase provider."}
              submitLabel="Add facility"
              successMessage="Facility added"
              fields={[
                { name: "name", label: "Name", required: true, placeholder: "North MRF" },
                { name: "zone", label: "Zone", required: true },
                { name: "capacity", label: "Capacity / day", required: true, defaultValue: "15 t" },
              ]}
              onSubmit={async (values) => {
                const result = await saveMrfFacility({
                  name: values.name,
                  zone: values.zone,
                  capacity: values.capacity,
                });
                if (!result?.ok) return false;
                setFacilities((prev) => [
                  {
                    id: result.id,
                    name: values.name,
                    zone: values.zone,
                    capacity: values.capacity,
                    inbound: "0 t",
                    status: "running",
                  },
                  ...prev,
                ]);
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <StatCards
        items={[
          { title: "Facilities", value: String(facilities.length), hint: "Registered MRF sites", icon: Warehouse },
          { title: "Inbound loads", value: String(inbound.length), hint: "Recent dock events", icon: Truck },
          { title: "Running", value: String(runningCount), hint: "Active lines", icon: Scale },
          { title: "Line utilization", value: utilization, hint: "Running / total facilities", icon: Factory },
        ]}
      />

      <SimpleDataTable
        title="Facilities"
        description={provider === "firebase" ? "Source: Firestore (mrfFacilities)" : "Source: SQLite (empty)"}
        columns={[
          { key: "name", header: "Facility" },
          { key: "zone", header: "Zone" },
          { key: "capacity", header: "Capacity / day" },
          { key: "inbound", header: "Inbound today" },
          { key: "status", header: "Status" },
        ]}
        rows={facilityRows}
      />

      <SimpleDataTable
        title="Inbound dock"
        description={
          provider === "firebase"
            ? "Unload events linked to partner routes and bag QR batches."
            : "Connect Firebase to log inbound loads."
        }
        columns={[
          { key: "id", header: "Inbound ID" },
          { key: "facility", header: "Facility" },
          { key: "source", header: "Source" },
          { key: "weight", header: "Weight" },
          { key: "bags", header: "Bags / lots" },
          { key: "status", header: "Status" },
        ]}
        rows={inboundRows}
      />
    </div>
  );
}
