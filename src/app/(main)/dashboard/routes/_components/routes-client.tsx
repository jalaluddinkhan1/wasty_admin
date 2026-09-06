"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { MapPinned, Navigation, Route as RouteIcon } from "lucide-react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createDailyRoute,
  type UnifiedPartnerRow,
  type UnifiedPickupRow,
  type UnifiedRouteRow,
} from "@/server/wasty-actions";

function toneFor(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("accept") || s.includes("active")) return "success";
  if (s.includes("offer") || s.includes("pending")) return "warning";
  if (s.includes("reject") || s.includes("cancel")) return "danger";
  return "muted";
}

export function RoutesClient({
  initialRoutes,
  partners,
  jobs,
  provider,
}: {
  initialRoutes: UnifiedRouteRow[];
  partners: UnifiedPartnerRow[];
  jobs: UnifiedPickupRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRoutes);
  const [selectedStops, setSelectedStops] = useState<string[]>([]);

  useEffect(() => {
    setRows(initialRoutes);
  }, [initialRoutes]);

  const unassignedJobs = useMemo(
    () => jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled"),
    [jobs],
  );

  function toggleStop(id: string) {
    setSelectedStops((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Routes & Dispatch"
        description={
          provider === "firebase"
            ? "Map-style dispatch board — pick stops, offer a beat to a partner."
            : "Switch to Firebase to persist daily routes. Layout preview still works locally."
        }
        actions={
          <ActionDialogButton
            label="Offer selected route"
            title="Offer daily route"
            description={`${selectedStops.length} stop(s) selected. Partner accepts in their app.`}
            submitLabel="Create route"
            successMessage="Route offered to partner"
            fields={[
              {
                name: "partnerId",
                label: "Partner",
                type: "select",
                required: true,
                options:
                  partners.length > 0
                    ? partners.map((partner) => ({ label: partner.name, value: partner.id }))
                    : [{ label: "No partners yet", value: "" }],
              },
              {
                name: "stopIds",
                label: "Stops (auto-filled from selection)",
                type: "textarea",
                required: true,
                defaultValue: selectedStops.join(", "),
              },
              { name: "estimatedEarn", label: "Estimated ₹ (optional)", type: "number" },
              { name: "estimatedKg", label: "Estimated kg (optional)", type: "number" },
            ]}
            onSubmit={async (values) => {
              if (!values.partnerId) throw new Error("Choose a partner first");
              const stopIds = values.stopIds
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);
              if (stopIds.length === 0) throw new Error("Select or enter at least one stop");

              const result = await createDailyRoute({
                partnerId: values.partnerId,
                stopIds,
                estimatedEarn: values.estimatedEarn ? Number(values.estimatedEarn) : undefined,
                estimatedKg: values.estimatedKg ? Number(values.estimatedKg) : undefined,
              });
              const partnerName = partners.find((p) => p.id === values.partnerId)?.name ?? values.partnerId;
              setRows((prev) => [
                {
                  id: result.id,
                  partnerId: values.partnerId,
                  partnerName,
                  status: "offered",
                  stopCount: stopIds.length,
                  estimatedEarn: values.estimatedEarn ? Number(values.estimatedEarn) : null,
                  estimatedKg: values.estimatedKg ? Number(values.estimatedKg) : null,
                  offeredAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              setSelectedStops([]);
              startTransition(() => router.refresh());
            }}
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="relative min-h-[420px] overflow-hidden rounded-2xl border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.75_0.12_145/_0.25),transparent_40%),radial-gradient(circle_at_80%_70%,oklch(0.7_0.1_230/_0.2),transparent_45%),linear-gradient(160deg,oklch(0.97_0.01_120),oklch(0.93_0.02_200))] dark:bg-[radial-gradient(circle_at_20%_20%,oklch(0.4_0.08_145/_0.35),transparent_40%),radial-gradient(circle_at_80%_70%,oklch(0.35_0.08_230/_0.3),transparent_45%),linear-gradient(160deg,oklch(0.22_0.02_240),oklch(0.18_0.02_200))]" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 70%, transparent) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between border-b bg-background/70 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <MapPinned className="size-4 text-primary" />
                <div>
                  <h2 className="font-medium text-sm">City stop map</h2>
                  <p className="text-muted-foreground text-xs">
                    Tap pins to build a route · {selectedStops.length} selected
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedStops([])}>
                Clear
              </Button>
            </div>

            <div className="relative flex-1 p-4">
              {unassignedJobs.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-background/50 p-8 text-muted-foreground text-sm backdrop-blur">
                  No open jobs to place on the map.
                </div>
              ) : (
                <div className="relative h-full min-h-[320px]">
                  {unassignedJobs.slice(0, 12).map((job, index) => {
                    const selected = selectedStops.includes(job.id);
                    const left = 8 + ((index * 17) % 78);
                    const top = 10 + ((index * 23) % 70);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => toggleStop(job.id)}
                        className={cn(
                          "absolute z-10 max-w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2.5 py-2 text-left shadow-md backdrop-blur transition",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/80 bg-background/90 hover:border-primary/50",
                        )}
                        style={{ left: `${left}%`, top: `${top}%` }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Navigation className="size-3.5 shrink-0" />
                          <span className="truncate font-medium text-xs">{job.userName}</span>
                        </div>
                        <p className={cn("mt-0.5 truncate text-[11px]", selected ? "opacity-90" : "text-muted-foreground")}>
                          {job.waste} · {job.slot || "slot TBA"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="rounded-2xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <RouteIcon className="size-4" />
              <h2 className="font-medium">Offered beats</h2>
            </div>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                  No routes offered yet.
                </p>
              ) : (
                rows.map((route) => (
                  <div key={route.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{route.partnerName}</p>
                        <p className="text-muted-foreground text-xs">
                          {route.stopCount} stops
                          {route.estimatedEarn != null ? ` · ₹${route.estimatedEarn}` : ""}
                          {route.estimatedKg != null ? ` · ${route.estimatedKg} kg` : ""}
                        </p>
                      </div>
                      <StatusBadge label={route.status} tone={toneFor(route.status)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <p className="font-medium">How to dispatch</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Select open job pins on the map</li>
              <li>Click Offer selected route</li>
              <li>Pick a partner — they accept in Partner app</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
