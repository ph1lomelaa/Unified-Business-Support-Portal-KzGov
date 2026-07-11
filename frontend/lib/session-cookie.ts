import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "eppb_session";
export const BACKEND =
  process.env.BACKEND_ORIGIN?.replace(/\/$/, "") || "http://localhost:8000";
const SESSION_SECRET = process.env.SESSION_SECRET || "eppb-dev-secret-change-me";

export type SessionPayload = {
  id: string;
  name: string;
  role: string;
  bin?: string | null;
  orgId?: string | null;
};

function b64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", SESSION_SECRET).update(payload).digest());
}

export function encodeSession(user: SessionPayload): string {
  const payload = b64url(Buffer.from(JSON.stringify(user), "utf8"));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string): SessionPayload | null {
  try {
    const [payload, signature] = raw.split(".");
    if (!payload || !signature) return null;
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function withSession(user: SessionPayload) {
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
