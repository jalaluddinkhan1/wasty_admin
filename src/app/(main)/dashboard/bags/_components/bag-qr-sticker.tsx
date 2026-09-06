"use client";

import { useEffect, useState } from "react";

import QRCode from "qrcode";

/** Payload the user app scan tab sends to activateBag — raw registry id only. */
export function bagQrPayload(code: string) {
  return code.trim().toUpperCase();
}

export function BagQrSticker({
  code,
  size = 168,
}: {
  code: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string>("");
  const payload = bagQrPayload(code);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#10261A", light: "#FFFFFF" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload, size]);

  return (
    <div className="bag-qr-sticker flex break-inside-avoid flex-col items-center gap-2 rounded-xl border bg-white p-3 text-center text-[#10261A]">
      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase">Wasty bag</p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={payload} width={size} height={size} className="size-[var(--qr-size)]" style={{ width: size, height: size }} />
      ) : (
        <div className="animate-pulse rounded-md bg-muted" style={{ width: size, height: size }} />
      )}
      <p className="font-mono text-[11px] font-semibold leading-tight tracking-wide">{payload}</p>
      <p className="text-[10px] text-muted-foreground">User activates · Partner identifies</p>
    </div>
  );
}

export async function downloadBagQrPng(code: string) {
  const payload = bagQrPayload(code);
  const url = await QRCode.toDataURL(payload, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const link = document.createElement("a");
  link.href = url;
  link.download = `${payload}.png`;
  link.click();
}
