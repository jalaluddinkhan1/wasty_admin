"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { saveBuyer } from "@/server/wasty-actions";
import { toast } from "sonner";

type BuyerDoc = Record<string, unknown> & { id: string };

function toneForKyc(kyc: string) {
  const s = kyc.toLowerCase();
  if (s === "verified" || s === "approved") return "success" as const;
  if (s === "pending") return "warning" as const;
  if (s === "rejected") return "danger" as const;
  return "default" as const;
}

function toneForBuyerStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "active") return "success" as const;
  if (s === "onboarding") return "muted" as const;
  return "default" as const;
}

function coerceBuyer(row: BuyerDoc) {
  return {
    id: row.id,
    name: String(row.name ?? "—"),
    type: String(row.type ?? "—"),
    streams: String(row.streams ?? "—"),
    volume: String(row.volume ?? "—"),
    kyc: String(row.kyc ?? "pending"),
    status: String(row.status ?? "onboarding"),
    contractVolume: row.contractVolume != null ? String(row.contractVolume) : null,
    contractPrice: row.contractPrice != null ? String(row.contractPrice) : null,
  };
}

export function BuyersClient({
  initialBuyers,
  provider,
}: {
  initialBuyers: BuyerDoc[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(() => initialBuyers.map(coerceBuyer));

  useEffect(() => {
    setRows(initialBuyers.map(coerceBuyer));
  }, [initialBuyers]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        streams: row.streams,
        volume: row.volume,
        kyc: <StatusBadge label={row.kyc} tone={toneForKyc(row.kyc)} />,
        status: <StatusBadge label={row.status} tone={toneForBuyerStatus(row.status)} />,
      })),
    [rows],
  );

  const buyerOptions =
    rows.length > 0
      ? rows.map((row) => ({ label: row.name, value: row.id }))
      : [{ label: "No buyers loaded", value: "" }];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Buyers"
        description={
          provider === "firebase"
            ? "Recyclers, manufacturers, and aggregators who buy recovered material via P2P or offtake contracts."
            : "No local SQLite buyers — switch to Firebase for the buyer directory."
        }
        actions={
          <>
            <ActionDialogButton
              label="Contracts"
              title="Offtake contract"
              description={
                provider === "firebase"
                  ? "Save monthly offtake terms on the buyer record."
                  : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Save contract"
              successMessage="Contract saved"
              fields={[
                {
                  name: "buyerId",
                  label: "Buyer",
                  type: "select",
                  required: true,
                  options: buyerOptions,
                },
                { name: "volume", label: "Monthly tons", type: "number", required: true, defaultValue: "20" },
                { name: "price", label: "Price band (₹/kg)", required: true, defaultValue: "18–28" },
              ]}
              onSubmit={async (values) => {
                const buyer = rows.find((row) => row.id === values.buyerId);
                if (!buyer) throw new Error("Choose a buyer first");
                await saveBuyer({
                  id: buyer.id,
                  name: buyer.name,
                  type: buyer.type,
                  streams: buyer.streams,
                  volume: buyer.volume,
                  kyc: buyer.kyc,
                  status: buyer.status,
                  contractVolume: `${values.volume} t`,
                  contractPrice: values.price,
                });
                toast.message(`${buyer.name}: ${values.volume} t/mo @ ${values.price}`);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Add buyer"
              title="Add buyer"
              description={provider === "firebase" ? "Creates buyers/{id} in Firestore." : "Requires the Firebase provider."}
              submitLabel="Add buyer"
              successMessage="Buyer added"
              fields={[
                { name: "name", label: "Company name", required: true },
                {
                  name: "type",
                  label: "Type",
                  type: "select",
                  required: true,
                  options: [
                    { label: "Recycler", value: "Recycler" },
                    { label: "Aggregator", value: "Aggregator" },
                    { label: "Manufacturer", value: "Manufacturer" },
                  ],
                },
                { name: "streams", label: "Buys", required: true, placeholder: "PET · Paper" },
                { name: "volume", label: "Monthly offtake", required: true, defaultValue: "10 t" },
              ]}
              onSubmit={async (values) => {
                const result = await saveBuyer({
                  name: values.name,
                  type: values.type,
                  streams: values.streams,
                  volume: values.volume,
                });
                if (!result?.ok) return false;
                setRows((prev) => [
                  {
                    id: result.id,
                    name: values.name,
                    type: values.type,
                    streams: values.streams,
                    volume: values.volume,
                    kyc: "pending",
                    status: "onboarding",
                    contractVolume: null,
                    contractPrice: null,
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
        title="Buyer directory"
        description={provider === "firebase" ? "Source: Firestore (buyers)" : "Source: SQLite (empty)"}
        columns={[
          { key: "name", header: "Buyer" },
          { key: "type", header: "Type" },
          { key: "streams", header: "Buys" },
          { key: "volume", header: "Monthly offtake" },
          { key: "kyc", header: "KYC" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
