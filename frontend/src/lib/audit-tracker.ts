import api from "@/lib/axios";

export type AuditEventType =
  | "click"
  | "visit"
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "other";

export interface AuditEventPayload {
  action: string;
  event_type: AuditEventType;
  submodule?: string;
  module?: string;
  page?: string;
  click_target?: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  path?: string;
}

let lastKey = "";
let lastTs = 0;
const THROTTLE_MS = 350;

function shouldThrottle(key: string): boolean {
  const now = Date.now();
  if (key === lastKey && now - lastTs < THROTTLE_MS) return true;
  lastKey = key;
  lastTs = now;
  return false;
}

/** Fire-and-forget UI audit log — never blocks the UI. */
export function logAuditEvent(payload: AuditEventPayload): void {
  if (typeof window === "undefined") return;
  const path = payload.path ?? window.location.pathname;
  const key = `${payload.event_type}:${payload.click_target ?? ""}:${payload.page ?? ""}:${path}`;
  if (shouldThrottle(key)) return;

  void api
    .post("/audit-trails/", {
      ...payload,
      path,
      submodule: payload.submodule ?? payload.module ?? "ui",
    })
    .catch(() => {
      /* silent — audit must not break UX */
    });
}

export function logPageVisit(module: string, page: string, label: string): void {
  logAuditEvent({
    event_type: "visit",
    action: `Visited ${label}`,
    module,
    page,
    submodule: module,
    click_target: page,
    details: { page, label },
  });
}

export function logClick(module: string, target: string, label?: string): void {
  logAuditEvent({
    event_type: "click",
    action: label ? `Clicked ${label}` : `Clicked ${target}`,
    module,
    page: typeof window !== "undefined" ? window.location.pathname : "",
    click_target: target,
    submodule: module,
    details: { target, label },
  });
}
