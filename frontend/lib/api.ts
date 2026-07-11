// Thin client for the Python (FastAPI) backend.
// Backend base URL — same origin in prod behind a proxy, or localhost:8000 in dev.

// Browser calls go same-origin through the /bff rewrite (next.config.ts) so the
// httpOnly session cookie is sent and forwarded to the Python backend.
export const API_BASE = "/bff";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "include",
      cache: "no-store",
    });
  } catch (err) {
    // Network-level failure (backend unreachable, proxy misconfigured) —
    // fetch() throws instead of resolving, so it never reaches the res.ok
    // check below. Surface it the same way as an HTTP error.
    console.error("[API-FAIL]", url, "network", err instanceof Error ? err.message : err);
    throw new ApiError(0, "Нет связи с сервером. Проверьте подключение и повторите попытку.");
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : null) || `Ошибка ${res.status}`;
    console.error("[API-FAIL]", url, res.status, msg);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
