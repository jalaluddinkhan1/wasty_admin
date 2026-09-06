"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { type DataRow, SimpleDataTable } from "@/components/simple-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ADMIN_TYPE_DESCRIPTIONS,
  ADMIN_TYPE_LABELS,
  ADMIN_TYPES,
  type AdminType,
  permissionsFor,
} from "@/lib/auth/permissions";
import { grantAdminAccess, createStaffAccount, revokeAdminAccess, setAdminType } from "@/server/wasty-actions";

export type AdminRow = {
  uid: string;
  email: string;
  adminType: string;
  status: string;
  createdAt: string | null;
  createdBy: string | null;
};

export type AuditRow = {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  createdAt: string | null;
};

export function RolesClient({
  admins,
  audit,
  provider,
}: {
  admins: AdminRow[];
  audit: AuditRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const adminTableRows: DataRow[] = useMemo(
    () =>
      admins.map((row) => ({
        id: row.uid,
        email: row.email,
        type: ADMIN_TYPE_LABELS[row.adminType as AdminType] ?? row.adminType,
        status: row.status,
        created: row.createdAt ? new Date(row.createdAt).toLocaleString() : "—",
      })),
    [admins],
  );

  const auditTableRows: DataRow[] = useMemo(
    () =>
      audit.map((row) => ({
        id: row.id,
        action: row.action,
        actor: row.actor,
        target: row.target,
        detail: row.detail,
        created: row.createdAt ? new Date(row.createdAt).toLocaleString() : "—",
      })),
    [audit],
  );

  async function changeType(uid: string, adminType: AdminType) {
    setPendingUid(uid);
    try {
      await Promise.resolve(setAdminType(uid, adminType));
      toast.success("Admin type updated. The user must sign in again to refresh claims.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update admin type");
    } finally {
      setPendingUid(null);
    }
  }

  async function revoke(uid: string) {
    setPendingUid(uid);
    try {
      await Promise.resolve(revokeAdminAccess(uid));
      toast.success("Admin access revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke access");
    } finally {
      setPendingUid(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Roles & access"
        description="Company owners create any staff account (owner, government, ops, support). Public self-signup is closed."
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionDialogButton
              label="Create account"
              title="Create staff account"
              description="Company owner creates login for any admin type. Wallet/payouts stay on the consumer and partner apps."
              submitLabel="Create"
              successMessage="Account created — they can sign in at /auth/v2/login"
              fields={[
                { name: "email", label: "Email", required: true, placeholder: "ops@city.gov" },
                { name: "password", label: "Temporary password", type: "password", required: true, placeholder: "min 8 characters" },
                {
                  name: "adminType",
                  label: "Account type",
                  type: "select",
                  required: true,
                  defaultValue: "ops_manager",
                  options: ADMIN_TYPES.map((type) => ({ value: type, label: ADMIN_TYPE_LABELS[type] })),
                },
              ]}
              onSubmit={async (values) => {
                await createStaffAccount({
                  email: values.email,
                  password: values.password,
                  adminType: values.adminType as AdminType,
                });
                router.refresh();
              }}
            />
            <ActionDialogButton
              label="Grant existing user"
              title="Grant admin access"
              description="The email must already exist in Firebase Auth. They keep using /auth/v2/login."
              submitLabel="Grant"
              successMessage="Admin access granted"
              fields={[
                { name: "email", label: "Email", required: true, placeholder: "official@example.com" },
                {
                  name: "adminType",
                  label: "Admin type",
                  type: "select",
                  required: true,
                  defaultValue: "government",
                  options: ADMIN_TYPES.map((type) => ({ value: type, label: ADMIN_TYPE_LABELS[type] })),
                },
              ]}
              onSubmit={async (values) => {
                await Promise.resolve(grantAdminAccess(values.email, values.adminType as AdminType));
              }}
            />
          </div>
        }
      />

      <Tabs defaultValue="admins">
        <TabsList>
          <TabsTrigger value="admins">Admins</TabsTrigger>
          <TabsTrigger value="matrix">Permission matrix</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="mt-4 space-y-4">
          <SimpleDataTable
            title="Admin roster"
            description={
              provider === "firebase"
                ? "Firebase Auth custom claims + Firestore admins collection"
                : "Local demo roster"
            }
            columns={[
              { key: "email", header: "Email" },
              { key: "type", header: "Type" },
              { key: "status", header: "Status" },
              { key: "created", header: "Since" },
            ]}
            rows={adminTableRows}
          />
          <div className="space-y-2">
            {admins.map((admin) => (
              <div
                key={admin.uid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">{admin.email || admin.uid}</p>
                  <p className="text-muted-foreground text-xs">{admin.uid}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    defaultValue={admin.adminType}
                    disabled={pendingUid === admin.uid || admin.status === "revoked"}
                    onValueChange={(value) => void changeType(admin.uid, value as AdminType)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADMIN_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ADMIN_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingUid === admin.uid || admin.status === "revoked"}
                    onClick={() => void revoke(admin.uid)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4 grid gap-4 md:grid-cols-2">
          {ADMIN_TYPES.map((type) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle>{ADMIN_TYPE_LABELS[type]}</CardTitle>
                <CardDescription>{ADMIN_TYPE_DESCRIPTIONS[type]}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {permissionsFor(type).map((permission) => (
                  <Badge key={permission} variant="outline">
                    {permission}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <SimpleDataTable
            title="Access activity"
            description={provider === "firebase" ? "Source: Firestore adminAudit" : "Demo audit entries"}
            columns={[
              { key: "action", header: "Action" },
              { key: "actor", header: "Actor" },
              { key: "target", header: "Target" },
              { key: "detail", header: "Detail" },
              { key: "created", header: "When" },
            ]}
            rows={auditTableRows}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
