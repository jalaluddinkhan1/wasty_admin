"use client";

import { useMemo, useState } from "react";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditRow = {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  createdAt: string | null;
};

export function GovAuditClient({
  rows,
  provider,
}: {
  rows: AuditRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        r.actor.toLowerCase().includes(q) ||
        r.target.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Audit Log"
        description={
          provider === "firebase"
            ? "Full adminAudit trail including citizen report triage actions."
            : "Demo audit entries."
        }
        actions={
          <ExportCsvButton
            label="Export CSV"
            filename="admin-audit.csv"
            headers={["ID", "Action", "Actor", "Target", "Detail", "Created"]}
            rows={filtered.map((r) => [r.id, r.action, r.actor, r.target, r.detail, r.createdAt ?? ""])}
          />
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Filter action, actor, target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No audit entries.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">{row.createdAt?.slice(0, 16) ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell>{row.actor}</TableCell>
                    <TableCell className="font-mono text-xs">{row.target}</TableCell>
                    <TableCell className="max-w-md truncate">{row.detail}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
