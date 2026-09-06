"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Banknote, IndianRupee, Wallet } from "lucide-react";

import { useRouter } from "next/navigation";

import { ActionDialogButton, ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { StatCards } from "@/components/stat-cards";
import { markPayoutSettled, type UnifiedPayoutRow } from "@/server/wasty-actions";

type SettlementsSummary = {
  totalAmount: number;
  settledAmount: number;
  pendingAmount: number;
  entryCount: number;
};

function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function SettlementsClient({
  initialEntries,
  summary,
  provider,
}: {
  initialEntries: UnifiedPayoutRow[];
  summary: SettlementsSummary;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialEntries);

  useEffect(() => {
    setRows(initialEntries);
  }, [initialEntries]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        partner: row.partnerName,
        job: row.jobId ?? "—",
        amount: formatInr(row.amount),
        amountKg: row.amountKg != null ? `${row.amountKg} kg` : "—",
        date: row.date ? new Date(row.date).toLocaleDateString() : "—",
        status: row.settled ? (
          <StatusBadge label="paid" tone="success" />
        ) : (
          <StatusBadge label="pending" tone="warning" />
        ),
      })),
    [rows],
  );

  const pendingEntries = rows.filter((row) => !row.settled);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Settlements"
        description={
          provider === "firebase"
            ? "Partner payouts from Firestore partners/{uid}/payoutEntries."
            : "No local SQLite payoutEntries table yet — switch to Firebase (WASTY_DATA_PROVIDER=firebase) for live data."
        }
        actions={
          <>
            <ExportCsvButton
              label="Export"
              filename="wasty-settlements.csv"
              headers={["Partner", "Job", "Amount", "Kg", "Date", "Settled"]}
              rows={rows.map((row) => [
                row.partnerName,
                row.jobId ?? "",
                String(row.amount),
                row.amountKg != null ? String(row.amountKg) : "",
                row.date ?? "",
                row.settled ? "yes" : "no",
              ])}
            />
            <ActionDialogButton
              label="Mark settled"
              title="Mark payout settled"
              description={
                provider === "firebase"
                  ? "Marks a single payout entry as paid."
                  : "Requires the Firebase provider — no local SQLite payoutEntries table yet."
              }
              submitLabel="Mark settled"
              successMessage="Payout marked settled"
              fields={[
                {
                  name: "entryId",
                  label: "Payout entry",
                  type: "select",
                  required: true,
                  options:
                    pendingEntries.length > 0
                      ? pendingEntries.map((row) => ({
                          label: `${row.partnerName} · ${formatInr(row.amount)}`,
                          value: row.id,
                        }))
                      : [{ label: "No pending payouts", value: "" }],
                },
              ]}
              onSubmit={async (values) => {
                if (!values.entryId) throw new Error("Choose a pending payout first");
                const entry = rows.find((row) => row.id === values.entryId);
                if (!entry) throw new Error("Payout entry not found");
                await markPayoutSettled(entry.partnerId, entry.id);
                setRows((prev) => prev.map((row) => (row.id === entry.id ? { ...row, settled: true } : row)));
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <StatCards
        items={[
          { title: "Pending payouts", value: formatInr(summary.pendingAmount), hint: `${pendingEntries.length} entries`, icon: IndianRupee },
          { title: "Settled total", value: formatInr(summary.settledAmount), hint: "Paid out so far", icon: Banknote },
          { title: "Total volume", value: formatInr(summary.totalAmount), hint: `${summary.entryCount} entries`, icon: Wallet },
          {
            title: "Settlement rate",
            value: summary.entryCount > 0 ? `${Math.round(((summary.entryCount - pendingEntries.length) / summary.entryCount) * 100)}%` : "0%",
            hint: "Of all entries settled",
            icon: Banknote,
          },
        ]}
      />

      <SimpleDataTable
        title="Payout entries"
        description={provider === "firebase" ? "Source: Firestore (payoutEntries)" : "Source: SQLite"}
        columns={[
          { key: "partner", header: "Partner" },
          { key: "job", header: "Job" },
          { key: "amount", header: "Amount" },
          { key: "amountKg", header: "Kg" },
          { key: "date", header: "Date" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
