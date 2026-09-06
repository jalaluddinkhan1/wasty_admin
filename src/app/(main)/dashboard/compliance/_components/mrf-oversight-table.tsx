import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MrfOversightRow } from "@/lib/analytics/types";

function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

function toneForMrf(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.includes("run") || value.includes("active")) return "success";
  if (value.includes("maint") || value.includes("pause")) return "warning";
  if (value.includes("stop") || value.includes("down")) return "danger";
  return "muted";
}

export function MrfOversightTable({ facilities }: { facilities: MrfOversightRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MRF-wise processing</CardTitle>
        <CardDescription>Inbound tonnage, processed output, and recovery at each facility.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {facilities.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">No MRF facilities recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inbound</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Recovery</TableHead>
                <TableHead className="text-right">Households</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.zone}</TableCell>
                  <TableCell>{row.capacity}</TableCell>
                  <TableCell>
                    <StatusBadge label={row.status} tone={toneForMrf(row.status)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatKg(row.inboundKg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKg(row.processedKg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.recoveryRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.householdsServed.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
