"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { Handshake, IndianRupee, Scale, ShoppingBag } from "lucide-react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { StatCards } from "@/components/stat-cards";
import { createP2pTrade, resolveP2pTrade } from "@/server/wasty-actions";
import { toast } from "sonner";

type ListingDoc = Record<string, unknown> & { id: string };

function toneForListingStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "open") return "success" as const;
  if (s.includes("offer") || s.includes("escrow")) return "warning" as const;
  if (s.includes("disput")) return "danger" as const;
  if (s === "released" || s === "refunded" || s === "partial") return "success" as const;
  return "default" as const;
}

function coerceListing(row: ListingDoc) {
  return {
    id: row.id,
    seller: String(row.seller ?? "—"),
    material: String(row.material ?? "—"),
    qty: String(row.qty ?? "—"),
    ask: String(row.ask ?? "—"),
    status: String(row.status ?? "open"),
  };
}

export function P2pClient({
  initialListings,
  provider,
}: {
  initialListings: ListingDoc[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(() => initialListings.map(coerceListing));

  useEffect(() => {
    setRows(initialListings.map(coerceListing));
  }, [initialListings]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        seller: row.seller,
        material: row.material,
        qty: row.qty,
        ask: row.ask,
        status: <StatusBadge label={row.status} tone={toneForListingStatus(row.status)} />,
      })),
    [rows],
  );

  const disputed = rows.filter((row) => row.status.toLowerCase().includes("disput"));
  const openListings = rows.filter((row) => row.status.toLowerCase() === "open");

  const disputeOptions =
    disputed.length > 0
      ? disputed.map((row) => ({ label: `${row.id} · ${row.material}`, value: row.id }))
      : [{ label: "No disputed listings", value: "" }];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="P2P Trade"
        description={
          provider === "firebase"
            ? "Peer-to-peer waste marketplace — connect sellers to buyers with offers, QC, and escrow."
            : provider === "aws"
              ? "Listings are read-only on AWS until P2P write APIs are enabled."
              : "No local SQLite P2P listings — switch to Firebase for the trade board."
        }
        actions={
          provider === "firebase" || provider === "sqlite" ? (
          <>
            <ActionDialogButton
              label="Disputes"
              title="Resolve dispute"
              description={
                provider === "firebase"
                  ? "Review grade/weight disputes and release or refund escrow."
                  : "Requires the Firebase provider."
              }
              variant="outline"
              submitLabel="Resolve"
              successMessage="Dispute resolved"
              fields={[
                {
                  name: "listing",
                  label: "Disputed listing",
                  type: "select",
                  required: true,
                  options: disputeOptions,
                },
                {
                  name: "resolution",
                  label: "Resolution",
                  type: "select",
                  required: true,
                  options: [
                    { label: "Release to seller", value: "released" },
                    { label: "Refund buyer", value: "refunded" },
                    { label: "Partial settlement", value: "partial" },
                  ],
                },
                { name: "note", label: "Note", type: "textarea", required: true, placeholder: "QC decision…" },
              ]}
              onSubmit={async (values) => {
                if (!values.listing) throw new Error("Choose a disputed listing first");
                await resolveP2pTrade(values.listing, values.resolution, values.note);
                setRows((prev) =>
                  prev.map((row) => (row.id === values.listing ? { ...row, status: values.resolution } : row)),
                );
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="New listing"
              title="New P2P listing"
              description={provider === "firebase" ? "List waste or an MRF lot for buyers." : "Requires the Firebase provider."}
              submitLabel="Publish listing"
              successMessage="Listing published"
              fields={[
                { name: "seller", label: "Seller", required: true, placeholder: "User / MRF lot" },
                { name: "material", label: "Material", required: true, placeholder: "PET · Grade A" },
                { name: "qty", label: "Quantity", required: true, placeholder: "1.0 t" },
                { name: "ask", label: "Ask (₹/kg)", type: "number", required: true, defaultValue: "15" },
              ]}
              onSubmit={async (values) => {
                const result = await createP2pTrade({
                  seller: values.seller,
                  material: values.material,
                  qty: values.qty,
                  ask: `₹${values.ask}/kg`,
                });
                if (!result?.ok) return false;
                setRows((prev) => [
                  {
                    id: result.id,
                    seller: values.seller,
                    material: values.material,
                    qty: values.qty,
                    ask: `₹${values.ask}/kg`,
                    status: "open",
                  },
                  ...prev,
                ]);
                toast.message(`${result.id} is visible to buyers`);
                startTransition(() => router.refresh());
              }}
            />
          </>
          ) : null
        }
      />

      <StatCards
        items={[
          { title: "Active listings", value: String(rows.length), hint: "Seller + MRF surplus", icon: ShoppingBag },
          { title: "Open listings", value: String(openListings.length), hint: "Awaiting offers", icon: Handshake },
          { title: "Disputed", value: String(disputed.length), hint: "Needs resolution", icon: Scale },
          { title: "Board status", value: provider === "firebase" ? "Live" : "Offline", hint: "Data provider", icon: IndianRupee },
        ]}
      />

      <SimpleDataTable
        title="Listings"
        description={provider === "firebase" ? "Source: Firestore (p2pListings)" : "Source: SQLite (empty)"}
        columns={[
          { key: "id", header: "Listing" },
          { key: "seller", header: "Seller" },
          { key: "material", header: "Material" },
          { key: "qty", header: "Qty" },
          { key: "ask", header: "Ask price" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
