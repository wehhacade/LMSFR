"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA, type ModuleId } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useAllGroups,
  useAllPermissions,
  usePermissionAssignments,
  usePermissionHolders,
  useUser,
  useUsersForPicker,
} from "@/hooks/use-accounts";
import { usePermissions } from "@/hooks/use-permissions";
import {
  accountKeys,
  assignUserGroups,
  RECENT_USERS_LIMIT,
  updateGroup,
  updateUser,
  type PermissionHolder,
} from "@/lib/accounts-api";
import { applyPermissionBulk, applyPermissionToggle } from "@/lib/live-permissions";
import {
  CRUD_ORDER,
  groupPermissionsByAppModel,
  modelPermissionIds,
  type ModelPermissionRow,
} from "@/lib/permission-matrix";
import {
  PERM_MODULE_META,
  PERM_MODULE_ORDER,
  permModuleFor,
  permModuleLabel,
  type PermModuleKey,
} from "@/lib/permission-modules";
import {
  permissionCodesFromIds,
  previewAccessFromPerms,
} from "@/lib/permission-preview";
import type { PermissionItem } from "@/types/accounts";
import { toast } from "@/components/ui/use-toast";
import { ShimmerForcesTable } from "./shimmer";
import { createPortal } from "react-dom";

type ThemeColors = {
  cardBg: string;
  cardBdr: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  tableHead: string;
  tableHov: string;
  txtPrimary: string;
  txtSecondary: string;
  txtMuted: string;
  inputBg: string;
  inputBdr: string;
};

type AssignMode = "group" | "user";

function crudLabel(action: string, t: ReturnType<typeof getDict>): string {
  if (action === "add") return t.permCrudAdd;
  if (action === "view") return t.permCrudView;
  if (action === "change") return t.permCrudChange;
  if (action === "delete") return t.permCrudDelete;
  return action;
}

function crudColor(action: string): string {
  if (action === "view") return "#5b9fd4";
  if (action === "add") return "#46c08a";
  if (action === "change") return "#e6b25c";
  if (action === "delete") return "#e0655a";
  return "#8b7cf6";
}

function SwitchToggle({
  checked,
  inherited,
  disabled,
  pending,
  accent,
  onToggle,
}: {
  checked: boolean;
  inherited?: boolean;
  disabled?: boolean;
  pending?: boolean;
  accent: string;
  onToggle: () => void;
}) {
  const on = checked || inherited;
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={checked}
      title={inherited && !checked ? "Inherited from group" : undefined}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: on
          ? inherited && !checked
            ? hexA(accent, 0.35)
            : "#46c08a"
          : "rgba(148,163,184,0.35)",
        opacity: disabled ? 0.45 : pending ? 0.65 : 1,
        transition: "background .2s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          transition: "left .2s ease",
        }}
      />
    </button>
  );
}

function HoldersPopover({
  permissionId,
  count,
  holderCounts,
  accent,
  C,
  t,
}: {
  permissionId: number;
  count: number;
  holderCounts?: Record<string, number>;
  accent: string;
  C: ThemeColors;
  t: ReturnType<typeof getDict>;
}) {
  const [open, setOpen] = useState(false);
  const { data: holders = [], isLoading } = usePermissionHolders(open ? permissionId : null);
  const displayCount = count || Number(holderCounts?.[String(permissionId)] ?? 0);

  if (displayCount === 0) {
    return (
      <span style={{ fontSize: 11, color: C.txtMuted, fontStyle: "italic", fontFamily: "var(--font-outfit)" }}>
        {t.permNoUsers}
      </span>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${hexA(accent, 0.28)}`,
          background: hexA(accent, 0.08),
          color: accent,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "var(--font-outfit)",
        }}
      >
        <Icon name="users" size={12} sw={2} />
        {displayCount}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 30,
            minWidth: 220,
            maxWidth: 280,
            maxHeight: 220,
            overflowY: "auto",
            padding: 10,
            borderRadius: 12,
            background: C.panelBg,
            border: `1px solid ${C.cardBdr}`,
            boxShadow: C.panelShadow,
          }}
        >
          {isLoading ? (
            <span style={{ fontSize: 12, color: C.txtMuted }}>…</span>
          ) : (
            holders.map((h: PermissionHolder) => (
              <div
                key={`${h.id}-${h.via}-${h.group_id ?? "d"}`}
                style={{
                  fontSize: 12,
                  padding: "6px 4px",
                  borderBottom: `1px solid ${C.tableSep}`,
                  color: C.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                }}
              >
                {h.name}
                <span style={{ marginLeft: 6, fontSize: 10, color: C.txtMuted }}>
                  {h.via === "group" ? h.group_name : t.permDirect}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function PermissionsListPage({ C, accent }: { C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const queryClient = useQueryClient();
  const { user: me, sync } = usePermissions();

  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [assignMode, setAssignMode] = useState<AssignMode>("group");
  const [moduleFilter, setModuleFilter] = useState<PermModuleKey>("amniga");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [groupPermIds, setGroupPermIds] = useState<Set<number>>(new Set());
  const [userPermIds, setUserPermIds] = useState<Set<number>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewExpandedModules, setPreviewExpandedModules] = useState<Set<ModuleId>>(new Set());
  const [expandedModelKeys, setExpandedModelKeys] = useState<Set<string>>(new Set());

  const deferred = useDeferredValue(search);
  const deferredUserSearch = useDeferredValue(userSearch);

  const { data: permissions = [], isLoading } = useAllPermissions(deferred);
  const { data: groups = [] } = useAllGroups();
  const { data: usersPage, isLoading: usersLoading } = useUsersForPicker(deferredUserSearch);
  const users = usersPage?.results ?? [];
  const totalUserCount = usersPage?.count ?? 0;
  const isUserSearching = deferredUserSearch.trim().length > 0;
  const { data: assignments, isLoading: assignmentsLoading } = usePermissionAssignments();
  const { data: userDetail } = useUser(assignMode === "user" ? selectedUserId : null);
  const holderCounts = assignments?.permission_holder_counts;

  useEffect(() => {
    if (assignMode === "group" && selectedGroupId === null && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [assignMode, groups, selectedGroupId]);

  useEffect(() => {
    if (assignMode === "user" && selectedUserId === null && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [assignMode, users, selectedUserId]);

  useEffect(() => {
    if (!selectedGroupId || !assignments) return;
    const g = assignments.groups.find((x) => x.id === selectedGroupId);
    if (g) setGroupPermIds(new Set(g.permission_ids));
  }, [selectedGroupId, assignments]);

  useEffect(() => {
    if (assignMode !== "user" || !selectedUserId) return;
    if (userDetail?.id === selectedUserId) {
      setUserPermIds(new Set(userDetail.permissions.map((p) => p.id)));
      return;
    }
    const u = assignments?.users.find((x) => x.id === selectedUserId);
    if (u) setUserPermIds(new Set(u.permission_ids));
  }, [assignMode, selectedUserId, userDetail, assignments]);

  const permissionById = useMemo(() => {
    const map = new Map<number, PermissionItem>();
    for (const p of permissions) map.set(p.id, p);
    return map;
  }, [permissions]);

  const selectedUserAssignment = useMemo(() => {
    if (!selectedUserId) return null;
    const fromAssignments = assignments?.users.find((u) => u.id === selectedUserId);
    if (fromAssignments) return fromAssignments;
    if (userDetail?.id === selectedUserId) {
      return {
        id: userDetail.id,
        name: userDetail.full_name || userDetail.email,
        permission_ids: userDetail.permissions.map((p) => p.id),
        group_ids: userDetail.groups.map((g) => g.id),
      };
    }
    return null;
  }, [selectedUserId, assignments, userDetail]);

  const currentUserInSelectedGroup = useMemo(() => {
    if (!me?.id || !selectedGroupId || !assignments) return false;
    const group = assignments.groups.find((g) => g.id === selectedGroupId);
    return group?.members.some((m) => m.id === me.id) ?? false;
  }, [me?.id, selectedGroupId, assignments]);

  const affectsCurrentUser =
    assignMode === "user" ? selectedUserId === me?.id : currentUserInSelectedGroup;

  const saveGroupMutation = useMutation({
    mutationFn: ({ groupId, permission_ids }: { groupId: number; permission_ids: number[] }) =>
      updateGroup(groupId, { permission_ids }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.permissionAssignments });
      void queryClient.invalidateQueries({ queryKey: ["accounts", "permission-holders"] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.groups });
      toast({ title: "Permissions saved" });
    },
    onError: async () => {
      toast({ title: "Could not save permissions", variant: "destructive" });
      if (selectedGroupId && assignments) {
        const g = assignments.groups.find((x) => x.id === selectedGroupId);
        if (g) setGroupPermIds(new Set(g.permission_ids));
      }
      if (affectsCurrentUser && sync) await sync();
    },
  });

  const saveUserMutation = useMutation({
    mutationFn: ({ userId, permission_ids }: { userId: string; permission_ids: number[] }) =>
      updateUser(userId, { permission_ids }),
    onSuccess: async (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.permissionAssignments });
      void queryClient.invalidateQueries({ queryKey: ["accounts", "permission-holders"] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      if (userId === me?.id && sync) await sync();
      toast({ title: "Permissions saved" });
    },
    onError: async () => {
      toast({ title: "Could not save permissions", variant: "destructive" });
      if (selectedUserId && assignments) {
        const u = assignments.users.find((x) => x.id === selectedUserId);
        if (u) setUserPermIds(new Set(u.permission_ids));
      }
      if (affectsCurrentUser && sync) await sync();
    },
  });

  const assignGroupsMutation = useMutation({
    mutationFn: ({ userId, group_ids }: { userId: string; group_ids: number[] }) =>
      assignUserGroups(userId, group_ids),
    onSuccess: async (_, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.permissionAssignments });
      void queryClient.invalidateQueries({ queryKey: accountKeys.user(userId) });
      if (userId === me?.id && sync) await sync();
      toast({ title: "User groups updated" });
    },
    onError: () => toast({ title: "Could not update groups", variant: "destructive" }),
  });

  const saving =
    saveGroupMutation.isPending || saveUserMutation.isPending || assignGroupsMutation.isPending;
  const canToggle = assignMode === "group" ? !!selectedGroupId : !!selectedUserId;

  const isDirectChecked = (permId: number) =>
    assignMode === "group" ? groupPermIds.has(permId) : userPermIds.has(permId);

  const isInherited = (permId: number): boolean => {
    if (assignMode !== "user" || !selectedUserId || !assignments) return false;
    const groupIds = selectedUserAssignment?.group_ids ?? [];
    return groupIds.some((gid) => {
      const g = assignments.groups.find((x) => x.id === gid);
      return g?.permission_ids.includes(permId);
    });
  };

  const persistPermissions = (next: Set<number>) => {
    if (assignMode === "group" && selectedGroupId) {
      setGroupPermIds(next);
      saveGroupMutation.mutate({ groupId: selectedGroupId, permission_ids: Array.from(next) });
    } else if (assignMode === "user" && selectedUserId) {
      setUserPermIds(next);
      saveUserMutation.mutate({ userId: selectedUserId, permission_ids: Array.from(next) });
    }
  };

  const togglePermission = (permId: number) => {
    const perm = permissionById.get(permId);
    const enabling = !isDirectChecked(permId);
    if (affectsCurrentUser && perm) applyPermissionToggle(queryClient, perm, enabling);

    const base = assignMode === "group" ? groupPermIds : userPermIds;
    const next = new Set(base);
    if (next.has(permId)) next.delete(permId);
    else next.add(permId);
    persistPermissions(next);
  };

  const bulkSetPermissions = (ids: number[], checked: boolean) => {
    if (affectsCurrentUser) {
      const items = ids.map((id) => permissionById.get(id)).filter((p): p is PermissionItem => p != null);
      applyPermissionBulk(queryClient, items, checked);
    }
    const base = assignMode === "group" ? groupPermIds : userPermIds;
    const next = new Set(base);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    persistPermissions(next);
  };

  const moduleGroups = useMemo(() => {
    const appGroups = groupPermissionsByAppModel(permissions);
    const buckets = new Map<PermModuleKey, ModelPermissionRow[]>();
    for (const key of PERM_MODULE_ORDER) buckets.set(key, []);

    for (const app of appGroups) {
      for (const model of app.models) {
        const mod = permModuleFor(app.app_label, model.model);
        buckets.get(mod)!.push(model);
      }
    }

    for (const rows of buckets.values()) {
      rows.sort((a, b) => a.model.localeCompare(b.model));
    }

    return buckets;
  }, [permissions]);

  const activeModuleRows = moduleGroups.get(moduleFilter) ?? [];
  const activeModulePermIds = useMemo(
    () => activeModuleRows.flatMap((row) => modelPermissionIds(row)),
    [activeModuleRows],
  );
  const enabledInModule = activeModulePermIds.filter(
    (id) => isDirectChecked(id) || isInherited(id),
  ).length;

  const moduleTabs = PERM_MODULE_ORDER.filter((key) => (moduleGroups.get(key)?.length ?? 0) > 0);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const selectedUser =
    users.find((u) => u.id === selectedUserId) ??
    (userDetail?.id === selectedUserId ? userDetail : undefined);

  const previewPermCodes = useMemo(() => {
    if (assignMode === "group") {
      return permissionCodesFromIds(groupPermIds, permissionById);
    }
    const ids = new Set(userPermIds);
    for (const gid of selectedUserAssignment?.group_ids ?? []) {
      const g = assignments?.groups.find((x) => x.id === gid);
      for (const pid of g?.permission_ids ?? []) ids.add(pid);
    }
    return permissionCodesFromIds(ids, permissionById);
  }, [
    assignMode,
    groupPermIds,
    userPermIds,
    permissionById,
    selectedUserAssignment,
    assignments,
  ]);

  const accessPreview = useMemo(
    () => previewAccessFromPerms(previewPermCodes, lang),
    [previewPermCodes, lang],
  );
  const visibleModules = accessPreview.filter((m) => m.visible);

  const openPreview = () => {
    setPreviewExpandedModules(new Set(visibleModules.map((m) => m.moduleId)));
    setPreviewOpen(true);
  };

  const togglePreviewModule = (moduleId: ModuleId) => {
    setPreviewExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleModelKey = (key: string) => {
    setExpandedModelKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loading = isLoading && permissions.length === 0;

  return (
    <div style={{ marginTop: 16, animation: "is-fadeUp .45s ease both" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 300px) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
        className="perm-admin-layout"
      >
        {/* Sidebar — target picker */}
        <aside
          style={{
            borderRadius: 16,
            background: C.panelBg,
            border: `1px solid ${C.cardBdr}`,
            boxShadow: C.panelShadow,
            overflow: "hidden",
            position: "sticky",
            top: 12,
          }}
        >
          <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.tableSep}` }}>
            <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 16, fontWeight: 600, color: C.txtPrimary }}>
              {t.permissionsTitle}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.txtMuted, lineHeight: 1.5, fontFamily: "var(--font-outfit)" }}>
              {t.permissionsSub}
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 12, padding: 4, borderRadius: 10, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
              {(["group", "user"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAssignMode(mode)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                    fontSize: 12,
                    fontWeight: 600,
                    background: assignMode === mode ? accent : "transparent",
                    color: assignMode === mode ? "#fff" : C.txtSecondary,
                  }}
                >
                  {mode === "group" ? t.permByGroup : t.permByUser}
                </button>
              ))}
            </div>
          </div>

          {assignMode === "group" ? (
            <div style={{ maxHeight: "min(62vh, 560px)", overflowY: "auto", padding: 10 }}>
              {groups.map((g) => {
                const active = selectedGroupId === g.id;
                const memberCount = assignments?.groups.find((x) => x.id === g.id)?.members.length ?? 0;
                const permCount = active
                  ? groupPermIds.size
                  : assignments?.groups.find((x) => x.id === g.id)?.permission_ids.length ?? g.permission_count;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroupId(g.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 12px",
                      marginBottom: 6,
                      borderRadius: 12,
                      cursor: "pointer",
                      border: `1px solid ${active ? hexA(accent, 0.45) : C.inputBdr}`,
                      background: active ? hexA(accent, 0.1) : "transparent",
                      fontFamily: "var(--font-outfit)",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: active ? accent : C.txtPrimary }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 3 }}>
                      {permCount} {t.permissionsCount} · {memberCount} {t.permMembers}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: C.inputBg, border: `1px solid ${C.inputBdr}`, marginBottom: 8 }}>
                <Icon name="search" size={15} sw={1.8} />
                <input
                  placeholder={t.permSearchUsers}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 13, flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={{ maxHeight: "min(48vh, 420px)", overflowY: "auto" }}>
                {usersLoading ? (
                  <div style={{ padding: 12, color: C.txtMuted, fontSize: 13 }}>…</div>
                ) : users.length === 0 ? (
                  <div style={{ padding: 12, color: C.txtMuted, fontSize: 13, fontStyle: "italic" }}>{t.permNoUserResults}</div>
                ) : (
                  users.map((u) => {
                    const active = selectedUserId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          marginBottom: 5,
                          borderRadius: 10,
                          cursor: "pointer",
                          border: `1px solid ${active ? hexA("#8b7cf6", 0.45) : C.inputBdr}`,
                          background: active ? hexA("#8b7cf6", 0.1) : "transparent",
                          fontFamily: "var(--font-outfit)",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: active ? "#8b7cf6" : C.txtPrimary }}>
                          {u.full_name || u.email}
                        </div>
                        <div style={{ fontSize: 10, color: C.txtMuted, marginTop: 2 }}>{u.email}</div>
                      </button>
                    );
                  })
                )}
              </div>
              {!isUserSearching && totalUserCount > RECENT_USERS_LIMIT && (
                <p style={{ margin: "8px 4px 0", fontSize: 11, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.permSearchHint}</p>
              )}
              {selectedUser && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.tableSep}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: C.txtMuted, marginBottom: 8, fontFamily: "var(--font-outfit)" }}>
                    {t.permUserGroups}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {groups.map((g) => {
                      const member = selectedUserAssignment?.group_ids.includes(g.id) ?? false;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          disabled={assignGroupsMutation.isPending}
                          onClick={() => {
                            if (!selectedUserId || !selectedUserAssignment) return;
                            const current = selectedUserAssignment.group_ids;
                            const next = current.includes(g.id)
                              ? current.filter((id) => id !== g.id)
                              : [...current, g.id];
                            assignGroupsMutation.mutate({ userId: selectedUserId, group_ids: next });
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            border: `1px solid ${member ? hexA(accent, 0.45) : C.inputBdr}`,
                            background: member ? hexA(accent, 0.12) : C.inputBg,
                            color: member ? accent : C.txtSecondary,
                            fontSize: 11,
                            fontWeight: member ? 600 : 500,
                            cursor: "pointer",
                            fontFamily: "var(--font-outfit)",
                          }}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Main panel — module-based permissions */}
        <section style={{ minWidth: 0 }}>
          <div
            style={{
              borderRadius: 16,
              background: C.panelBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: C.panelShadow,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.tableSep}`, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 17, fontWeight: 600, color: C.txtPrimary }}>
                  {assignMode === "group" ? selectedGroup?.name ?? t.permSelectGroup : selectedUser?.full_name ?? selectedUser?.email ?? t.permSelectUser}
                </div>
                <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)" }}>
                  {enabledInModule} / {activeModulePermIds.length} {t.permissionsCount} · {permModuleLabel(moduleFilter, lang)}
                  {saving && <span style={{ marginLeft: 8, color: accent }}>{t.permSaving}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={!canToggle}
                  onClick={openPreview}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${hexA("#8b7cf6", 0.4)}`,
                    background: hexA("#8b7cf6", 0.1),
                    color: "#8b7cf6",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: canToggle ? "pointer" : "not-allowed",
                    fontFamily: "var(--font-outfit)",
                    opacity: canToggle ? 1 : 0.5,
                  }}
                >
                  <Icon name="open" size={14} sw={1.9} />
                  {t.permPreview}
                </button>
                <button type="button" disabled={!canToggle || saving || !activeModulePermIds.length}
                  onClick={() => bulkSetPermissions(activeModulePermIds, true)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${hexA("#46c08a", 0.35)}`, background: hexA("#46c08a", 0.08), color: "#46c08a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)" }}>
                  {t.permCheckAll}
                </button>
                <button type="button" disabled={!canToggle || saving || !activeModulePermIds.length}
                  onClick={() => bulkSetPermissions(activeModulePermIds, false)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${hexA(accent, 0.3)}`, background: hexA(accent, 0.06), color: accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)" }}>
                  {t.permUncheckAll}
                </button>
                <button
                  type="button"
                  disabled={!activeModuleRows.length}
                  onClick={() => setExpandedModelKeys(new Set(activeModuleRows.map((r) => `${r.app_label}.${r.model}`)))}
                  style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)" }}
                >
                  {t.permExpandAll}
                </button>
                <button
                  type="button"
                  disabled={!activeModuleRows.length}
                  onClick={() => setExpandedModelKeys(new Set())}
                  style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)" }}
                >
                  {t.permCollapseAll}
                </button>
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.tableSep}`, display: "flex", gap: 8, flexWrap: "wrap", overflowX: "auto" }}>
              {moduleTabs.map((key) => {
                const meta = PERM_MODULE_META[key];
                const count = moduleGroups.get(key)?.length ?? 0;
                const active = moduleFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModuleFilter(key)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: `1px solid ${active ? hexA(meta.accent, 0.45) : C.inputBdr}`,
                      background: active ? hexA(meta.accent, 0.12) : C.inputBg,
                      color: active ? meta.accent : C.txtSecondary,
                      fontFamily: "var(--font-outfit)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Icon name={meta.icon} size={14} sw={1.8} />
                    {permModuleLabel(key, lang)}
                    <span style={{ opacity: 0.7, fontSize: 10 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.tableSep}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
                <Icon name="search" size={16} sw={1.8} />
                <input
                  placeholder={t.searchPermissions}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 14, flex: 1, minWidth: 0 }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 16 }}><ShimmerForcesTable /></div>
            ) : activeModuleRows.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.noPermissions}</div>
            ) : (
              <div style={{ padding: "8px 12px 16px" }}>
                {activeModuleRows.map((row) => {
                  const rowIds = modelPermissionIds(row);
                  const rowEnabled = rowIds.filter((id) => isDirectChecked(id) || isInherited(id)).length;
                  const rowKey = `${row.app_label}.${row.model}`;
                  const rowOpen = expandedModelKeys.has(rowKey);
                  return (
                    <div key={rowKey} style={{ marginBottom: 12, borderRadius: 14, border: `1px solid ${C.cardBdr}`, overflow: "hidden", background: C.cardBg }}>
                      <button
                        type="button"
                        onClick={() => toggleModelKey(rowKey)}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          border: "none",
                          borderBottom: rowOpen ? `1px solid ${C.tableSep}` : "none",
                          background: hexA(PERM_MODULE_META[moduleFilter].accent, 0.05),
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              color: C.txtMuted,
                              transform: rowOpen ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform .2s ease",
                            }}
                          >
                            <Icon name="chevron" size={16} sw={2} />
                          </span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.txtPrimary, fontFamily: "var(--font-outfit)", textTransform: "capitalize" }}>
                              {row.model.replace(/_/g, " ")}
                            </div>
                            <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 2, fontFamily: "monospace" }}>{rowKey}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: C.txtMuted, fontFamily: "var(--font-outfit)", flexShrink: 0 }}>
                          {rowEnabled}/{rowIds.length}
                        </div>
                      </button>

                      {rowOpen && (
                      <div style={{ padding: "8px 10px" }}>
                        {CRUD_ORDER.map((action) => {
                          const perm = row.crud[action];
                          if (!perm) return null;
                          const checked = isDirectChecked(perm.id);
                          const inherited = isInherited(perm.id);
                          return (
                            <div
                              key={perm.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                                gap: 10,
                                alignItems: "center",
                                padding: "10px 8px",
                                borderBottom: `1px solid ${C.tableSep}`,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>{perm.name}</div>
                                <div style={{ fontSize: 10, fontFamily: "monospace", color: C.txtMuted, marginTop: 2 }}>{perm.codename}</div>
                                {inherited && !checked && (
                                  <div style={{ fontSize: 10, color: accent, marginTop: 3, fontFamily: "var(--font-outfit)" }}>{t.permInherited}</div>
                                )}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: crudColor(action), fontFamily: "var(--font-outfit)", textTransform: "uppercase" }}>
                                {crudLabel(action, t)}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <HoldersPopover
                                  permissionId={perm.id}
                                  count={0}
                                  holderCounts={holderCounts}
                                  accent={accent}
                                  C={C}
                                  t={t}
                                />
                                <SwitchToggle
                                  checked={checked}
                                  inherited={inherited}
                                  disabled={!canToggle}
                                  pending={saving}
                                  accent={accent}
                                  onToggle={() => togglePermission(perm.id)}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {row.extra.map((perm) => {
                          const checked = isDirectChecked(perm.id);
                          const inherited = isInherited(perm.id);
                          return (
                            <div
                              key={perm.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                                gap: 10,
                                alignItems: "center",
                                padding: "10px 8px",
                                borderBottom: `1px solid ${C.tableSep}`,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>{perm.name}</div>
                                <div style={{ fontSize: 10, fontFamily: "monospace", color: C.txtMuted, marginTop: 2 }}>{perm.codename}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#8b7cf6", fontFamily: "var(--font-outfit)" }}>EXTRA</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <HoldersPopover permissionId={perm.id} count={0} holderCounts={holderCounts} accent={accent} C={C} t={t} />
                                <SwitchToggle checked={checked} inherited={inherited} disabled={!canToggle} pending={saving} accent={accent} onToggle={() => togglePermission(perm.id)} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${hexA(accent, 0.2)}`, background: hexA(accent, 0.05), fontFamily: "var(--font-outfit)", fontSize: 12, color: C.txtSecondary, lineHeight: 1.55 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Icon name="shield" size={16} sw={1.8} />
              <span>{t.permissionsHint}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6, color: accent }}>
              <Icon name="clock" size={16} sw={1.8} />
              <span>{t.permLiveHint}</span>
            </div>
          </div>
        </section>
      </div>

      {previewOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setPreviewOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              background: "rgba(8,6,4,0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(720px, 100%)",
                maxHeight: "min(82vh, 860px)",
                overflow: "auto",
                borderRadius: 18,
                background: C.panelBg,
                border: `1px solid ${C.cardBdr}`,
                boxShadow: "0 30px 80px -30px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.tableSep}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 18, fontWeight: 600, color: C.txtPrimary }}>{t.permPreviewTitle}</div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: C.txtMuted, lineHeight: 1.5, fontFamily: "var(--font-outfit)", maxWidth: 520 }}>
                    {t.permPreviewSub}
                  </p>
                  <div style={{ marginTop: 8, fontSize: 12, color: accent, fontFamily: "var(--font-outfit)", fontWeight: 600 }}>
                    {assignMode === "group"
                      ? selectedGroup?.name
                      : selectedUser?.full_name || selectedUser?.email}
                    {" · "}
                    {visibleModules.length} {t.permPreviewModules.toLowerCase()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${C.inputBdr}`,
                    background: C.inputBg,
                    color: C.txtMuted,
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                  aria-label={t.permPreviewClose}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: 16 }}>
                {visibleModules.length === 0 ? (
                  <div style={{ padding: "28px 16px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 14 }}>
                    {t.permPreviewNone}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setPreviewExpandedModules(new Set(accessPreview.map((m) => m.moduleId)))}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)" }}
                      >
                        {t.permExpandAll}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewExpandedModules(new Set())}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtSecondary, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)" }}
                      >
                        {t.permCollapseAll}
                      </button>
                    </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {accessPreview.map((mod) => {
                      const meta = PERM_MODULE_META[mod.moduleId] ?? PERM_MODULE_META.system;
                      const isOpen = previewExpandedModules.has(mod.moduleId);
                      return (
                        <div
                          key={mod.moduleId}
                          style={{
                            borderRadius: 14,
                            border: `1px solid ${mod.visible ? hexA(meta.accent, 0.35) : C.cardBdr}`,
                            background: mod.visible ? hexA(meta.accent, 0.06) : C.cardBg,
                            opacity: mod.visible ? 1 : 0.55,
                            overflow: "hidden",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => togglePreviewModule(mod.moduleId)}
                            style={{
                              width: "100%",
                              padding: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                              fontFamily: "inherit",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  color: C.txtMuted,
                                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                                  transition: "transform .2s ease",
                                }}
                              >
                                <Icon name="chevron" size={16} sw={2} />
                              </span>
                              <span
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: hexA(meta.accent, 0.14),
                                  color: meta.accent,
                                  flexShrink: 0,
                                }}
                              >
                                <Icon name={meta.icon} size={16} sw={1.8} />
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 15, fontWeight: 600, color: C.txtPrimary }}>{mod.name}</div>
                                <div style={{ fontSize: 11, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                                  {mod.visible
                                    ? `${mod.menus.length} ${t.permPreviewMenus.toLowerCase()}`
                                    : t.permPreviewHidden}
                                </div>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: mod.visible ? hexA("#46c08a", 0.14) : hexA(C.txtMuted, 0.12),
                                color: mod.visible ? "#46c08a" : C.txtMuted,
                                fontFamily: "var(--font-outfit)",
                                flexShrink: 0,
                              }}
                            >
                              {mod.visible ? "ON" : "OFF"}
                            </span>
                          </button>

                          {isOpen && mod.visible && mod.menus.length > 0 && (
                            <div style={{ padding: "0 14px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {mod.menus.map((menu) => (
                                <span
                                  key={menu.id}
                                  style={{
                                    display: "inline-flex",
                                    flexDirection: "column",
                                    gap: 4,
                                    padding: "7px 10px",
                                    borderRadius: 10,
                                    background: C.panelBg,
                                    border: `1px solid ${C.inputBdr}`,
                                    fontFamily: "var(--font-outfit)",
                                  }}
                                >
                                  <span style={{ fontSize: 12, fontWeight: 600, color: C.txtPrimary }}>{menu.label}</span>
                                  {menu.subs && menu.subs.length > 0 && (
                                    <span style={{ fontSize: 10, color: C.txtMuted }}>
                                      {menu.subs.map((s) => s.label).join(" · ")}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          {isOpen && !mod.visible && (
                            <div style={{ padding: "0 14px 14px", fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                              {t.permPreviewHidden}
                            </div>
                          )}
                          {isOpen && mod.visible && mod.menus.length === 0 && (
                            <div style={{ padding: "0 14px 14px", fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)", fontStyle: "italic" }}>
                              Dashboard only
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>

              <div style={{ padding: "12px 16px 16px", borderTop: `1px solid ${C.tableSep}`, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: accent,
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                  }}
                >
                  {t.permPreviewClose}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx global>{`
        @media (max-width: 960px) {
          .perm-admin-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
