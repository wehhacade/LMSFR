/**
 * Session policies — web and mobile are intentionally different (legacy NISA).
 *
 * Old project:
 * - Web admin: Django session cookie + SessionTimeoutMiddleware (15 min idle)
 * - Mobile API: JWT only (60 min access, ~1 day refresh, no idle lockout)
 */

/** Web SPA — replaces Django SessionTimeoutMiddleware (15 min idle lockout). */
export const WEB_IDLE_MINUTES = 15;
export const WEB_ACCESS_TOKEN_MINUTES = 60;
export const WEB_REFRESH_TOKEN_DAYS = 1;

export const WEB_SESSION_IDLE_MS = WEB_IDLE_MINUTES * 60 * 1000;
export const WEB_SESSION_IDLE_SECONDS = WEB_IDLE_MINUTES * 60;

export const WEB_SESSION_POLICY = {
  client: "web" as const,
  idleMinutes: WEB_IDLE_MINUTES,
  accessTokenMinutes: WEB_ACCESS_TOKEN_MINUTES,
  refreshTokenDays: WEB_REFRESH_TOKEN_DAYS,
} as const;

/** Mobile — JWT refresh only; no idle timer (matches old /APIs/login/ behaviour). */
export const MOBILE_ACCESS_TOKEN_MINUTES = 60;
export const MOBILE_REFRESH_TOKEN_DAYS = 1;

export const MOBILE_ACCESS_TOKEN_MS = MOBILE_ACCESS_TOKEN_MINUTES * 60 * 1000;
export const MOBILE_REFRESH_TOKEN_MS = MOBILE_REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

export const MOBILE_SESSION_POLICY = {
  client: "mobile" as const,
  /** Mobile does not force logout on inactivity — tokens refresh until refresh expires. */
  idleMinutes: null,
  accessTokenMinutes: MOBILE_ACCESS_TOKEN_MINUTES,
  refreshTokenDays: MOBILE_REFRESH_TOKEN_DAYS,
} as const;

/** @deprecated Use WEB_SESSION_POLICY or MOBILE_SESSION_POLICY */
export const SESSION_POLICY = WEB_SESSION_POLICY;
