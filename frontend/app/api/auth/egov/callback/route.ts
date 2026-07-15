import { NextRequest, NextResponse } from "next/server";
import { BACKEND, SESSION_COOKIE, encodeSession } from "@/lib/session-cookie";

// Разрешаем только внутренние пути — защита от open-redirect.
function safePath(p: string | null, fallback = "/cabinet"): string {
  if (!p || !p.startsWith("/") || p.startsWith("//")) return fallback;
  return p;
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "";
  const iin = req.nextUrl.searchParams.get("iin") || "123456789012";
  const next = safePath(req.nextUrl.searchParams.get("next"));
  const res = await fetch(`${BACKEND}/api/auth/egov/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, iin }),
  });
  // ОТНОСИТЕЛЬНЫЙ Location — резолвится браузером от публичного домена, поэтому
  // работает за обратным прокси (см. комментарий в start/route.ts).
  if (!res.ok) {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: "/login?error=egov" },
    });
  }
  const { user } = await res.json();
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: next },
  });
  response.cookies.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
