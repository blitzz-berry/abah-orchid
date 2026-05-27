import api, { getAccessToken, getAPIBaseURL, setAccessToken } from "@/lib/api";

export const REALTIME_EVENT_NAME = "orchidmart:realtime";

export type RealtimeEvent = {
  type: string;
  order_id?: string;
  status?: string;
  occurred_at?: string;
};

export function onRealtimeEvent(handler: (event: RealtimeEvent) => void) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<RealtimeEvent>).detail);
  };
  window.addEventListener(REALTIME_EVENT_NAME, listener);
  return () => window.removeEventListener(REALTIME_EVENT_NAME, listener);
}

export function isOrderRefreshEvent(event: RealtimeEvent, orderID?: string) {
  if (orderID && event.order_id && event.order_id !== orderID) return false;
  return event.type === "order.changed" || event.type === "payment.changed" || event.type === "notification.created";
}

export async function consumeRealtimeEvents(signal: AbortSignal) {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Missing access token");
  }

  const response = await fetch(`${getAPIBaseURL().replace(/\/$/, "")}/events`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (response.status === 401) {
    const refresh = await api.post("/auth/refresh");
    const data = refresh.data.data || refresh.data;
    if (typeof data.access_token === "string" && data.access_token) {
      setAccessToken(data.access_token);
    }
    throw new Error("Realtime token refreshed");
  }
  if (!response.ok || !response.body) {
    throw new Error(`Realtime stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const result = await reader.read();
    if (result.done) return;
    buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (data) {
        try {
          const detail = JSON.parse(data) as RealtimeEvent;
          if (detail.type !== "connected") {
            window.dispatchEvent(new CustomEvent(REALTIME_EVENT_NAME, { detail }));
          }
        } catch {
          // Ignore malformed frames and keep the authenticated stream alive.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
