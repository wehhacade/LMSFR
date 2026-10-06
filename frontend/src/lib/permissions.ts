import type { User } from "@/types";
import type { ModuleId } from "@/lib/lmsbr/data";

/** Grants Dhacdooyin module + menu access (not Sirdoon-only users). */
export const DHACDO_MODULE_VIEW_PERMS = [
  "dhacdooyinka.view_dhacdooyinka",
  "dhacdooyinka.view_dhacdo_amni",
] as const;

/** Django permission strings required to see each menu item. */
export const MENU_PERMS: Record<string, string | string[] | null> = {
  dashboard: null,
  suspect: "suspects.view_suspect",
  facematch: "suspects.view_suspect",
  records: "hubkadhigis.view_disarmamentrecord",
  gallery: "hubkadhigis.view_disarmamentrecord",
  analytics: "hubkadhigis.view_disarmamentrecord",
  surveys: "surveys.view_survey",
  responses: "surveys.view_survey",
  owners: "surveys.view_survey",
  surveyanalytics: "surveys.view_survey",
  settings: "surveys.view_survey",
  dhacdooyinka: [...DHACDO_MODULE_VIEW_PERMS],
  qaybaha: [...DHACDO_MODULE_VIEW_PERMS],
  noocaDhacdo: [...DHACDO_MODULE_VIEW_PERMS],
  citizens: "baaris.view_baariscitizenprofile",
  wanted: "baaris.view_baariscitizenprofile",
  visitors: "visitors.view_visitor",
  forces: "accounts.view_agent",
  personneldash: "accounts.view_agent",
  attendance: "personnel.attendance_view",
  districtmgmt: "accounts.view_agent",
  personnelreports: "personnel.attendance_view",
  agentimport: "personnel.agent_import",
  dailyreport: "suspects.view_daily_report",
  trackmap: "accounts.view_agent",
  appusers: "accounts.view_agent",
  apprelease: "accounts.view_agent",
  userreports: "accounts.view_agent",
  districttasks: "accounts.view_agent",
  ucusers: "accounts.view_user",
  ucgroups: "auth.view_group",
  ucqeybaha: "accounts.view_user",
  ucpermissions: "auth.view_permission",
  agents: "accounts.view_agent",
  audittrails: "audit.view_audittrail",
  errorlogs: "audit.view_errorlog",
  apitraffic: "audit.view_apitrafficlog",
};

/** Permission required for header "Add" actions. */
export const ADD_ACTION_PERMS: Record<string, string> = {
  suspect: "suspects.add_suspect",
  records: "hubkadhigis.add_disarmamentrecord",
  surveys: "surveys.add_survey",
  dhacdooyinka: "dhacdooyinka.add_dhacdooyinka",
  qaybaha: "dhacdooyinka.add_dhacdooyinka",
  noocaDhacdo: "dhacdooyinka.add_dhacdooyinka",
  citizens: "baaris.add_baariscitizenprofile",
  wanted: "baaris.add_baariscitizenprofile",
  visitors: "visitors.add_visitor",
  forces: "accounts.add_agent",
  ucusers: "accounts.add_user",
  ucgroups: "auth.add_group",
  ucqeybaha: "accounts.add_user",
  agents: "accounts.add_agent",
  agentimport: "personnel.agent_import",
};

export const EDIT_ACTION_PERMS: Record<string, string> = {
  records: "hubkadhigis.change_disarmamentrecord",
  suspect: "suspects.change_suspect",
  surveys: "surveys.change_survey",
  dhacdooyinka: "dhacdooyinka.change_dhacdooyinka",
  agents: "accounts.change_agent",
  forces: "accounts.change_agent",
  ucusers: "accounts.change_user",
  ucgroups: "auth.change_group",
  ucqeybaha: "accounts.change_user",
  visitors: "visitors.change_visitor",
};

export const DELETE_ACTION_PERMS: Record<string, string> = {
  records: "hubkadhigis.delete_disarmamentrecord",
  suspect: "suspects.delete_suspect",
  surveys: "surveys.delete_survey",
  dhacdooyinka: "dhacdooyinka.delete_dhacdooyinka",
  agents: "accounts.delete_agent",
  forces: "accounts.delete_agent",
  ucusers: "accounts.delete_user",
  ucgroups: "auth.delete_group",
  ucqeybaha: "accounts.delete_user",
  visitors: "visitors.delete_visitor",
};

/** Any one of these grants access to the module card on the launcher. */
export const MODULE_PERMS: Partial<Record<ModuleId, string[]>> = {
  hub: ["hubkadhigis.view_disarmamentrecord"],
  amniga: [
    "suspects.view_suspect",
    "accounts.view_agent",
    "suspects.view_daily_report",
    "personnel.agent_import",
    "personnel.attendance_view",
  ],
  survey: ["surveys.view_survey"],
  dhacdooyin: [...DHACDO_MODULE_VIEW_PERMS],
  baaris: [
    "baaris.view_baariscitizenprofile",
    "baaris.view_baaris_module",
  ],
  visitors: ["visitors.view_visitor"],
  usercontrol: [
    "accounts.view_user",
    "auth.view_group",
    "auth.view_permission",
    "audit.view_audittrail",
    "audit.view_errorlog",
    "audit.view_apitrafficlog",
  ],
};

export function isPrivileged(user?: User | null): boolean {
  return !!(user?.is_superuser || user?.is_staff || user?.is_admin);
}

export function canAccess(
  user: User | null | undefined,
  perm: string | string[] | null,
): boolean {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  if (perm === null) return true;
  const held = user.permissions ?? [];
  const needed = Array.isArray(perm) ? perm : [perm];
  return needed.some((p) => held.includes(p));
}

export function canViewMenu(user: User | null | undefined, menuId: string): boolean {
  const required = MENU_PERMS[menuId];
  if (required === undefined) return true;
  return canAccess(user, required);
}

export function canAddAction(user: User | null | undefined, menuId: string): boolean {
  const perm = ADD_ACTION_PERMS[menuId];
  if (!perm) return isPrivileged(user);
  return canAccess(user, perm);
}

export function canViewModule(user: User | null | undefined, moduleId: ModuleId): boolean {
  if (!user) return false;
  if (isPrivileged(user)) return true;
  const perms = MODULE_PERMS[moduleId];
  if (!perms?.length) return true;
  const held = user.permissions ?? [];
  return perms.some((p) => held.includes(p));
}

export function filterMenuItems<T extends { id: string; subs?: { id: string }[] }>(
  items: T[],
  user: User | null | undefined,
): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (!item.subs?.length) {
      if (canViewMenu(user, item.id)) out.push(item);
      continue;
    }
    const subs = item.subs.filter((sub) => canViewMenu(user, sub.id));
    if (!subs.length) continue;
    out.push({ ...item, subs } as T);
  }
  return out;
}

/** Survey response delete — privileged or explicit Django perm. */
export function canDeleteSurveyResponse(user?: User | null): boolean {
  return canAccess(user, "surveys.delete_surveyresponse");
}
