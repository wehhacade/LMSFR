import type { QueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/auth-api";
import type { PermissionItem } from "@/types/accounts";
import type { User } from "@/types";

export function permissionString(p: Pick<PermissionItem, "app_label" | "codename">): string {
  return `${p.app_label}.${p.codename}`;
}

export function patchMePermissions(
  queryClient: QueryClient,
  updater: (current: string[]) => string[],
): void {
  queryClient.setQueryData<User>(authKeys.me, (old) => {
    if (!old) return old;
    const next = updater(old.permissions ?? []);
    return { ...old, permissions: [...next].sort() };
  });
}

export function applyPermissionToggle(
  queryClient: QueryClient,
  perm: Pick<PermissionItem, "app_label" | "codename">,
  enabled: boolean,
): void {
  const code = permissionString(perm);
  patchMePermissions(queryClient, (perms) => {
    const set = new Set(perms);
    if (enabled) set.add(code);
    else set.delete(code);
    return Array.from(set);
  });
}

export function applyPermissionBulk(
  queryClient: QueryClient,
  items: Pick<PermissionItem, "app_label" | "codename">[],
  enabled: boolean,
): void {
  const codes = items.map(permissionString);
  patchMePermissions(queryClient, (perms) => {
    const set = new Set(perms);
    for (const code of codes) {
      if (enabled) set.add(code);
      else set.delete(code);
    }
    return Array.from(set);
  });
}

/** Force-refresh /auth/me/ and update every consumer (sidebar, launcher, Add buttons). */
export async function syncMePermissions(queryClient: QueryClient): Promise<User | undefined> {
  queryClient.removeQueries({ queryKey: authKeys.me });
  const user = await fetchMe({ fresh: true });
  queryClient.setQueryData(authKeys.me, user);
  return user;
}
