import type { AuthTokens } from "@/types";
import { WEB_SESSION_IDLE_SECONDS } from "@/lib/session-policy";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const AUTH_COOKIE = "is_authenticated=true; path=/; SameSite=Lax";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function extendAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}; max-age=${WEB_SESSION_IDLE_SECONDS}`;
}

/** Full page load so proxy.ts sees is_authenticated before /dashboard is requested. */
export function navigateAfterLogin(): void {
  if (typeof window === "undefined") return;
  extendAuthCookie();
  window.location.assign("/dashboard");
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_KEY, tokens.access);
  localStorage.setItem(REFRESH_KEY, tokens.refresh);
  extendAuthCookie();
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = "is_authenticated=; path=/; max-age=0";
}

export type LoginRedirectReason = "session_expired" | "auth_failed";

export function redirectToLogin(reason?: LoginRedirectReason): void {
  if (typeof window === "undefined") return;
  clearTokens();
  const query = reason ? `?reason=${reason}` : "";
  window.location.href = `/login${query}`;
}
