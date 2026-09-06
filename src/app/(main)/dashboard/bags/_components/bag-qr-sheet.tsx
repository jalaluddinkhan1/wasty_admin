"use client";

import { Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { BagQrSticker, downloadBagQrPng } from "./bag-qr-sticker";

export function BagQrSheet({
  title,
  codes,
  onClose,
}: {
  title: string;
  codes: string[];
  onClose: () => void;
}) {
  if (codes.length === 0) return null;

  return (
    <section className="bag-qr-sheet rounded-xl border bg-card p-4 print:border-0 print:p-0 print:shadow-none">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-semibold text-lg">{title}</h2>
          <p className="max-w-xl text-muted-foreground text-sm">
            Each QR encodes the raw bag code (e.g. <code>WSTY-BAG-…-001</code>). Paste or print these
            stickers — the user app camera reads that exact string.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print stickers
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
        {codes.map((code) => (
          <div key={code} className="space-y-2">
            <BagQrSticker code={code} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full print:hidden"
              onClick={() => void downloadBagQrPng(code)}
            >
              Download PNG
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
