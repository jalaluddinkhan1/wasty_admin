"use client";

import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ActionField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "textarea" | "select" | "password";
  options?: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: string;
};

type ActionDialogButtonProps = {
  label: string;
  title: string;
  description?: string;
  fields?: ActionField[];
  submitLabel?: string;
  successMessage?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  /** Confirm-only dialog with no fields */
  confirmMessage?: string;
  onSubmit?: (values: Record<string, string>) => void | boolean | Promise<void | boolean>;
  children?: ReactNode;
};

export function ActionDialogButton({
  label,
  title,
  description,
  fields = [],
  submitLabel = "Save",
  successMessage,
  variant = "default",
  size,
  confirmMessage,
  onSubmit,
  children,
}: ActionDialogButtonProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""])),
  );

  function resetValues() {
    setValues(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""])));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await onSubmit?.(values);
      if (result === false) return;
      toast.success(successMessage ?? `${title} completed`);
      setOpen(false);
      resetValues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetValues();
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button type="button" variant={variant} size={size}>
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {(description || confirmMessage) && (
              <DialogDescription>{description ?? confirmMessage}</DialogDescription>
            )}
          </DialogHeader>

          {fields.length > 0 ? (
            <div className="grid gap-3 py-2">
              {fields.map((field) => {
                const id = `${formId}-${field.name}`;
                if (field.type === "select" && field.options) {
                  return (
                    <div key={field.name} className="grid gap-1.5">
                      <Label htmlFor={id}>{field.label}</Label>
                      <Select
                        value={values[field.name] || undefined}
                        onValueChange={(value) =>
                          setValues((prev) => ({ ...prev, [field.name]: value ?? "" }))
                        }
                      >
                        <SelectTrigger id={id} className="w-full">
                          <SelectValue placeholder={field.placeholder ?? "Select…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <div key={field.name} className="grid gap-1.5">
                      <Label htmlFor={id}>{field.label}</Label>
                      <Textarea
                        id={id}
                        name={field.name}
                        required={field.required}
                        placeholder={field.placeholder}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                        }
                      />
                    </div>
                  );
                }

                return (
                  <div key={field.name} className="grid gap-1.5">
                    <Label htmlFor={id}>{field.label}</Label>
                    <Input
                      id={id}
                      name={field.name}
                      type={field.type ?? "text"}
                      required={field.required}
                      placeholder={field.placeholder}
                      autoComplete={field.type === "password" ? "new-password" : undefined}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant={variant === "destructive" ? "destructive" : "default"} disabled={pending}>
              {pending ? "Working…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

export function ExportCsvButton({
  label = "Export",
  filename,
  headers,
  rows,
  variant = "outline",
}: {
  label?: string;
  filename: string;
  headers: string[];
  rows: string[][];
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => {
        if (rows.length === 0) {
          toast.message("Nothing to export yet");
          return;
        }
        downloadCsv(filename, headers, rows);
      }}
    >
      {label}
    </Button>
  );
}
