"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton, ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adjustUserPoints, getUserActivity, suspendUser, type UnifiedUserRow } from "@/server/wasty-actions";
import { toast } from "sonner";

type ActivitySummary = {
  pickups: unknown[];
  orders: unknown[];
};

export function UsersClient({
  initialUsers,
  provider,
}: {
  initialUsers: UnifiedUserRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialUsers);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityUid, setActivityUid] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);

  useEffect(() => {
    setRows(initialUsers);
  }, [initialUsers]);

  const tableRows: DataRow[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        name: row.name || "—",
        email: row.email || "—",
        phone: row.phone ?? "—",
        points: row.points.toLocaleString(),
        wasteDivertedKg: `${row.wasteDivertedKg.toFixed(1)} kg`,
        createdAt: row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—",
      })),
    [rows],
  );

  async function loadActivity(uid: string) {
    if (!uid) {
      toast.error("Choose a user first");
      return;
    }
    setActivityLoading(true);
    try {
      const data = await getUserActivity(uid);
      setActivity(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load activity");
      setActivity(null);
    } finally {
      setActivityLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Users"
        description={
          provider === "firebase"
            ? "End-users from Firestore `users`, with points/wallet balances joined from users/{uid}/wallet/main."
            : "No local SQLite users table yet — switch to Firebase (WASTY_DATA_PROVIDER=firebase) to see live end-users."
        }
        actions={
          <>
            <ExportCsvButton
              filename="wasty-users.csv"
              headers={["User ID", "Name", "Email", "Phone", "Points", "Waste diverted", "Joined"]}
              rows={rows.map((row) => [
                row.id,
                row.name,
                row.email,
                row.phone ?? "",
                String(row.points),
                `${row.wasteDivertedKg}`,
                row.createdAt ?? "",
              ])}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActivityUid(rows[0]?.id ?? "");
                setActivity(null);
                setActivityOpen(true);
              }}
              disabled={rows.length === 0}
            >
              View activity
            </Button>
            <ActionDialogButton
              label="Suspend user"
              title="Suspend / unsuspend user"
              description={
                provider === "firebase"
                  ? "Sets suspended flag on the user doc in Firestore."
                  : "Requires the Firebase provider."
              }
              variant="destructive"
              submitLabel="Apply"
              successMessage="User suspension updated"
              fields={[
                {
                  name: "uid",
                  label: "User",
                  type: "select",
                  required: true,
                  options:
                    rows.length > 0
                      ? rows.map((row) => ({ label: `${row.name} · ${row.email || row.id}`, value: row.id }))
                      : [{ label: "No users loaded yet", value: "" }],
                },
                {
                  name: "action",
                  label: "Action",
                  type: "select",
                  required: true,
                  options: [
                    { label: "Suspend", value: "suspend" },
                    { label: "Unsuspend", value: "unsuspend" },
                  ],
                },
                {
                  name: "reason",
                  label: "Reason (optional)",
                  type: "textarea",
                  placeholder: "Policy violation",
                },
              ]}
              onSubmit={async (values) => {
                if (!values.uid) throw new Error("Choose a user first");
                const suspended = values.action === "suspend";
                await suspendUser(values.uid, suspended, values.reason || undefined);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Adjust points"
              title="Adjust user points"
              description={
                provider === "firebase"
                  ? "Writes to users/{uid}/wallet/main and logs an adminAudit trail entry."
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
                    rows.length > 0
                      ? rows.map((row) => ({ label: `${row.name} · ${row.email || row.id}`, value: row.id }))
                      : [{ label: "No users loaded yet", value: "" }],
                },
                { name: "delta", label: "Points (+/-)", required: true, placeholder: "100 or -50" },
                {
                  name: "reason",
                  label: "Reason",
                  type: "textarea",
                  required: true,
                  placeholder: "Pickup credit fix",
                },
              ]}
              onSubmit={async (values) => {
                if (!values.uid) throw new Error("Choose a user first");
                const delta = Number(values.delta);
                if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero point value");
                await adjustUserPoints(values.uid, delta, values.reason);
                setRows((prev) =>
                  prev.map((row) => (row.id === values.uid ? { ...row, points: row.points + delta } : row)),
                );
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <SimpleDataTable
        title="End users"
        description={provider === "firebase" ? "Source: Firestore (users)" : "Source: SQLite (no users table yet)"}
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "phone", header: "Phone" },
          { key: "points", header: "Points" },
          { key: "wasteDivertedKg", header: "Waste diverted" },
          { key: "createdAt", header: "Joined" },
        ]}
        rows={tableRows}
      />

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>User activity</DialogTitle>
            <DialogDescription>Recent pickups and orders from Firestore subcollections.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="activity-user">User</Label>
            <Select value={activityUid || undefined} onValueChange={setActivityUid}>
              <SelectTrigger id="activity-user" className="w-full">
                <SelectValue placeholder="Select user…" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name} · {row.email || row.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activity ? (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">{activity.pickups.length}</span> pickups ·{" "}
                <span className="font-medium">{activity.orders.length}</span> orders
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
                {JSON.stringify(activity, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {activityLoading ? "Loading…" : "Select a user and load activity."}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActivityOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!activityUid || activityLoading}
              onClick={() => loadActivity(activityUid)}
            >
              {activityLoading ? "Loading…" : "Load activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
