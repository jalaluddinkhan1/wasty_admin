"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable } from "@/components/simple-data-table";
import { statusBadge } from "@/components/status-from-db";
import { updateSellRequestStatus, type UnifiedSellRequestRow } from "@/server/wasty-actions";

const STATUS_OPTIONS = [
  { label: "Requested", value: "requested" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Collected", value: "collected" },
  { label: "Paid", value: "paid" },
  { label: "Cancelled", value: "cancelled" },
];

export function SellWasteClient({
  initialRequests,
  provider,
}: {
  initialRequests: UnifiedSellRequestRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRequests);

  useEffect(() => {
    setRows(initialRequests);
  }, [initialRequests]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        request: row.id.slice(0, 8),
        user: row.customerId,
        categories: row.categories,
        weight: row.totalWeightKg != null ? `${row.totalWeightKg} kg` : "—",
        amount: row.totalAmount != null ? `₹${row.totalAmount}` : "—",
        status: statusBadge(row.status),
      })),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Sell Waste"
        description={
          provider !== "sqlite"
            ? "Sell-waste requests from the live API (GET /v1/sell-requests)."
            : "No local SQLite sellRequests table yet — switch to Firebase or AWS for live data."
        }
        actions={
          <ActionDialogButton
            label="Update status"
            title="Update sell-waste request"
            description={
              provider !== "sqlite"
                ? "Updates status via PATCH /v1/sell-requests/{customerId}/{requestId}."
                : "Requires the Firebase or AWS provider."
            }
            submitLabel="Update"
            successMessage="Request updated"
            fields={[
              {
                name: "requestId",
                label: "Request",
                type: "select",
                required: true,
                options:
                  rows.length > 0
                    ? rows.map((row) => ({ label: `${row.id.slice(0, 8)} · ${row.customerId}`, value: row.id }))
                    : [{ label: "No sell requests yet", value: "" }],
              },
              {
                name: "status",
                label: "New status",
                type: "select",
                required: true,
                options: STATUS_OPTIONS,
              },
            ]}
            onSubmit={async (values) => {
              if (!values.requestId) throw new Error("Choose a request first");
              const request = rows.find((row) => row.id === values.requestId);
              if (!request) throw new Error("Request not found");
              await updateSellRequestStatus(request.customerId, request.id, values.status);
              setRows((prev) =>
                prev.map((row) => (row.id === request.id ? { ...row, status: values.status } : row)),
              );
              startTransition(() => router.refresh());
            }}
          />
        }
      />

      <SimpleDataTable
        title="Sell-waste requests"
        description={provider !== "sqlite" ? "Source: live API (sell-requests)" : "Source: SQLite"}
        columns={[
          { key: "request", header: "Request" },
          { key: "user", header: "User" },
          { key: "categories", header: "Categories" },
          { key: "weight", header: "Weight" },
          { key: "amount", header: "Amount" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
