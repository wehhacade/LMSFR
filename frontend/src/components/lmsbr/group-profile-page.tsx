"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useAllPermissions,
  useDeleteGroup,
  useGroup,
  useUpdateGroup,
} from "@/hooks/use-accounts";
import { ShimmerSuspectProfile } from "./shimmer";
import {
  BackButton,
  ConfirmDialog,
  EntityHeader,
  FormField,
  FormRow,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import { CRUD_ORDER, groupPermissionsByAppModel } from "@/lib/permission-matrix";
import type { PermissionItem } from "@/types/accounts";

type TabId = "overview" | "permissions";

function PermToggle({ on, onClick, accent, isDark }: {
  on: boolean; onClick: () => void; accent: string; isDark: boolean;
}) {
  return (
    <button type="button" onClick={onClick} title={on ? "Assigned" : "Not assigned"}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "34px", height: "34px", borderRadius: "8px", border: "none", cursor: "pointer",
        background: on ? "rgba(70,192,138,0.18)" : hexA(accent, isDark ? 0.22 : 0.85),
        color: on ? "#46c08a" : "#fff",
      }}>
      <Icon name={on ? "check" : "shield"} size={15} sw={2} />
    </button>
  );
}

export function GroupProfilePage({
  groupId,
  initialMode = "view",
  onBack,
  C,
  accent,
  isDark,
}: {
  groupId: number;
  initialMode?: "view" | "edit";
  onBack: () => void;
  C: AccountsThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: group, isLoading, isError } = useGroup(groupId);
  const updateGroup = useUpdateGroup(groupId);
  const deleteGroup = useDeleteGroup();

  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [name, setName] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const deferredSearch = useDeferredValue(permSearch);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: allPermissions = [], isLoading: permsLoading } = useAllPermissions(deferredSearch);

  useEffect(() => {
    setMode(initialMode);
    setActiveTab(initialMode === "edit" ? "permissions" : "overview");
  }, [groupId, initialMode]);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setSelected(new Set(group.permissions.map((p) => p.id)));
    }
  }, [group]);

  const appGroups = useMemo(() => groupPermissionsByAppModel(allPermissions), [allPermissions]);

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !group) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
        <p style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{t.noGroups}</p>
        <SecondaryButton onClick={onBack} C={C}>{t.backToList}</SecondaryButton>
      </div>
    );
  }

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModel = (ids: number[], assign: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (assign) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const save = () => {
    updateGroup.mutate(
      { name: name.trim(), permission_ids: Array.from(selected) },
      { onSuccess: () => setMode("view") },
    );
  };

  const handleDelete = () => {
    deleteGroup.mutate(groupId, {
      onSuccess: () => {
        setConfirmDelete(false);
        onBack();
      },
    });
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "overview", label: t.groupTabOverview, icon: "home" },
    { id: "permissions", label: t.groupTabPerms, icon: "shield" },
  ];

  const headerActions = mode === "view" ? (
    <>
      <SecondaryButton onClick={() => { setMode("edit"); setActiveTab("permissions"); }} C={C}>{t.editAction}</SecondaryButton>
      <button type="button" onClick={() => setConfirmDelete(true)}
        style={{ padding: "11px 16px", borderRadius: "10px", border: "1px solid rgba(224,101,90,0.35)", background: "rgba(224,101,90,0.1)", color: "#e0655a", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "14px", fontWeight: 500 }}>
        {t.deleteAction}
      </button>
    </>
  ) : (
    <>
      <SecondaryButton onClick={() => { setMode("view"); setName(group.name); setSelected(new Set(group.permissions.map((p) => p.id))); }} C={C}>{t.cancelAction}</SecondaryButton>
      <PrimaryButton onClick={save} disabled={updateGroup.isPending || !name.trim()} accent={accent}>{updateGroup.isPending ? t.permSaving : t.saveGroup}</PrimaryButton>
    </>
  );

  return (
    <div style={{ animation: "is-fadeUp .45s ease both", marginTop: "20px" }}>
      <BackButton label={t.backToList} onClick={onBack} C={C} />

      <EntityHeader
        C={C}
        accent={accent}
        isDark={isDark}
        icon="shield"
        title={mode === "edit" ? `${t.groupEdit}: ${group.name}` : group.name}
        subtitle={mode === "edit" ? t.groupPermHelp : t.groupsSub}
        badges={[{ label: `${group.permission_count ?? selected.size} ${t.permissionsCount}`, color: accent }]}
        meta={mode === "view" ? [{ label: "ID", value: String(group.id) }] : undefined}
        actions={headerActions}
      />

      <div style={{ display: "flex", gap: "2px", borderBottom: `1px solid ${C.tableSep}`, marginBottom: "20px", overflowX: "auto" }}>
        {tabs.map((tab) => {
          const on = activeTab === tab.id;
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "7px", padding: "11px 16px", border: "none", cursor: "pointer",
                background: "transparent", fontFamily: "var(--font-outfit)", fontSize: "13.5px", fontWeight: on ? 600 : 400,
                color: on ? accent : C.txtMuted, borderBottom: on ? `2px solid ${accent}` : "2px solid transparent", marginBottom: "-1px", whiteSpace: "nowrap",
              }}>
              <Icon name={tab.icon} size={15} sw={on ? 2.2 : 1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div style={{ padding: "26px 28px", borderRadius: "16px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow }}>
          {mode === "edit" ? (
            <FormRow columns={1}>
              <FormField label={t.groupName} required C={C}>
                <TextInput value={name} onChange={setName} placeholder={t.groupName} C={C} />
              </FormField>
            </FormRow>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              {[
                { label: t.groupName, value: group.name },
                { label: t.permissionsCount, value: String(group.permission_count ?? group.permissions.length) },
                { label: "ID", value: String(group.id) },
              ].map((row) => (
                <div key={row.label} style={{ padding: "14px 16px", borderRadius: "12px", background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead, border: `1px solid ${C.tableSep}` }}>
                  <div style={{ fontSize: "11px", letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted, marginBottom: "6px", fontFamily: "var(--font-outfit)" }}>{row.label}</div>
                  <div style={{ fontSize: "15px", fontWeight: 500, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>{row.value}</div>
                </div>
              ))}
            </div>
          )}
          {mode === "view" && (
            <p style={{ margin: "20px 0 0", fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", lineHeight: 1.5 }}>
              {t.groupPermHelp} {t.permLiveHint}
            </p>
          )}
        </div>
      )}

      {activeTab === "permissions" && (
        <div style={{ borderRadius: "16px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.tableSep}`, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", gap: "9px", padding: "10px 14px", borderRadius: "10px", background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
              <Icon name="search" size={16} sw={1.8} />
              <input value={permSearch} onChange={(e) => setPermSearch(e.target.value)} placeholder={t.searchPermissions} disabled={mode === "view"}
                style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px", flex: 1 }} />
            </div>
            <span style={{ fontSize: "13px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{selected.size} {t.permissionsCount}</span>
          </div>

          {permsLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: C.txtMuted }}>Loading…</div>
          ) : (
            <div style={{ maxHeight: "480px", overflowY: "auto", padding: "16px 22px 22px" }}>
              {appGroups.map((app) => (
                <div key={app.app_label} style={{ marginBottom: "18px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted, marginBottom: "10px", fontFamily: "var(--font-outfit)" }}>
                    {app.app_label}
                  </div>
                  {app.models.map((modelRow) => {
                    const ids = CRUD_ORDER.map((a) => modelRow.crud[a]?.id).filter((id): id is number => id != null);
                    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
                    return (
                      <div key={`${app.app_label}-${modelRow.model}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${C.tableSep}`, marginBottom: "8px", background: isDark ? "rgba(255,255,255,0.02)" : "#fafbfc" }}>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 500, color: C.txtPrimary, fontFamily: "var(--font-outfit)", textTransform: "capitalize" }}>{modelRow.model}</div>
                          <div style={{ fontSize: "12px", color: C.txtMuted, fontFamily: "var(--font-outfit)", marginTop: "2px" }}>{app.app_label}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {mode === "edit" && ids.length > 0 && (
                            <button type="button" onClick={() => toggleModel(ids, !allOn)}
                              style={{ padding: "5px 10px", borderRadius: "7px", border: `1px solid ${hexA(accent, 0.3)}`, background: hexA(accent, 0.08), color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "11px", fontWeight: 600 }}>
                              {allOn ? t.permUncheckAll : t.permCheckAll}
                            </button>
                          )}
                          {CRUD_ORDER.map((action) => {
                            const p: PermissionItem | undefined = modelRow.crud[action];
                            if (!p) return null;
                            const on = selected.has(p.id);
                            if (mode === "view") {
                              return on ? (
                                <span key={p.id} style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", background: hexA(accent, 0.12), color: accent, fontFamily: "var(--font-outfit)", textTransform: "capitalize" }}>{action}</span>
                              ) : null;
                            }
                            return <PermToggle key={p.id} on={on} onClick={() => toggle(p.id)} accent={accent} isDark={isDark} />;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t.confirmDelete}
        message={t.confirmDeleteGroup}
        confirmLabel={t.deleteGroup}
        cancelLabel={t.cancelAction}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        C={C}
        accent={accent}
        pending={deleteGroup.isPending}
      />
    </div>
  );
}
