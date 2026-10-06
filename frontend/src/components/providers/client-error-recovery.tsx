"use client";

import { useEffect } from "react";

const RELOAD_KEY = "lmsbr-chunk-reload";

function isStaleChunkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("chunkloaderror")
    || m.includes("loading chunk")
    || m.includes("failed to fetch dynamically imported module")
    || m.includes("importing a module script failed")
  );
}

/**
 * After a frontend deploy, browsers may still hold an old HTML shell that
 * references removed JS chunks — that throws at runtime and surfaces as the
 * generic 500 page. Reload once to pick up the new build.
 */
export function ClientErrorRecovery() {
  useEffect(() => {
    const maybeReload = (message: string) => {
      if (!isStaleChunkError(message)) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      maybeReload(event.message || String(event.error ?? ""));
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "";
      maybeReload(message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
