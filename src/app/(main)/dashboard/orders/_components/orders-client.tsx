"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton, ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { setOrderStatus } from "@/server/wasty-actions";

export type OrderRow = {
  id: string;
  userId: string;
  userName: string;
  total: string;
  totalValue: number;
  status: string;
  paymentMethod: string;
  itemCount: number;
  createdAt: string | null;
};

const STATUS_OPTIONS = [
  { label: "Placed", value: "placed" },
  { label: "Packing", value: "packing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

function toneFor(status: string) {
  const s = status.toLowerCase();
  if (s === "cancelled") return "danger" as const;
  if (s === "delivered") return "success" as const;
  if (s === "shipped" || s === "packing") return "warning" as const;
  return "muted" as const;
}

export function OrdersClient({
  initialOrders,
  provider,
}: {
  initialOrders: OrderRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialOrders);

  useEffect(() => {
    setRows(initialOrders);
  }, [initialOrders]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        user: row.userName,
        total: row.total,
        items: String(row.itemCount),
        payment: row.paymentMethod,
        status: <StatusBadge label={row.status} tone={toneFor(row.status)} />,
        created: row.createdAt ? new Date(row.createdAt).toLocaleString() : "—",
      })),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Shop orders"
        description={
          provider !== "sqlite"
            ? "Marketplace orders from the live API — advance fulfillment status from here."
            : "No local SQLite orders table yet — switch to Firebase or AWS for live order data."
        }
        actions={
          <>
            <ExportCsvButton
              filename="wasty-orders.csv"
              headers={["Order ID", "User", "Total", "Items", "Payment", "Status", "Created"]}
              rows={rows.map((row) => [
                row.id,
                row.userName,
                row.total,
                String(row.itemCount),
                row.paymentMethod,
                row.status,
                row.createdAt ?? "",
              ])}
            />
            <ActionDialogButton
              label="Update status"
              title="Update order status"
              description={
                provider !== "sqlite"
                  ? "Updates order status via POST /v1/orders/{orderId}/status."
                  : "Requires the Firebase or AWS provider."
              }
              submitLabel="Save status"
              successMessage="Order status updated"
              fields={[
                {
                  name: "orderKey",
                  label: "Order",
                  type: "select",
                  required: true,
                  options:
                    rows.length > 0
                      ? rows.map((row) => ({
                          label: `${row.id.slice(0, 8)} · ${row.userName} · ${row.total}`,
                          value: `${row.userId}::${row.id}`,
                        }))
                      : [{ label: "No orders loaded", value: "" }],
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
                const [userId, orderId] = values.orderKey.split("::");
                if (!userId || !orderId) throw new Error("Choose an order first");
                await setOrderStatus(userId, orderId, values.status);
                setRows((prev) =>
                  prev.map((row) => (row.id === orderId && row.userId === userId ? { ...row, status: values.status } : row)),
                );
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <SimpleDataTable
        title="Recent orders"
        description={provider !== "sqlite" ? "Source: live API (orders)" : "Source: SQLite (empty)"}
        columns={[
          { key: "user", header: "Customer" },
          { key: "total", header: "Total" },
          { key: "items", header: "Items" },
          { key: "payment", header: "Payment" },
          { key: "status", header: "Status" },
          { key: "created", header: "Created" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
