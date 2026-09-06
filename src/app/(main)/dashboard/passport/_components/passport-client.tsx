"use client";

import { useState } from "react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { lookupPassport } from "@/server/wasty-actions";
import { toast } from "sonner";

type PassportRecord = {
  id: string;
  title: string;
  timeline: { step: string; detail: string; tone: "success" | "default" | "warning" | "muted" | "danger" }[];
};

export function PassportClient({ provider }: { provider: "sqlite" | "firebase" | "aws" }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<PassportRecord | null>(null);
  const [loading, setLoading] = useState(false);

  async function openPassport(raw: string, options?: { silent?: boolean }) {
    const trimmed = raw.trim();
    if (!trimmed) {
      toast.error("Enter a bag QR, pickup ID, or P2P listing ID");
      return false;
    }
    if (provider !== "firebase") {
      toast.error("Passport lookup requires the Firebase provider");
      return false;
    }
    setLoading(true);
    try {
      const result = await lookupPassport(trimmed);
      if (!result) {
        toast.error("No passport found for that ID");
        setActive(null);
        return false;
      }
      setActive(result);
      setQuery(result.id);
      if (!options?.silent) toast.success(`Opened passport ${result.id}`);
      return true;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Waste Passport"
        description={
          provider === "firebase"
            ? "End-to-end chain of custody from bag QR → pickup → MRF → AI sort → inventory → P2P buyer."
            : "Connect Firebase to look up chain-of-custody records."
        }
        actions={
          <ActionDialogButton
            label="Search"
            title="Search passport"
            description={
              provider === "firebase"
                ? "Lookup by bag QR, pickup ID, or P2P listing."
                : "Requires the Firebase provider."
            }
            submitLabel="Open"
            successMessage="Passport opened"
            fields={[
              {
                name: "query",
                label: "ID",
                required: true,
                placeholder: "WSTY-BAG-… or job ID",
                defaultValue: query,
              },
            ]}
            onSubmit={async (values) => openPassport(values.query, { silent: true })}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
          <CardDescription>
            {provider === "firebase"
              ? "Search by bag code, job ID, or P2P listing document ID."
              : "Firebase provider required for live passport lookup."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="e.g. WSTY-BAG-88421 or job ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void openPassport(query);
            }}
            className="sm:max-w-md"
            disabled={loading}
          />
          <Button type="button" variant="outline" onClick={() => void openPassport(query)} disabled={loading}>
            {loading ? "Searching…" : "Open passport"}
          </Button>
        </CardContent>
      </Card>

      {active ? (
        <Card>
          <CardHeader>
            <CardTitle>{active.title}</CardTitle>
            <CardDescription>Chain of custody from Firestore.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {active.timeline.map((item, index) => (
              <div key={`${item.step}-${index}`} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted font-medium text-xs">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm">{item.step}</p>
                    <StatusBadge label={item.tone === "muted" ? "pending" : "logged"} tone={item.tone} />
                  </div>
                  <p className="text-muted-foreground text-sm">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
