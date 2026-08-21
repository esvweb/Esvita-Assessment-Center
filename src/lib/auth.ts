import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Session cookies are stateless and HMAC-signed, so an administrator can sign in
 * before the database exists — the admin account is configured in the
 * environment, and everyone else is looked up in the database at login time only.
 */

export const AUTH_COOKIE = "esvita_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

export type Role = "admin" | "member";

export interface SessionPayload {
  username: string;
  role: Role;
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (needs at least 16 characters)");
  }
  return s;
}

export function adminUsername(): string {
  return process.env.ADMIN_USERNAME ?? "Admin";
}

/** Constant-time comparison that does not leak length through an early return. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do the work, so timing does not distinguish "wrong length".
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function signSession(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + MAX_AGE_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "member") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SessionPayload | null> {
  try {
    return verifySession((await cookies()).get(AUTH_COOKIE)?.value);
  } catch {
    // AUTH_SECRET not configured — treat as signed out rather than crashing.
    return null;
  }
}

export async function isSignedIn(): Promise<boolean> {
  return (await currentUser()) !== null;
}

export async function isAdmin(): Promise<boolean> {
  return (await currentUser())?.role === "admin";
}

export function sessionCookieHeader(token: string): string {
  return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function clearCookieHeader(): string {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function randomCode(digits = 6): string {
  // Rejection-free: read a wide integer and reduce, then pad.
  const max = 10 ** digits;
  const value = randomBytes(6).readUIntBE(0, 6) % max;
  return String(value).padStart(digits, "0");
}
