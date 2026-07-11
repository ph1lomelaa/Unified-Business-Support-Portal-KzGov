import { NextRequest, NextResponse } from "next/server";
import { BACKEND, withSession } from "@/lib/session-cookie";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: e.detail ?? "Ошибка входа" },
      { status: res.status }
    );
  }
  const { user } = await res.json();
  return withSession(user);
}
