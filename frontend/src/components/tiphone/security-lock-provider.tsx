"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SecurityStorage } from "@/lib/tiphone/security-storage";
import { useTipAuth } from "./auth-provider";

type SecurityLockContextValue = {
  isLocked: boolean;
  unlock: () => void;
  markUnlocked: () => void;
};

const SecurityLockContext = createContext<SecurityLockContextValue | null>(null);

export function useSecurityLock() {
  const ctx = useContext(SecurityLockContext);
  if (!ctx) throw new Error("useSecurityLock must be used within SecurityLockProvider");
  return ctx;
}

/** Brief background (notification shade) — skip re-auth. */
const RESUME_GRACE_MS = 1500;

function hasTipSession(): boolean {
  try {
    return Boolean(localStorage.getItem("tiphone_auth"));
  } catch {
    return false;
  }
}

export function SecurityLockProvider({ children }: { children: ReactNode }) {
  const { auth, ready } = useTipAuth();
  const isAuthenticated = ready && !!auth;
  // First paint: already locked when session + PIN lock (no flash of home).
  const [isLocked, setIsLocked] = useState(
    () => typeof window !== "undefined" && hasTipSession() && SecurityStorage.shouldUseAppLock(),
  );
  const wentBackground = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLocked(false);
      wentBackground.current = false;
      return;
    }
    setIsLocked(SecurityStorage.shouldUseAppLock());
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const onHidden = () => {
      wentBackground.current = true;
      // Lock while backgrounded so resume shows lock instantly (no content flash).
      if (SecurityStorage.shouldUseAppLock()) setIsLocked(true);
    };

    const onVisible = () => {
      if (!wentBackground.current) return;
      wentBackground.current = false;
      if (!SecurityStorage.shouldUseAppLock()) {
        setIsLocked(false);
        return;
      }
      // Short leave: unlock without PIN (matches native grace).
      if (Date.now() - SecurityStorage.getLastAuthTime() < RESUME_GRACE_MS) {
        setIsLocked(false);
        return;
      }
      setIsLocked(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHidden();
      else if (document.visibilityState === "visible") onVisible();
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        wentBackground.current = true;
        onVisible();
      }
    };

    const onPageHide = () => onHidden();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [isAuthenticated]);

  const markUnlocked = useCallback(() => {
    SecurityStorage.setLastAuthTime();
    setIsLocked(false);
  }, []);

  const unlock = useCallback(() => {
    markUnlocked();
  }, [markUnlocked]);

  const value = useMemo(
    () => ({ isLocked, unlock, markUnlocked }),
    [isLocked, unlock, markUnlocked],
  );

  return (
    <SecurityLockContext.Provider value={value}>{children}</SecurityLockContext.Provider>
  );
}
