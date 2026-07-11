import { cookies } from "next/headers";
import type { SessionUser } from "@/components/layout/header";
import { decodeSession, SESSION_COOKIE } from "@/lib/session-cookie";

// Server-side session reader. Parses only HMAC-signed httpOnly session cookies.
export async function getSession(): Promise<SessionUser> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parsed = decodeSession(raw);
  if (!parsed?.name || !parsed?.role) return null;
  return {
    name: parsed.name,
    role: parsed.role as NonNullable<SessionUser>["role"],
  };
}
