import { TIPHONE_BASE_URL } from "./endpoints";

function apiOrigin(): string {
  return TIPHONE_BASE_URL.replace(/\/api\/v\d+\/?$/, "");
}

export function resolveTipMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = apiOrigin();
  return trimmed.startsWith("/") ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}

export const PHONE_DIGIT_COUNT = 9;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function clampPhoneInput(value: string): string {
  return digitsOnly(value).slice(0, PHONE_DIGIT_COUNT);
}

export function isValidPhoneDigits(phone: string): boolean {
  return digitsOnly(phone).length === PHONE_DIGIT_COUNT;
}

export function phoneValidationMessage(): string {
  return "Lambarka waa inuu ka koobnaadaa 9 lambar (tusaale 61xxxxxxx).";
}

export function looksLikePhoneQuery(q: string): boolean {
  const d = digitsOnly(q);
  return d.length >= 7 && d.length <= 15 && /^\d[\d\s+\-()]*$/.test(q.trim());
}

/** Strip numeric codes / D. prefixes so county labels match across APIs. */
export function formatCountyLabel(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s || s === "All" || s === "—" || s === "Lama Helin") return s;
  s = s.replace(/^D\.?\s*/i, "").replace(/^degmo\s*/i, "").trim();
  s = s.replace(/^\d+[\s.\-_:/]+/, "").trim();
  s = s.replace(/^\d+(?=[A-Za-z\u00C0-\u024F])/u, "").trim();
  s = s.replace(/\s*[([{]\s*\d+\s*[)\]}]\s*$/u, "").trim();
  s = s.replace(/\s*[-–]\s*\d+\s*$/u, "").trim();
  return s || (raw ?? "").trim();
}

export function damiinLookupLabel(row: {
  name: string;
  phone?: string | null;
  degmada?: string | null;
}): string {
  const phone = row.phone ? ` · ${row.phone}` : "";
  const deg = row.degmada ? ` (${row.degmada})` : "";
  return `${row.name}${deg}${phone}`;
}

export function islaDamiinLabel(row: { name: string; phone?: string }): string {
  return row.phone ? `${row.name} · ${row.phone}` : row.name;
}

export function displayName(user: {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.username || user.email || "User";
}

export type DrawerRouteId =
  | "qmadaxda"
  | "damiinada"
  | "ogeysiiska"
  | "baaris"
  | "maareynta"
  | "debug";

export type TipPhoneScreenId =
  | "leaders"
  | "damiinada"
  | "notices"
  | "baaris"
  | "maareynta"
  | "user-management";

export type TipPhoneUserType =
  | "agent"
  | "degmo"
  | "dev"
  | "general"
  | "baaris"
  | "taliye"
  | "taliye_degmo"
  | "taliye_qebeed"
  | "xoghaye";

const KNOWN_USER_TYPES = new Set<TipPhoneUserType>([
  "agent",
  "degmo",
  "dev",
  "general",
  "baaris",
  "taliye",
  "taliye_degmo",
  "taliye_qebeed",
  "xoghaye",
]);

export function canonicalizeUserType(value: string): string {
  const n = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^permission_/, "");
  if (n === "agent" || n === "agents") return "agent";
  if (n === "degmo") return "degmo";
  if (n === "dev") return "dev";
  if (n === "general") return "general";
  if (n === "baaris") return "baaris";
  if (n === "taliye") return "taliye";
  if (n === "taliye_degmo") return "taliye_degmo";
  if (n === "taliye_qebeed" || n === "taliye_qeybeed") return "taliye_qebeed";
  if (n === "xoghaye") return "xoghaye";
  return n;
}

/** Primary role label — mirrors Flutter SharedPreferences `user_permission`. */
export function resolvePrimaryRoleLabel(roles: string[], permissions: string[] = []): string {
  const safeRoles = Array.isArray(roles) ? roles : [];
  const safePermissions = Array.isArray(permissions) ? permissions : [];
  const primary = safeRoles.find((r) => typeof r === "string" && r.trim().length > 0)?.trim();
  if (primary) return primary;
  const fromPerms = safePermissions.find((p) => {
    if (typeof p !== "string" || !p.trim()) return false;
    return KNOWN_USER_TYPES.has(canonicalizeUserType(p) as TipPhoneUserType);
  })?.trim();
  return fromPerms ?? "";
}

export function resolveUserType(roles: string[], permissions: string[] = []): string {
  const label = resolvePrimaryRoleLabel(roles, permissions);
  return label ? canonicalizeUserType(label) : "";
}

export function isAgentRole(roles: string[], permissions: string[] = []): boolean {
  return resolveUserType(roles, permissions) === "agent";
}

export function isBaarisRole(roles: string[], permissions: string[] = []): boolean {
  return resolveUserType(roles, permissions) === "baaris";
}

export function listSourceForRole(roles: string[], permissions: string[] = []): "amniga" | "baaris" {
  return isBaarisRole(roles, permissions) ? "baaris" : "amniga";
}

export function isDegmoRole(roles: string[], permissions: string[] = []): boolean {
  return resolveUserType(roles, permissions) === "degmo";
}

export function isDevRole(roles: string[], permissions: string[] = []): boolean {
  return resolveUserType(roles, permissions) === "dev";
}

/** Native userRole.ts parity: every non-Agent/Degmo/General/Baaris role is a commander. */
export function isCommanderRole(roles: string[], permissions: string[] = []): boolean {
  const type = resolveUserType(roles, permissions);
  return (
    Boolean(type) &&
    type !== "agent" &&
    type !== "degmo" &&
    type !== "general" &&
    type !== "baaris"
  );
}

export function canUseIsgaarsiin(roles: string[], permissions: string[] = []): boolean {
  // Baaris has no walkie / nearby call UI.
  if (isBaarisRole(roles, permissions)) return false;
  return isAgentRole(roles, permissions) || isCommanderRole(roles, permissions);
}

export function canStartBroadcast(roles: string[], permissions: string[] = []): boolean {
  if (isBaarisRole(roles, permissions)) return false;
  return isCommanderRole(roles, permissions);
}

export function canCreateWanted(roles: string[], permissions: string[] = []): boolean {
  return (
    isCommanderRole(roles, permissions) ||
    permissions.includes("baaris.add_baariscitizenprofile")
  );
}

/** Agent / Degmo — cannot manage users / reset PIN (Flutter settings.dart). */
export function isRestrictedAgentRole(roles: string[], permissions: string[] = []): boolean {
  return isAgentRole(roles, permissions) || isDegmoRole(roles, permissions);
}

export function canManageUsers(roles: string[], permissions: string[] = []): boolean {
  return isDevRole(roles, permissions);
}

export function canResetElevatedPin(roles: string[], permissions: string[] = []): boolean {
  return !isRestrictedAgentRole(roles, permissions);
}

/**
 * Drawer visibility — parity with Flutter / native app:
 * - Q.Madaxda, Damiinada: hidden for Agent
 * - Debug: hidden for Agent and Degmo
 * - Dev / General (and other types): full drawer
 */
export function canShowDrawerRoute(
  id: DrawerRouteId,
  roles: string[],
  permissions: string[] = [],
): boolean {
  const type = resolveUserType(roles, permissions);
  const agent = type === "agent";
  const degmo = type === "degmo";

  // Baaris users only need security settings (PIN/password) in the drawer.
  if (type === "baaris") return id === "maareynta";

  switch (id) {
    case "qmadaxda":
    case "damiinada":
      return !agent;
    case "debug":
      return !agent && !degmo;
    default:
      return true;
  }
}

/** Screen-level guard (in case of deep navigate / stale state). */
export function canAccessTipScreen(
  screen: TipPhoneScreenId | string,
  roles: string[],
  permissions: string[] = [],
): boolean {
  switch (screen) {
    case "responses":
      return !isBaarisRole(roles, permissions);
    case "leaders":
      return canShowDrawerRoute("qmadaxda", roles, permissions);
    case "damiinada":
      return canShowDrawerRoute("damiinada", roles, permissions);
    case "user-management":
      return canManageUsers(roles, permissions);
    default:
      return true;
  }
}
