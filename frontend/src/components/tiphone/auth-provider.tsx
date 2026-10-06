"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TipAuth } from "@/lib/tiphone/auth";
import { TipApi } from "@/lib/tiphone/api";
import { getCurrentCoords } from "@/lib/tiphone/nearest-agent";
import { TipTokenService, setLogoutCallback } from "@/lib/tiphone/storage";
import type { LoginCredentials, StoredAuth } from "@/lib/tiphone/types";

type AuthCtx = {
  auth: StoredAuth | null;
  ready: boolean;
  login: (c: LoginCredentials) => Promise<StoredAuth>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

async function syncUserLocation(userId: string | number) {
  try {
    const coords = await getCurrentCoords({ forceRefresh: true });
    await TipApi.saveUserLocation(userId, coords.latitude, coords.longitude);
  } catch {
    /* location is best-effort on browsers */
  }
}

export function TipAuthProvider({ children }: { children: ReactNode }) {
  // Hydrate sync so PWA home-screen open skips splash delay.
  const [auth, setAuth] = useState<StoredAuth | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = TipAuth.hydrate();
    if (cached?.tokens?.access) TipTokenService.setTokens(cached.tokens);
    return cached;
  });
  const [ready, setReady] = useState(() => typeof window !== "undefined");

  const logout = useCallback(() => {
    TipAuth.logout();
    setAuth(null);
  }, []);

  useEffect(() => {
    if (!ready) {
      const cached = TipAuth.hydrate();
      if (cached?.tokens?.access) TipTokenService.setTokens(cached.tokens);
      setAuth(cached);
      setReady(true);
    }
    setLogoutCallback(() => {
      TipAuth.logout();
      setAuth(null);
    });
    return () => setLogoutCallback(null);
  }, [ready]);

  // Refresh Permission/roles from API so drawer gates match the native app.
  useEffect(() => {
    if (!ready || !auth) return;
    let alive = true;
    TipAuth.refreshSession().then((next) => {
      if (alive && next) setAuth(next);
    });
    void syncUserLocation(auth.user.id);
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncUserLocation(auth.user.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Only on session open / user id change — not on every auth field update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, auth?.user.id]);

  const login = useCallback(async (c: LoginCredentials) => {
    const next = await TipAuth.login(c);
    setAuth(next);
    void syncUserLocation(next.user.id);
    return next;
  }, []);

  const value = useMemo(() => ({ auth, ready, login, logout }), [auth, ready, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTipAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTipAuth must be used within TipAuthProvider");
  return ctx;
}
