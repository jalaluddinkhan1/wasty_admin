"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton, ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable } from "@/components/simple-data-table";
import { statusBadge } from "@/components/status-from-db";
import { Button } from "@/components/ui/button";
import { generateBagBatch, voidBag, type UnifiedBagRow } from "@/server/wasty-actions";

import { BagQrSheet } from "./bag-qr-sheet";

export function BagsClient({
  initialBags,
  provider,
}: {
  initialBags: UnifiedBagRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialBags);
  const [sheetTitle, setSheetTitle] = useState("Printable bag QRs");
  const [sheetCodes, setSheetCodes] = useState<string[]>([]);

  useEffect(() => {
    setRows(initialBags);
  }, [initialBags]);

  const unusedCodes = useMemo(
    () => rows.filter((row) => row.status === "unassigned").map((row) => row.code),
    [rows],
  );

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        batch: row.batch,
        user: row.userName,
        category: row.category,
        status: statusBadge(row.status),
      })),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bag-qr-sheet, .bag-qr-sheet * { visibility: visible; }
          .bag-qr-sheet { position: absolute; inset: 0; }
        }
      `}</style>

      <PageHeader
        title="Bags & QR"
        description={
          provider === "firebase"
            ? "Free QR stickers (qrcode lib) → Firestore bagsRegistry. User app activates the code; partner app identifies it. Same code string in all three apps."
            : "Generates local QR stickers. Switch to Firebase so user + partner apps can identify the same codes."
        }
        actions={
          <>
            <ExportCsvButton
              label="Download CSV"
              filename="wasty-bag-batch.csv"
              headers={["QR / Bag ID", "Batch", "Linked user", "Last scan", "Status"]}
              rows={rows.map((row) => [row.code, row.batch, row.userName, row.category, row.status])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={unusedCodes.length === 0}
              onClick={() => {
                setSheetTitle(`Unused bag QRs · ${unusedCodes.length}`);
                setSheetCodes(unusedCodes);
              }}
            >
              Print unused QRs
            </Button>
            <ActionDialogButton
              label="Void code"
              title="Void bag code"
              description={
                provider === "firebase"
                  ? "Marks a bag code as void in Firestore — only unused codes can be voided."
                  : "Requires the Firebase provider — no local SQLite void action yet."
              }
              variant="destructive"
              submitLabel="Void code"
              successMessage="Bag code voided"
              fields={[
                {
                  name: "code",
                  label: "Bag code",
                  type: "select",
                  required: true,
                  options:
                    unusedCodes.length > 0
                      ? unusedCodes.map((code) => ({ label: code, value: code }))
                      : [{ label: "No unused codes", value: "" }],
                },
              ]}
              onSubmit={async (values) => {
                if (!values.code) throw new Error("Choose a bag code first");
                await voidBag(values.code);
                setRows((prev) =>
                  prev.map((row) => (row.code === values.code ? { ...row, status: "voided" } : row)),
                );
                setSheetCodes((prev) => prev.filter((code) => code !== values.code));
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Generate QR batch"
              title="Generate QR batch"
              description="Creates bagsRegistry records + printable QR stickers (free qrcode library). Each QR is the raw code — user app activates it, partner app identifies it."
              submitLabel="Generate & show QRs"
              successMessage="QR batch ready to print"
              fields={[
                { name: "count", label: "Number of stickers", type: "number", required: true, defaultValue: "10" },
                { name: "prefix", label: "Prefix", required: true, defaultValue: "WSTY-BAG" },
              ]}
              onSubmit={async (values) => {
                const result = await generateBagBatch({
                  count: Number(values.count) || 10,
                  prefix: values.prefix,
                });
                const issuedAt = new Date().toISOString();
                setRows((prev) => [
                  ...result.codes.map((code) => ({
                    id: code,
                    code,
                    batch: result.batch,
                    userName: "—",
                    category: "unused",
                    status: "unassigned",
                    createdAt: issuedAt,
                  })),
                  ...prev,
                ]);
                setSheetTitle(`Batch ${result.batch} · ${result.count} stickers`);
                setSheetCodes(result.codes);
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      {sheetCodes.length > 0 ? (
        <BagQrSheet title={sheetTitle} codes={sheetCodes} onClose={() => setSheetCodes([])} />
      ) : null}

      <SimpleDataTable
        title="Bag registry"
        description={
          provider === "firebase"
            ? "Click a row to reprint that sticker. Source: Firestore bagsRegistry"
            : "Click a row to reprint that sticker. Source: SQLite"
        }
        columns={[
          { key: "code", header: "QR / Bag ID" },
          { key: "batch", header: "Batch" },
          { key: "user", header: "Linked user" },
          { key: "category", header: "Last scan" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
        onRowClick={(row) => {
          const code = String(row.code ?? row.id);
          setSheetTitle(`Sticker ${code}`);
          setSheetCodes([code]);
        }}
      />
    </div>
  );
}
