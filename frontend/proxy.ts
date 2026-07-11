import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "eppb_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "eppb-dev-secret-change-me";

type SessionPayload = {
  name?: string;
  role?: string;
};

function redirectLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function b64urlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function b64urlFromBytes(bytes: ArrayBuffer): string {
  const raw = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(raw).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlFromBytes(sig);
}

async function decodeSession(raw: string): Promise<SessionPayload | null> {
  try {
    const [payload, signature] = raw.split(".");
    if (!payload || !signature) return null;
    if (signature !== await sign(payload)) return null;
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
  } catch {
    return null;
  }
}

// Auth gate for /cabinet and /admin (Next 16 renamed middleware -> proxy).
// /admin additionally requires an admin/analyst role from the signed cookie.
export async function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return redirectLogin(request);

  const payload = await decodeSession(session);
  if (!payload?.name || !payload.role) return redirectLogin(request);

  if (
    request.nextUrl.pathname.startsWith("/admin")
    && !["admin", "analyst"].includes(payload.role)
  ) {
    return redirectLogin(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/cabinet/:path*", "/admin/:path*"],
};
