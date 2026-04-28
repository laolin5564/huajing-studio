import { NextRequest } from "next/server";
import { AuthError } from "./auth";

interface LoginAttemptState {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttemptState>();
const windowMs = 15 * 60 * 1000;
const blockMs = 15 * 60 * 1000;
const maxFailures = 10;

function now(): number {
  return Date.now();
}

function cleanupExpiredAttempts(currentTime = now()): void {
  for (const [key, state] of loginAttempts.entries()) {
    const windowExpired = currentTime - state.firstAttemptAt > windowMs;
    const blockExpired = state.blockedUntil > 0 && state.blockedUntil <= currentTime;
    if (windowExpired && (state.blockedUntil === 0 || blockExpired)) {
      loginAttempts.delete(key);
    }
  }
}

export function clientIpFromRequest(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function loginRateLimitKey(request: NextRequest, email: string): string {
  return `${clientIpFromRequest(request)}:${email.toLowerCase()}`;
}

export function assertLoginAllowed(key: string): void {
  cleanupExpiredAttempts();
  const state = loginAttempts.get(key);
  if (state && state.blockedUntil > now()) {
    throw new AuthError("登录失败次数过多，请稍后再试", 429);
  }
}

export function recordLoginFailure(key: string): void {
  const currentTime = now();
  const existing = loginAttempts.get(key);
  const state = existing && currentTime - existing.firstAttemptAt <= windowMs
    ? existing
    : { count: 0, firstAttemptAt: currentTime, blockedUntil: 0 };

  state.count += 1;
  if (state.count >= maxFailures) {
    state.blockedUntil = currentTime + blockMs;
  }
  loginAttempts.set(key, state);
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}
