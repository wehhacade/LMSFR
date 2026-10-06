import type { StoredAuth, StoredTokens } from "./types";

const AUTH_KEY = "tiphone_auth";

let memoryTokens: StoredTokens | null = null;
let logoutCallback: (() => void) | null = null;

export function setLogoutCallback(cb: (() => void) | null) {
  logoutCallback = cb;
}

export function triggerLogout() {
  logoutCallback?.();
}

export const TipTokenService = {
  getAccessToken(): string | null {
    return memoryTokens?.access ?? null;
  },
  getRefreshToken(): string | null {
    return memoryTokens?.refresh ?? null;
  },
  getRefreshEndpoint(): string | null {
    return memoryTokens?.refreshEndpoint ?? null;
  },
  setTokens(tokens: StoredTokens) {
    memoryTokens = tokens;
  },
  clear() {
    memoryTokens = null;
  },
};

export const TipStorage = {
  loadAuth(): StoredAuth | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      const auth = JSON.parse(raw) as StoredAuth;
      if (auth?.tokens?.access) {
        TipTokenService.setTokens(auth.tokens);
        return auth;
      }
    } catch {
      /* ignore */
    }
    return null;
  },
  saveAuth(auth: StoredAuth) {
    TipTokenService.setTokens(auth.tokens);
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  },
  clearAuth() {
    TipTokenService.clear();
    localStorage.removeItem(AUTH_KEY);
  },
  getCachedAuth(): StoredAuth | null {
    return this.loadAuth();
  },
};
