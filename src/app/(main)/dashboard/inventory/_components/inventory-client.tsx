"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { Boxes, PackageMinus, Recycle, Scale } from "lucide-react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { StatCards } from "@/components/stat-cards";
import { createP2pTrade, saveMaterialLot } from "@/server/wasty-actions";

type LotDoc = Record<string, unknown> & { id: string };

function toneForLotStatus(status: string) {
  const s = status.toLowerCase();
  if (s.includes("ready") || s.includes("sell")) return "success" as const;
  if (s.includes("listed")) return "default" as const;
  if (s.includes("reserved")) return "warning" as const;
  if (s.includes("residue") || s.includes("reject")) return "muted" as const;
  return "default" as const;
}

function coerceLot(row: LotDoc) {
  return {
    id: row.id,
    lot: String(row.lot ?? row.id),
    stream: String(row.stream ?? "—"),
    grade: String(row.grade ?? "—"),
    qty: String(row.qty ?? "—"),
    facility: String(row.facility ?? "—"),
    status: String(row.status ?? "ready to sell"),
  };
}

export function InventoryClient({
  initialLots,
  provider,
}: {
  initialLots: LotDoc[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(() => initialLots.map(coerceLot));

  useEffect(() => {
    setRows(initialLots.map(coerceLot));
  }, [initialLots]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        lot: row.lot,
        stream: row.stream,
        grade: row.grade,
        qty: row.qty,
        facility: row.facility,
        status: <StatusBadge label={row.status} tone={toneForLotStatus(row.status)} />,
      })),
    [rows],
  );

  const sellableLots = rows.filter((row) => row.stream.toLowerCase() !== "reject");
  const rejectLots = rows.filter((row) => row.stream.toLowerCase() === "reject" || row.status.toLowerCase().includes("residue"));

  const lotOptions =
    sellableLots.length > 0
      ? sellableLots.map((row) => ({ label: `${row.lot} · ${row.stream}`, value: row.lot }))
      : [{ label: "No sellable lots", value: "" }];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Material Inventory"
        description={
          provider === "firebase"
            ? "Post-sort stock by stream and grade — ready for P2P sale or outbound to buyers."
            : "No local SQLite inventory — switch to Firebase for material lots."
        }
        actions={
          <>
            <ActionDialogButton
              label="Create lot"
              title="Create material lot"
              description={
                provider === "firebase"
                  ? "Register a sorted lot after AI / manual segregation."
                  : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Create lot"
              successMessage="Lot created"
              fields={[
                { name: "lot", label: "Lot ID", required: true, placeholder: "LOT-PET-200" },
                {
                  name: "stream",
                  label: "Stream",
                  type: "select",
                  required: true,
                  options: [
                    { label: "PET", value: "PET" },
                    { label: "Paper / cardboard", value: "Paper / cardboard" },
                    { label: "Metal", value: "Metal" },
                    { label: "E-waste", value: "E-waste" },
                  ],
                },
                {
                  name: "grade",
                  label: "Grade",
                  type: "select",
                  required: true,
                  options: [
                    { label: "A", value: "A" },
                    { label: "B", value: "B" },
                    { label: "C", value: "C" },
                  ],
                },
                { name: "qty", label: "Quantity", required: true, defaultValue: "1.0 t" },
                { name: "facility", label: "Facility", required: true, placeholder: "East MRF" },
              ]}
              onSubmit={async (values) => {
                const result = await saveMaterialLot({
                  lot: values.lot,
                  stream: values.stream,
                  grade: values.grade,
                  qty: values.qty,
                  facility: values.facility,
                });
                if (!result?.ok) return false;
                setRows((prev) => [
                  {
                    id: result.id,
                    lot: values.lot,
                    stream: values.stream,
                    grade: values.grade,
                    qty: values.qty,
                    facility: values.facility,
                    status: "ready to sell",
                  },
                  ...prev,
                ]);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="List on P2P"
              title="List lot on P2P"
              description={
                provider === "firebase"
                  ? "Create a P2P listing from inventory, then open the trade board."
                  : "Requires the Firebase provider."
              }
              submitLabel="List & open P2P"
              successMessage="Lot listed on P2P"
              fields={[
                {
                  name: "lot",
                  label: "Lot",
                  type: "select",
                  required: true,
                  options: lotOptions,
                },
                { name: "ask", label: "Ask price (₹/kg)", type: "number", required: true, defaultValue: "20" },
              ]}
              onSubmit={async (values) => {
                const lotRow = rows.find((row) => row.lot === values.lot);
                if (!lotRow) throw new Error("Choose a lot first");
                await createP2pTrade({
                  seller: `${lotRow.facility} · ${lotRow.lot}`,
                  material: `${lotRow.stream} · Grade ${lotRow.grade}`,
                  qty: lotRow.qty,
                  ask: `₹${values.ask}/kg`,
                });
                await saveMaterialLot({
                  id: lotRow.id,
                  lot: lotRow.lot,
                  stream: lotRow.stream,
                  grade: lotRow.grade,
                  qty: lotRow.qty,
                  facility: lotRow.facility,
                  status: "listed on P2P",
                });
                setRows((prev) =>
                  prev.map((row) => (row.lot === values.lot ? { ...row, status: "listed on P2P" } : row)),
                );
                startTransition(() => router.refresh());
                router.push("/dashboard/p2p");
              }}
            />
          </>
        }
      />

      <StatCards
        items={[
          { title: "Lots on-hand", value: String(rows.length), hint: "Across all streams", icon: Scale },
          { title: "Sellable lots", value: String(sellableLots.length), hint: "Non-reject inventory", icon: Boxes },
          { title: "Reject / residue", value: String(rejectLots.length), hint: "Landfill diversion pending", icon: PackageMinus },
          { title: "Listed on P2P", value: String(rows.filter((r) => r.status.toLowerCase().includes("listed")).length), hint: "Active listings source", icon: Recycle },
        ]}
      />

      <SimpleDataTable
        title="Sorted lots"
        description={provider === "firebase" ? "Source: Firestore (materialLots)" : "Source: SQLite (empty)"}
        columns={[
          { key: "lot", header: "Lot ID" },
          { key: "stream", header: "Stream" },
          { key: "grade", header: "Grade" },
          { key: "qty", header: "Qty" },
          { key: "facility", header: "Facility" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
