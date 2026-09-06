"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable, StatusBadge } from "@/components/simple-data-table";
import { adjustUserPoints, upsertReward, type UnifiedRewardRow, type UnifiedUserRow } from "@/server/wasty-actions";

function rewardStatusBadge(row: UnifiedRewardRow) {
  if (row.stock === 0) return <StatusBadge label="out of stock" tone="muted" />;
  if (!row.active) return <StatusBadge label="inactive" tone="muted" />;
  return <StatusBadge label="active" tone="success" />;
}

export function RewardsClient({
  initialRewards,
  users,
  provider,
}: {
  initialRewards: UnifiedRewardRow[];
  users: UnifiedUserRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRewards);

  useEffect(() => {
    setRows(initialRewards);
  }, [initialRewards]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        cost: row.pointsCost.toLocaleString(),
        stock: row.stock == null ? "Unlimited" : String(row.stock),
        redeemed: String(row.redeemed),
        status: rewardStatusBadge(row),
      })),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Rewards & Points"
        description={
          provider === "firebase"
            ? "Reward catalog from Firestore `rewardsCatalog`; point adjustments write to users/{uid}/wallet/main."
            : "No local SQLite rewardsCatalog table yet — switch to Firebase (WASTY_DATA_PROVIDER=firebase) for live data."
        }
        actions={
          <>
            <ActionDialogButton
              label="Adjust points"
              title="Adjust user points"
              description={
                provider === "firebase"
                  ? "Manually grant or claw back points (logged to adminAudit)."
                  : "Requires the Firebase provider — no local SQLite wallet table yet."
              }
              variant="outline"
              submitLabel="Apply"
              successMessage="Points adjusted"
              fields={[
                {
                  name: "uid",
                  label: "User",
                  type: "select",
                  required: true,
                  options:
                    users.length > 0
                      ? users.map((user) => ({ label: `${user.name} · ${user.email || user.id}`, value: user.id }))
                      : [{ label: "No users loaded yet", value: "" }],
                },
                { name: "points", label: "Points (+/-)", required: true, placeholder: "100 or -50" },
                { name: "reason", label: "Reason", type: "textarea", required: true, placeholder: "Pickup credit fix" },
              ]}
              onSubmit={async (values) => {
                if (!values.uid) throw new Error("Choose a user first");
                const delta = Number(values.points);
                if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero point value");
                await adjustUserPoints(values.uid, delta, values.reason);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Add / edit reward"
              title="Add or edit reward"
              description={
                provider === "firebase"
                  ? "Writes to Firestore `rewardsCatalog`. Reuse an existing reward ID to edit it."
                  : "Requires the Firebase provider — no local SQLite rewardsCatalog table yet."
              }
              submitLabel="Save reward"
              successMessage="Reward saved"
              fields={[
                { name: "id", label: "Reward ID (leave blank to create new)", placeholder: "auto-generated" },
                { name: "name", label: "Reward name", required: true },
                { name: "pointsCost", label: "Points cost", type: "number", required: true, defaultValue: "500" },
                { name: "stock", label: "Stock (blank = unlimited)", type: "number" },
              ]}
              onSubmit={async (values) => {
                const pointsCost = Number(values.pointsCost) || 0;
                const stock = values.stock ? Number(values.stock) : undefined;
                const result = await upsertReward({
                  id: values.id || undefined,
                  name: values.name,
                  pointsCost,
                  stock,
                  active: true,
                });
                setRows((prev) => {
                  const existingIndex = prev.findIndex((row) => row.id === result.id);
                  const nextRow: UnifiedRewardRow = {
                    id: result.id,
                    name: values.name,
                    pointsCost,
                    stock: stock ?? null,
                    redeemed: existingIndex >= 0 ? prev[existingIndex].redeemed : 0,
                    active: true,
                  };
                  if (existingIndex >= 0) {
                    const next = [...prev];
                    next[existingIndex] = nextRow;
                    return next;
                  }
                  return [nextRow, ...prev];
                });
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <SimpleDataTable
        title="Reward catalog"
        description={provider === "firebase" ? "Source: Firestore (rewardsCatalog)" : "Source: SQLite"}
        columns={[
          { key: "name", header: "Reward" },
          { key: "cost", header: "Points" },
          { key: "stock", header: "Stock" },
          { key: "redeemed", header: "Redeemed" },
          { key: "status", header: "Status" },
        ]}
        rows={tableRows}
      />
    </div>
  );
}
