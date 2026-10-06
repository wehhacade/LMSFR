import type { PermissionItem } from "@/types/accounts";

export type CrudAction = "add" | "view" | "change" | "delete";

export interface ModelPermissionRow {
  app_label: string;
  model: string;
  crud: Partial<Record<CrudAction, PermissionItem>>;
  extra: PermissionItem[];
}

export interface AppPermissionGroup {
  app_label: string;
  models: ModelPermissionRow[];
  allIds: number[];
}

const CRUD_ORDER: CrudAction[] = ["add", "view", "change", "delete"];

export function parseCrudAction(codename: string): CrudAction | null {
  for (const action of CRUD_ORDER) {
    if (codename.startsWith(`${action}_`)) return action;
  }
  return null;
}

export function groupPermissionsByAppModel(permissions: PermissionItem[]): AppPermissionGroup[] {
  const apps = new Map<string, Map<string, ModelPermissionRow>>();

  for (const p of permissions) {
    const app = p.app_label || "other";
    if (!apps.has(app)) apps.set(app, new Map());
    const models = apps.get(app)!;
    if (!models.has(p.model)) {
      models.set(p.model, { app_label: app, model: p.model, crud: {}, extra: [] });
    }
    const row = models.get(p.model)!;
    const action = parseCrudAction(p.codename);
    if (action) row.crud[action] = p;
    else row.extra.push(p);
  }

  return Array.from(apps.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([app_label, modelMap]) => {
      const models = Array.from(modelMap.values()).sort((a, b) => a.model.localeCompare(b.model));
      const allIds = models.flatMap((m) => [
        ...CRUD_ORDER.map((a) => m.crud[a]?.id).filter((id): id is number => id != null),
        ...m.extra.map((e) => e.id),
      ]);
      return { app_label, models, allIds };
    });
}

export function modelPermissionIds(row: ModelPermissionRow): number[] {
  return [
    ...CRUD_ORDER.map((a) => row.crud[a]?.id).filter((id): id is number => id != null),
    ...row.extra.map((e) => e.id),
  ];
}

export { CRUD_ORDER };
