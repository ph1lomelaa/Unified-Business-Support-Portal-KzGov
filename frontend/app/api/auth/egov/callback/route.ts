import { NextRequest, NextResponse } from "next/server";
import { BACKEND, SESSION_COOKIE, encodeSession } from "@/lib/session-cookie";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "";
  const iin = req.nextUrl.searchParams.get("iin") || "123456789012";
  const next = req.nextUrl.searchParams.get("next") || "/cabinet";
  const res = await fetch(`${BACKEND}/api/auth/egov/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state, iin }),
  });
  if (!res.ok) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("error", "egov");
    return NextResponse.redirect(url);
  }
  const { user } = await res.json();
  const response = NextResponse.redirect(new URL(next, req.nextUrl.origin));
  response.cookies.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
