"use client";

import { useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ActionDialogButton, ExportCsvButton } from "@/components/action-dialog-button";
import { D3DonutChart } from "@/components/d3/donut-chart";
import { D3HorizontalBars } from "@/components/d3/radial";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CITIZEN_REPORT_STATUSES,
  type CitizenReportRow,
  type CitizenReportStatus,
} from "@/lib/government/types";
import { updateCitizenReportStatus } from "@/server/wasty-actions";

function toneFor(status: CitizenReportStatus): StatusTone {
  if (status === "escalated") return "danger";
  if (status === "resolved") return "success";
  if (status === "in_progress") return "warning";
  return "muted";
}

const ISSUE_TYPES = ["Missed Pickup", "Illegal Dumping", "Overflowing Bin", "Broken Bin", "Littering"];

export function CitizenReportsClient({
  initialReports,
  provider,
}: {
  initialReports: CitizenReportRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialReports);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (issueFilter !== "all" && row.issueType !== issueFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !row.userName.toLowerCase().includes(q) &&
          !row.area.toLowerCase().includes(q) &&
          !row.issueType.toLowerCase().includes(q) &&
          !row.notes.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, statusFilter, issueFilter, search]);

  async function triage(
    row: CitizenReportRow,
    status: CitizenReportStatus,
    note?: string,
  ) {
    await updateCitizenReportStatus(row.userId, row.id, status, note);
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id && r.userId === row.userId
          ? { ...r, status, govNotes: note ?? r.govNotes, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Citizen Reports"
        description={
          provider === "firebase"
            ? "Inbox from users/{uid}/reports — acknowledge, resolve, or escalate with notes."
            : "Demo citizen report inbox for triage workflow testing."
        }
        actions={
          <ExportCsvButton
            label="Export CSV"
            filename="citizen-reports.csv"
            headers={["ID", "Reporter", "Phone", "Issue", "Area", "Status", "Notes", "Gov notes", "Created"]}
            rows={filtered.map((r) => [
              r.id,
              r.userName,
              r.phone ?? "",
              r.issueType,
              r.area,
              r.status,
              r.notes,
              r.govNotes ?? "",
              r.createdAt ?? "",
            ])}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Issue types</CardTitle>
            <CardDescription>Complaint mix across the current inbox.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3DonutChart
              data={ISSUE_TYPES.map((type) => ({
                key: type,
                label: type,
                value: rows.filter((r) => r.issueType === type).length,
              }))}
              centerHint="reports"
              height={240}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Triage pipeline</CardTitle>
            <CardDescription>How many reports sit in each status.</CardDescription>
          </CardHeader>
          <CardContent>
            <D3HorizontalBars
              data={CITIZEN_REPORT_STATUSES.map((status) => ({
                key: status,
                label: status.replaceAll("_", " "),
                value: rows.filter((r) => r.status === status).length,
              }))}
              height={240}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search reporter, area, issue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {CITIZEN_REPORT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={issueFilter} onValueChange={setIssueFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Issue type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All issue types</SelectItem>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No reports match filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={`${row.userId}-${row.id}`}>
                    <TableCell>
                      <div className="font-medium">{row.issueType}</div>
                      <div className="text-muted-foreground text-xs">{row.createdAt?.slice(0, 10) ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{row.userName}</div>
                      <div className="text-muted-foreground text-xs">{row.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell>{row.area}</TableCell>
                    <TableCell>
                      <StatusBadge label={row.status.replaceAll("_", " ")} tone={toneFor(row.status)} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={row.notes}>
                      {row.notes}
                      {row.govNotes ? (
                        <div className="text-muted-foreground text-xs">Gov: {row.govNotes}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.status === "submitted" ? (
                          <ActionDialogButton
                            label="Acknowledge"
                            title="Acknowledge report"
                            size="sm"
                            variant="outline"
                            fields={[
                              {
                                name: "note",
                                label: "Note (optional)",
                                type: "textarea",
                                placeholder: "City desk acknowledged",
                              },
                            ]}
                            onSubmit={(values) => triage(row, "in_progress", values.note)}
                          />
                        ) : null}
                        {row.status !== "resolved" ? (
                          <ActionDialogButton
                            label="Resolve"
                            title="Resolve report"
                            size="sm"
                            variant="outline"
                            fields={[
                              {
                                name: "note",
                                label: "Resolution note",
                                type: "textarea",
                                required: true,
                              },
                            ]}
                            onSubmit={(values) => triage(row, "resolved", values.note)}
                          />
                        ) : null}
                        {row.status !== "escalated" && row.status !== "resolved" ? (
                          <ActionDialogButton
                            label="Escalate"
                            title="Escalate report"
                            size="sm"
                            variant="destructive"
                            fields={[
                              {
                                name: "note",
                                label: "Escalation reason",
                                type: "textarea",
                                required: true,
                              },
                            ]}
                            onSubmit={(values) => triage(row, "escalated", values.note)}
                          />
                        ) : null}
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/dashboard/compliance/households/${row.userId}`}>Profile</a>
                        </Button>
                      </div>
                    </TableCell>
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
