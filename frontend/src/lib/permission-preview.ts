import {
  canViewMenu,
  canViewModule,
  filterMenuItems,
} from "@/lib/permissions";
import {
  getModules,
  MODULE_ORDER,
  type Lang,
  type MenuItem,
  type ModuleId,
} from "@/lib/lmsbr/data";
import type { User } from "@/types";

export interface PreviewMenuItem {
  id: string;
  label: string;
  subs?: { id: string; label: string }[];
}

export interface ModuleAccessPreview {
  moduleId: ModuleId;
  name: string;
  visible: boolean;
  menus: PreviewMenuItem[];
}

function asPreviewUser(permissionCodes: string[]): User {
  return {
    id: "preview",
    email: "preview@local",
    username: "preview",
    first_name: "",
    last_name: "",
    full_name: "Preview",
    phone: "",
    bio: null,
    profile_url: null,
    is_admin: false,
    is_officer: false,
    is_agent: false,
    is_active: true,
    suspend: false,
    is_superuser: false,
    is_staff: false,
    role: "user",
    directorate_id: null,
    directorate_name: null,
    county_id: null,
    county_name: null,
    permissions: permissionCodes,
    date_joined: "",
    last_login: null,
  };
}

/** Simulate launcher + sidebar visibility for a permission set. */
export function previewAccessFromPerms(
  permissionCodes: string[],
  lang: Lang = "en",
): ModuleAccessPreview[] {
  const user = asPreviewUser(permissionCodes);
  const mods = getModules(lang);

  return MODULE_ORDER.map((moduleId) => {
    const def = mods[moduleId];
    const visible = canViewModule(user, moduleId);
    const menus = visible
      ? filterMenuItems(def.menu as MenuItem[], user).map((item) => ({
          id: item.id,
          label: item.label,
          subs: item.subs?.map((s) => ({ id: s.id, label: s.label })),
        }))
      : [];

    return {
      moduleId,
      name: def.name,
      visible,
      menus,
    };
  });
}

export function permissionCodesFromIds(
  ids: Iterable<number>,
  byId: Map<number, { app_label: string; codename: string }>,
): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p) out.push(`${p.app_label}.${p.codename}`);
  }
  return out;
}

export function canViewMenuWithPerms(permissionCodes: string[], menuId: string): boolean {
  return canViewMenu(asPreviewUser(permissionCodes), menuId);
}
