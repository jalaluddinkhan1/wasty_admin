import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type StatCardProps = {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  trend?: { value: string; direction: "up" | "down" };
};

export function StatCards({ items }: { items: StatCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>
                <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>{item.title}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">{item.value}</div>
                {item.trend ? (
                  <Badge variant={item.trend.direction === "down" ? "destructive" : "default"}>
                    {item.trend.direction === "up" ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {item.trend.value}
                  </Badge>
                ) : null}
              </div>
              {item.hint ? <p className="text-muted-foreground text-sm">{item.hint}</p> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
