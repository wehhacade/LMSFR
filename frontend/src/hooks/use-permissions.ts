"use client";

import { useCallback, useContext, useMemo } from "react";
import {
  canAccess,
  canAddAction,
  canViewMenu,
  canViewModule,
  DELETE_ACTION_PERMS,
  EDIT_ACTION_PERMS,
  filterMenuItems,
  isPrivileged,
} from "@/lib/permissions";
import type { ModuleId } from "@/lib/lmsbr/data";
import { PermissionsContext } from "@/components/providers/permissions-provider";
import { useMe } from "@/hooks/use-auth";

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  const { data: me, isLoading: meLoading, isFetching, refetch } = useMe();

  const permissions = ctx?.permissions ?? me?.permissions ?? [];
  const revision = ctx?.revision ?? 0;
  const isLoading = ctx?.isLoading ?? meLoading;

  const effectiveUser = useMemo(() => {
    const base = ctx?.user ?? me;
    if (!base) return undefined;
    return { ...base, permissions };
  }, [ctx?.user, me, permissions, revision]);

  const can = useCallback(
    (perm: string | string[] | null) => canAccess(effectiveUser, perm),
    [effectiveUser],
  );

  const canViewMenuItem = useCallback(
    (menuId: string) => canViewMenu(effectiveUser, menuId),
    [effectiveUser],
  );

  const canAdd = useCallback(
    (menuId: string) => canAddAction(effectiveUser, menuId),
    [effectiveUser],
  );

  const canEdit = useCallback(
    (menuId: string) => {
      const perm = EDIT_ACTION_PERMS[menuId];
      if (!perm) return isPrivileged(effectiveUser);
      return canAccess(effectiveUser, perm);
    },
    [effectiveUser],
  );

  const canDelete = useCallback(
    (menuId: string) => {
      const perm = DELETE_ACTION_PERMS[menuId];
      if (!perm) return isPrivileged(effectiveUser);
      return canAccess(effectiveUser, perm);
    },
    [effectiveUser],
  );

  const canModule = useCallback(
    (moduleId: ModuleId) => canViewModule(effectiveUser, moduleId),
    [effectiveUser],
  );

  const filterMenu = useCallback(
    <T extends { id: string }>(items: T[]) => filterMenuItems(items, effectiveUser),
    [effectiveUser],
  );

  return {
    user: effectiveUser,
    permissions,
    revision,
    isLoading,
    isFetching,
    refetch,
    sync: ctx?.sync,
    isPrivileged: isPrivileged(effectiveUser),
    can,
    canViewMenuItem,
    canAdd,
    canEdit,
    canDelete,
    canModule,
    filterMenu,
  };
}
