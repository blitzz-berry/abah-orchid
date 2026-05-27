"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { consumeRealtimeEvents } from "@/lib/realtime";

export default function RealtimeProvider() {
  const { isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;

    let stopped = false;
    let retryDelay = 1000;
    let retryTimer: number | undefined;
    let controller: AbortController | undefined;

    const connect = async () => {
      controller = new AbortController();
      try {
        await consumeRealtimeEvents(controller.signal);
        retryDelay = 1000;
      } catch {
        if (controller.signal.aborted) return;
      }
      if (stopped) return;
      retryTimer = window.setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, 15000);
        void connect();
      }, retryDelay);
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [isAuthenticated, isHydrated]);

  return null;
}
