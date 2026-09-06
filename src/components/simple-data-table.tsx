"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type StatusTone = "default" | "success" | "warning" | "danger" | "muted";

const toneClass: Record<StatusTone, string> = {
  default: "",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({ label, tone = "default" }: { label: string; tone?: StatusTone }) {
  return (
    <Badge variant="outline" className={cn("border-transparent capitalize", toneClass[tone])}>
      {label}
    </Badge>
  );
}

export type DataColumn = {
  key: string;
  header: string;
  className?: string;
};

export type DataRow = Record<string, ReactNode> & { id: string };

export function SimpleDataTable({
  title,
  description,
  columns,
  rows,
  emptyMessage = "No records yet.",
  onRowClick,
}: {
  title: string;
  description?: string;
  columns: DataColumn[];
  rows: DataRow[];
  emptyMessage?: string;
  onRowClick?: (row: DataRow) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
