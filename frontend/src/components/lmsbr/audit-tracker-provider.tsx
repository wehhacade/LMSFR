"use client";

import { useEffect } from "react";
import { logAuditEvent, logClick } from "@/lib/audit-tracker";

function clickLabel(el: HTMLElement): string | null {
  const tagged = el.closest("[data-audit]") as HTMLElement | null;
  if (tagged?.dataset.audit) return tagged.dataset.audit;

  const interactive = el.closest("button, a, [role='button'], tr, label") as HTMLElement | null;
  if (!interactive) return null;

  const text = (interactive.getAttribute("aria-label") || interactive.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (text.length < 2) return null;
  return text;
}

export function AuditTrackerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-audit-skip]")) return;

      const label = clickLabel(target);
      if (!label) return;

      const module = document.body.dataset.auditModule ?? "dashboard";
      logClick(module, label, label);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logAuditEvent({
        event_type: "other",
        action: `Client error: ${event.message}`,
        module: "client",
        submodule: "error",
        details: { filename: event.filename, lineno: event.lineno },
      });
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  return <>{children}</>;
}
