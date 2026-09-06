import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AreaOversightRow } from "@/lib/analytics/types";

function formatKg(kg: number) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

export function AreaOversightTable({ areas }: { areas: AreaOversightRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Area-wise service</CardTitle>
        <CardDescription>Household coverage, collection, and recovery by zone.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {areas.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">No zone activity in this window.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Households</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
                <TableHead className="text-right">Partners</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Recovered</TableHead>
                <TableHead className="text-right">Recovery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((row) => (
                <TableRow key={row.zoneId}>
                  <TableCell className="font-medium">{row.area}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.householdsServed.toLocaleString("en-IN")}
                    <span className="text-muted-foreground text-xs"> / {row.householdTarget.toLocaleString("en-IN")}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.coveragePct}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.partnersActive}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.jobsCompleted}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKg(row.collectedKg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKg(row.recoveredKg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.recoveryRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
