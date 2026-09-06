"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { Inbox, Siren } from "lucide-react";

import { ActionDialogButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/simple-data-table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { acknowledgeSos, closeSupportTicket, replyToOps, type UnifiedTicketRow } from "@/server/wasty-actions";

function toneFor(status: string, type: string): StatusTone {
  const s = status.toLowerCase();
  const t = type.toLowerCase();
  if (t.includes("sos") || s.includes("urgent")) return "danger";
  if (s.includes("open") || s.includes("ack")) return "warning";
  if (s.includes("closed") || s.includes("resolved")) return "success";
  return "muted";
}

export function SupportClient({
  initialTickets,
  provider,
}: {
  initialTickets: UnifiedTicketRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState<string | null>(initialTickets[0]?.id ?? null);

  useEffect(() => {
    setRows(initialTickets);
    if (!initialTickets.find((t) => t.id === selectedId)) {
      setSelectedId(initialTickets[0]?.id ?? null);
    }
  }, [initialTickets, selectedId]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);
  const openSos = rows.find((row) => row.type.toUpperCase().includes("SOS") && row.status !== "resolved" && row.status !== "closed");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const score = (row: UnifiedTicketRow) => {
        const t = row.type.toLowerCase();
        const s = row.status.toLowerCase();
        if (t.includes("sos") && s !== "closed" && s !== "resolved") return 0;
        if (s === "open" || s === "urgent") return 1;
        if (s === "acked" || s === "acknowledged") return 2;
        return 3;
      };
      return score(a) - score(b);
    });
  }, [rows]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ops inbox"
        description={
          provider === "firebase"
            ? "Mailbox-style triage for Firestore opsReports — pick a thread, acknowledge or close."
            : "Local SQLite inbox with the same layout."
        }
        actions={
          <>
            <ActionDialogButton
              label="Reply"
              title="Reply to report"
              description={
                provider === "firebase"
                  ? "Posts an admin reply on the opsReports doc and marks it acked."
                  : "Requires the Firebase provider."
              }
              submitLabel="Send reply"
              successMessage="Reply sent"
              fields={[
                {
                  name: "reportId",
                  label: "Report",
                  type: "select",
                  required: true,
                  defaultValue: selected?.id,
                  options:
                    rows.length > 0
                      ? rows.map((row) => ({ label: `${row.type} · ${row.id.slice(0, 8)}`, value: row.id }))
                      : [{ label: "No reports", value: "" }],
                },
                {
                  name: "note",
                  label: "Reply note",
                  type: "textarea",
                  required: true,
                  placeholder: "We're on it — partner rerouted",
                },
              ]}
              onSubmit={async (values) => {
                if (!values.reportId) throw new Error("Choose a report first");
                await replyToOps(values.reportId, values.note);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === values.reportId ? { ...row, status: "acknowledged", note: values.note } : row,
                  ),
                );
                setSelectedId(values.reportId);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Acknowledge SOS"
              title="Acknowledge SOS"
              variant="destructive"
              submitLabel="Acknowledge"
              successMessage="SOS acknowledged"
              confirmMessage={openSos ? `Ack ${openSos.id}?` : "No open SOS right now."}
              fields={[
                {
                  name: "note",
                  label: "Response note",
                  type: "textarea",
                  required: true,
                  defaultValue: "Tow dispatched · ETA 20 min",
                },
              ]}
              onSubmit={async (values) => {
                if (!openSos) return false;
                await acknowledgeSos(openSos.id, values.note);
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === openSos.id ? { ...row, status: "acknowledged", note: values.note } : row,
                  ),
                );
                setSelectedId(openSos.id);
                startTransition(() => router.refresh());
              }}
            />
            <ActionDialogButton
              label="Close selected"
              title="Close report"
              variant="outline"
              submitLabel="Close"
              successMessage="Report closed"
              fields={[
                {
                  name: "reportId",
                  label: "Report",
                  type: "select",
                  required: true,
                  defaultValue: selected?.id,
                  options:
                    rows.filter((row) => row.status !== "resolved" && row.status !== "closed").length > 0
                      ? rows
                          .filter((row) => row.status !== "resolved" && row.status !== "closed")
                          .map((row) => ({ label: `${row.type} · ${row.id.slice(0, 8)}`, value: row.id }))
                      : [{ label: "No open reports", value: "" }],
                },
                {
                  name: "note",
                  label: "Resolution note",
                  type: "textarea",
                  placeholder: "Resolved — partner assisted",
                },
              ]}
              onSubmit={async (values) => {
                if (!values.reportId) throw new Error("Choose a report first");
                await closeSupportTicket(values.reportId, values.note);
                setRows((prev) =>
                  prev.map((row) => (row.id === values.reportId ? { ...row, status: "resolved" } : row)),
                );
                startTransition(() => router.refresh());
              }}
            />
          </>
        }
      />

      <div className="grid min-h-[520px] overflow-hidden rounded-2xl border xl:grid-cols-[340px_1fr]">
        <aside className="border-b bg-muted/20 xl:border-r xl:border-b-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Inbox className="size-4" />
            <div>
              <p className="font-medium text-sm">Inbox</p>
              <p className="text-muted-foreground text-xs">{rows.length} threads</p>
            </div>
          </div>
          <ScrollArea className="h-[480px]">
            {sorted.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground text-sm">No reports yet.</p>
            ) : (
              sorted.map((row) => {
                const active = row.id === selectedId;
                const isSos = row.type.toLowerCase().includes("sos");
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "w-full border-b px-4 py-3 text-left transition",
                      active ? "bg-background" : "hover:bg-background/70",
                      isSos && row.status !== "closed" && row.status !== "resolved" ? "border-l-2 border-l-destructive" : "",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isSos ? <Siren className="size-3.5 text-destructive" /> : null}
                          <p className="truncate font-medium text-sm">{row.type}</p>
                        </div>
                        <p className="truncate text-muted-foreground text-xs">{row.fromLabel}</p>
                        <p className="mt-1 line-clamp-2 text-sm">{row.summary}</p>
                      </div>
                      <StatusBadge label={row.status} tone={toneFor(row.status, row.type)} />
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </aside>

        <main className="flex flex-col bg-background">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-10 text-muted-foreground text-sm">
              Select a report to read it.
            </div>
          ) : (
            <>
              <div className="border-b px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-muted-foreground text-xs">{selected.id}</p>
                    <h2 className="font-semibold text-xl">{selected.type}</h2>
                    <p className="text-muted-foreground text-sm">From {selected.fromLabel}</p>
                  </div>
                  <StatusBadge label={selected.status} tone={toneFor(selected.status, selected.type)} />
                </div>
              </div>
              <div className="flex-1 space-y-4 p-5">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-muted-foreground text-xs">Summary</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{selected.summary}</p>
                </div>
                {selected.note ? (
                  <div className="rounded-2xl border p-4">
                    <p className="text-muted-foreground text-xs">Ops note</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{selected.note}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No ops note yet — acknowledge or close to add one.</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(null)}>
                    Back to list
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
