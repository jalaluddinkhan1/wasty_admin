"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { persistAppConfig } from "@/server/wasty-actions";
import { toast } from "sonner";

export type AppConfigState = {
  demoMode: boolean;
  marketplaceEnabled: boolean;
  instantPayout: boolean;
  classifierEnabled: boolean;
  partnerMinVersion: string;
  userMinVersion: string;
  updateBanner: string;
};

const FLAG_META: { id: keyof Pick<AppConfigState, "demoMode" | "marketplaceEnabled" | "instantPayout" | "classifierEnabled">; label: string; hint: string }[] = [
  { id: "demoMode", label: "Demo mode", hint: "Partner & user apps can run without Firebase" },
  { id: "marketplaceEnabled", label: "Marketplace", hint: "Show shop in user app" },
  { id: "instantPayout", label: "Instant partner payout", hint: "Allow instant withdrawals" },
  { id: "classifierEnabled", label: "On-device classifier", hint: "Waste scan ML in user app" },
];

export function ConfigClient({
  initialConfig,
  provider,
}: {
  initialConfig: AppConfigState;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [config, setConfig] = useState(initialConfig);

  async function save(patch: Partial<AppConfigState>) {
    const next = { ...config, ...patch };
    setConfig(next);
    try {
      if (provider === "firebase") {
        await persistAppConfig(patch);
        toast.success("Config saved to Firestore");
        startTransition(() => router.refresh());
      } else {
        toast.message("Preview only — connect Firebase to persist config/app");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save config");
      setConfig(config);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="App Config"
        description={
          provider === "firebase"
            ? "Feature flags and version gates from Firestore config/app — shared with user and partner apps."
            : "Showing SQLite defaults — set WASTY_DATA_PROVIDER=firebase to read/write Firestore config/app."
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
            <CardDescription>
              {provider === "firebase" ? "Saved to Firestore config/app on toggle." : "Local preview until Firebase is active."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {FLAG_META.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor={flag.id}>{flag.label}</Label>
                  <p className="text-muted-foreground text-sm">{flag.hint}</p>
                </div>
                <Switch
                  id={flag.id}
                  checked={config[flag.id]}
                  disabled={pending}
                  onCheckedChange={(checked) => save({ [flag.id]: checked })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update banner & min versions</CardTitle>
            <CardDescription>Force-update gates and optional banner copy for mobile apps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="partner-min">Partner app min version</Label>
              <Input
                id="partner-min"
                value={config.partnerMinVersion}
                onChange={(event) => setConfig((prev) => ({ ...prev, partnerMinVersion: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-min">User app min version</Label>
              <Input
                id="user-min"
                value={config.userMinVersion}
                onChange={(event) => setConfig((prev) => ({ ...prev, userMinVersion: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="update-banner">Update banner</Label>
              <Textarea
                id="update-banner"
                value={config.updateBanner}
                placeholder="Optional message shown in apps when update is required"
                onChange={(event) => setConfig((prev) => ({ ...prev, updateBanner: event.target.value }))}
              />
            </div>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                save({
                  partnerMinVersion: config.partnerMinVersion,
                  userMinVersion: config.userMinVersion,
                  updateBanner: config.updateBanner,
                })
              }
            >
              Save version settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
