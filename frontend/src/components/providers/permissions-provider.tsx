"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-auth";
import { authKeys } from "@/lib/auth-api";
import { getAccessToken } from "@/lib/auth";
import { fetchLivePermissions } from "@/lib/fetch-live-permissions";
import type { User } from "@/types";

/** Poll interval — admin may change this user's permissions in another browser. */
const POLL_MS = 2_000;

type PermissionsContextValue = {
  user: User | undefined;
  permissions: string[];
  revision: number;
  isLoading: boolean;
  sync: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export { PermissionsContext };

function sig(perms: string[]): string {
  return perms.join("\0");
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: me, isLoading, isFetching } = useMe();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const lastSigRef = useRef("");
  const lastUserIdRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  const applyPermissions = useCallback((next: string[]) => {
    const sorted = [...next].sort();
    const nextSig = sig(sorted);
    if (nextSig === lastSigRef.current) return;
    lastSigRef.current = nextSig;
    setPermissions(sorted);
    setRevision((n) => n + 1);
    queryClient.setQueryData<User>(authKeys.me, (old) => {
      if (!old) return old;
      return { ...old, permissions: sorted };
    });
  }, [queryClient]);

  const poll = useCallback(async () => {
    if (pollingRef.current || !getAccessToken()) return;
    pollingRef.current = true;
    try {
      const next = await fetchLivePermissions();
      applyPermissions(next);
    } catch {
      // Network blip — next poll will retry.
    } finally {
      pollingRef.current = false;
    }
  }, [applyPermissions]);

  const sync = useCallback(async () => {
    await poll();
  }, [poll]);

  // Seed permissions once when the logged-in user is known (login / page load).
  useEffect(() => {
    if (!me?.id) return;
    if (me.id === lastUserIdRef.current) return;
    lastUserIdRef.current = me.id;
    const initial = me.permissions ?? [];
    lastSigRef.current = sig(initial);
    setPermissions(initial);
    setRevision((n) => n + 1);
    void poll();
  }, [me?.id, poll]);

  // Background poll — picks up changes made by admin in another browser.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [poll]);

  const user = useMemo<User | undefined>(() => {
    if (!me) return undefined;
    return { ...me, permissions };
  }, [me, permissions, revision]);

  const value = useMemo<PermissionsContextValue>(() => ({
    user,
    permissions,
    revision,
    isLoading: isLoading || isFetching,
    sync,
  }), [user, permissions, revision, isLoading, isFetching, sync]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
