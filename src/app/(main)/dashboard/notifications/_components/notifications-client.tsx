"use client";

import { useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sendPush } from "@/server/wasty-actions";

const TARGET_OPTIONS = [
  { label: "All users", value: "all_users" },
  { label: "All partners", value: "all_partners" },
  { label: "Single user", value: "user" },
  { label: "Single partner", value: "partner" },
];

type PushHistoryRow = {
  id: string;
  target: string;
  uid: string | null;
  title: string;
  body: string;
  createdAt: string | null;
  createdBy: string;
};

export function NotificationsClient({
  provider,
  history,
}: {
  provider: "sqlite" | "firebase" | "aws";
  history: PushHistoryRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Push notifications"
        description={
          provider === "firebase"
            ? "Writes inbox + activity feed, delivers device push via Cloud Function, and logs adminAudit."
            : "Requires the Firebase provider — push is not available on SQLite."
        }
        actions={
          provider === "firebase" ? (
            <ActionDialogButton
              label="Send push"
              title="Send push notification"
              description="Broadcast or target a single uid. Users see it in activity; partners in partners/{uid}/notifications."
              submitLabel="Send"
              successMessage="Notification sent"
              fields={[
                {
                  name: "target",
                  label: "Target",
                  type: "select",
                  required: true,
                  defaultValue: "all_users",
                  options: TARGET_OPTIONS,
                },
                {
                  name: "uid",
                  label: "UID (required for single user/partner)",
                  placeholder: "Firebase uid",
                },
                { name: "title", label: "Title", required: true, placeholder: "Pickup reminder" },
                {
                  name: "body",
                  label: "Body",
                  type: "textarea",
                  required: true,
                  placeholder: "Your slot is tomorrow at 10:00",
                },
              ]}
              onSubmit={async (values) => {
                const target = values.target as "all_users" | "all_partners" | "user" | "partner";
                if ((target === "user" || target === "partner") && !values.uid?.trim()) {
                  throw new Error("UID is required for single-target pushes");
                }
                await sendPush({
                  target,
                  uid: values.uid?.trim() || undefined,
                  title: values.title,
                  body: values.body,
                });
                startTransition(() => router.refresh());
              }}
            />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Send history</CardTitle>
          <CardDescription>Recent pushes from adminAudit (newest first).</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pushes sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Body</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.target}
                      {row.uid ? ` · ${row.uid.slice(0, 8)}…` : ""}
                    </TableCell>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{row.body}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
