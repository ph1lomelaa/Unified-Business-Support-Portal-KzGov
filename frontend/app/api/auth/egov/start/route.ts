import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/lib/session-cookie";

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/cabinet";
  const res = await fetch(`${BACKEND}/api/auth/egov/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ next }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: e.detail ?? "eGov IDP недоступен" },
      { status: res.status }
    );
  }
  const data = await res.json();
  const url = new URL(data.redirectPath, req.nextUrl.origin);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}
