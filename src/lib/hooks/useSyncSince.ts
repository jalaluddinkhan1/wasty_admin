"use client";

import { useEffect, useRef } from "react";

import { pollSyncSince } from "@/server/sync-actions";

/** Poll AWS sync bus and fire callbacks (live map, ops dashboard). */
export function useSyncSince(onEvent: (type: string, payload: unknown) => void, active = true) {
  const cursorRef = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const res = await pollSyncSince(cursorRef.current);
        cursorRef.current = Number(res.cursor || Date.now());
        for (const e of res.events) {
          onEventRef.current(e.type, e.payload);
        }
      } catch {
        /* retry */
      }
      if (!cancelled) timer = setTimeout(tick, 2000);
    };

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);
}
