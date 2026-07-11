import { cookies } from "next/headers";
import type { NotificationItem } from "@/components/layout/notification-bell";

// Server components call the backend directly (absolute URL) and forward the
// session cookie by hand — the browser's /bff proxy doesn't apply server-side.
const SERVER_BACKEND =
  process.env.BACKEND_ORIGIN?.replace(/\/$/, "") || "http://localhost:8000";

/** Server-side fetch that forwards the session cookie to the FastAPI backend. */
export async function serverFetch<T>(
  path: string,
  fallback: T
): Promise<T> {
  const url = `${SERVER_BACKEND}${path}`;
  try {
    const store = await cookies();
    const res = await fetch(url, {
      headers: { cookie: store.toString() },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[API-FAIL]", url, res.status);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[API-FAIL]", url, "network", err instanceof Error ? err.message : err);
    return fallback;
  }
}

export function getNotifications(): Promise<NotificationItem[]> {
  return serverFetch<NotificationItem[]>("/api/v1/notifications", []);
}
