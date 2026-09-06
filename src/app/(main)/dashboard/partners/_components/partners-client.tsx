"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable } from "@/components/simple-data-table";
import { statusBadge } from "@/components/status-from-db";
import { approvePartnerKyc, invitePartner, patchPartner, rejectPartnerKyc, setPartnerAvailability, type UnifiedPartnerRow } from "@/server/wasty-actions";

export function PartnersClient({
  initialPartners,
  provider,
}: {
  initialPartners: UnifiedPartnerRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialPartners);

  useEffect(() => {
    setRows(initialPartners);
  }, [initialPartners]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        zone: row.zone,
        status: statusBadge(row.status),
        kyc: statusBadge(row.kyc),
        rating: row.rating,
      })),
    [rows],
  );

  const pendingKyc = rows.find((row) => row.kyc === "pending");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Partners"
        description={
          provider === "firebase"
            ? "Partner roster from Firestore `partners`. Approving grants the `partner` custom claim."
            : "Partner roster from SQLite. Invites and KYC updates are saved to disk."
        }
        actions={
          <>
            <ActionDialogButton
              label="Suspend"
              title="Suspend / offline partner"
              description={
                provider === "firebase"
                  ? "Sets partner availability in Firestore (offline or suspended)."
                  : "Requires the Firebase provider."
              }
              variant="destructive"
              submitLabel="Update status"
              successMessage="Partner status updated"
              fields={[
                {
                  name: "uid",
                  label: "Partner",
                  type: "select",
                  required: true,
                  options:
                    rows.length > 0
                      ? rows.map((row) => ({ label: `${row.name} · ${row.zone}`, value: row.id }))
                      : [{ label: "No partners loaded", value: "" }],
                },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  required: true,
                  options: [
                    { label: "Offline", value: "offline" },
                    { label: "Suspended", value: "suspended" },
                    { label: "Available", value: "available" },
                  ],
                },
              ]}
              onSubmit={async (values) => {
                if (!values.uid) throw new Error("Choose a partner first");
                await setPartnerAvailability(values.uid, values.status);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.uid ? { ...row, status: values.status.replace(/_/g, " ") } : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Edit zone / vehicle"
              title="Edit partner profile"
              description={
                provider === "firebase"
                  ? "Patch service area, vehicle, or role on the partner doc."
                  : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Save changes"
              successMessage="Partner profile updated"
              fields={[
                {
                  name: "uid",
                  label: "Partner",
                  type: "select",
                  required: true,
                  options:
                    rows.length > 0
                      ? rows.map((row) => ({ label: row.name, value: row.id }))
                      : [{ label: "No partners loaded", value: "" }],
                },
                { name: "serviceArea", label: "Service area / zone", placeholder: "Koramangala" },
                { name: "vehicle", label: "Vehicle", placeholder: "EV van · KA-01-AB-1234" },
                {
                  name: "role",
                  label: "Role",
                  type: "select",
                  options: [
                    { label: "— keep current —", value: "" },
                    { label: "Driver", value: "Driver" },
                    { label: "Collector", value: "Collector" },
                    { label: "Warehouse", value: "Warehouse" },
                    { label: "Bin agent", value: "Bin agent" },
                    { label: "Team lead", value: "Team lead" },
                  ],
                },
              ]}
              onSubmit={async (values) => {
                if (!values.uid) throw new Error("Choose a partner first");
                const patch: { serviceArea?: string; vehicle?: string; role?: string } = {};
                if (values.serviceArea) patch.serviceArea = values.serviceArea;
                if (values.vehicle) patch.vehicle = values.vehicle;
                if (values.role) patch.role = values.role;
                if (Object.keys(patch).length === 0) throw new Error("Enter at least one field to update");
                await patchPartner(values.uid, patch);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.uid
                      ? {
                          ...row,
                          zone: patch.serviceArea ?? row.zone,
                          role: patch.role ?? row.role,
                        }
                      : row,
                  ),
                );
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="KYC queue"
              title="Review KYC"
              description={pendingKyc ? `Approve documents for ${pendingKyc.name}?` : "No pending KYC right now."}
              variant="outline"
              submitLabel="Approve"
              successMessage="Partner approved"
              confirmMessage={pendingKyc ? `Approve pending KYC for ${pendingKyc.name}?` : "Nothing to approve."}
              onSubmit={async () => {
                if (!pendingKyc) return false;
                await approvePartnerKyc(pendingKyc.id);
                setRows((prev) => prev.map((row) => (row.id === pendingKyc.id ? { ...row, kyc: "approved" } : row)));
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Reject KYC"
              title="Reject partner"
              variant="destructive"
              description={pendingKyc ? `Reject documents for ${pendingKyc.name}?` : "No pending KYC right now."}
              submitLabel="Reject"
              successMessage="Partner rejected"
              fields={
                pendingKyc
                  ? [
                      {
                        name: "reason",
                        label: "Reason",
                        type: "textarea",
                        placeholder: "Docs unreadable — please re-upload",
                      },
                    ]
                  : []
              }
              onSubmit={async (values) => {
                if (!pendingKyc) return false;
                await rejectPartnerKyc(pendingKyc.id, values.reason);
                setRows((prev) => prev.map((row) => (row.id === pendingKyc.id ? { ...row, kyc: "rejected" } : row)));
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Invite partner"
              title="Invite partner"
              description={
                provider === "firebase"
                  ? "Creates a pending partners/{id} document in Firestore until the partner completes onboarding."
                  : "Creates a partner row in SQLite."
              }
              submitLabel="Send invite"
              successMessage={
                provider === "firebase" ? "Partner invite created in Firestore" : "Partner invite saved to database"
              }
              fields={[
                { name: "name", label: "Name", required: true, placeholder: "Full name" },
                { name: "phone", label: "Phone", required: true, placeholder: "+91…" },
                {
                  name: "role",
                  label: "Role",
                  type: "select",
                  required: true,
                  options: [
                    { label: "Driver", value: "Driver" },
                    { label: "Collector", value: "Collector" },
                    { label: "Warehouse", value: "Warehouse" },
                    { label: "Bin agent", value: "Bin agent" },
                    { label: "Team lead", value: "Team lead" },
                  ],
                },
                { name: "zone", label: "Zone", required: true, placeholder: "Koramangala" },
              ]}
              onSubmit={async (values) => {
                const result = await invitePartner({
                  name: values.name,
                  role: values.role,
                  zone: values.zone,
                  phone: values.phone,
                });
                if (!result.ok) return false;
                setRows((prev) => [
                  {
                    id: result.id,
                    name: values.name,
                    role: values.role,
                    zone: values.zone,
                    phone: values.phone,
                    status: "invited",
                    kyc: "pending",
                    rating: "—",
                    createdAt: new Date().toISOString(),
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
        title="Partner roster"
        description={provider === "firebase" ? "Source: Firestore (partners)" : "Source: SQLite"}
        columns={[
          { key: "name", header: "Name" },
          { key: "role", header: "Role" },
          { key: "zone", header: "Zone" },
          { key: "status", header: "Availability" },
          { key: "kyc", header: "KYC" },
          { key: "rating", header: "Rating" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
