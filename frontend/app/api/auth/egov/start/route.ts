import { NextRequest, NextResponse } from "next/server";
import { BACKEND } from "@/lib/session-cookie";

// Разрешаем только внутренние пути ("/...", но не "//host") — защита от
// open-redirect и от протокол-относительных URL.
function safePath(p: string | null, fallback = "/cabinet"): string {
  if (!p || !p.startsWith("/") || p.startsWith("//")) return fallback;
  return p;
}

export async function GET(req: NextRequest) {
  const next = safePath(req.nextUrl.searchParams.get("next"));
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
  // Собираем ОТНОСИТЕЛЬНЫЙ Location. Браузер резолвит его относительно URL в
  // адресной строке (публичный домен), поэтому редирект корректен за любым
  // обратным прокси — в отличие от new URL(path, req.nextUrl.origin), где origin
  // за nginx→docker становится внутренним localhost.
  const rel = new URL(data.redirectPath, "http://internal.invalid");
  rel.searchParams.set("next", next);
  const location = `${rel.pathname}${rel.search}`;
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}
