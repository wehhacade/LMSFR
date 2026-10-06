"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  extendAuthCookie,
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from "@/lib/auth";
import { logout } from "@/lib/auth-api";
import { WEB_SESSION_IDLE_MS } from "@/lib/session-policy";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;
const THROTTLE_MS = 1000;

export function SessionIdleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(0);

  const lockSession = useCallback(async () => {
    if (!getAccessToken()) return;

    const refresh = getRefreshToken();
    clearTokens();
    if (refresh) {
      try {
        await logout(refresh);
      } catch {
        // ignore — tokens already cleared locally
      }
    }
    router.replace("/login?reason=session_expired");
  }, [router]);

  const bumpIdleTimer = useCallback(() => {
    if (!getAccessToken()) return;

    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    lastActivityRef.current = now;

    extendAuthCookie();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(lockSession, WEB_SESSION_IDLE_MS);
  }, [lockSession]);

  useEffect(() => {
    if (!getAccessToken()) return;

    bumpIdleTimer();
    const onActivity = () => bumpIdleTimer();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true }),
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [bumpIdleTimer]);

  return <>{children}</>;
}
