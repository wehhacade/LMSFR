"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useAllGroups,
  useCreateGroup,
  useDeleteGroup,
} from "@/hooks/use-accounts";
import type { GroupSummary } from "@/types/accounts";
import { GroupProfilePage } from "./group-profile-page";
import {
  AccountModal,
  ConfirmDialog,
  FormField,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import { ShimmerForcesTable } from "./shimmer";

function CreateGroupModal({ open, onClose, C, accent }: {
  open: boolean; onClose: () => void; C: AccountsThemeColors; accent: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [name, setName] = useState("");
  const create = useCreateGroup();

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  if (!open) return null;

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={t.addGroup}
      subtitle={t.groupCreateSub}
      C={C}
      accent={accent}
      size="md"
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton
            onClick={() => create.mutate({ name: name.trim(), permission_ids: [] }, { onSuccess: onClose })}
            disabled={create.isPending || !name.trim()}
            accent={accent}
          >
            {create.isPending ? t.permSaving : t.addGroup}
          </PrimaryButton>
        </>
      }
    >
      <FormField label={t.groupName} required C={C}>
        <TextInput value={name} onChange={setName} placeholder={t.groupName} C={C} />
      </FormField>
    </AccountModal>
  );
}

export function GroupsListPage({
  C, accent, isDark, registerAddAction,
}: {
  C: AccountsThemeColors; accent: string; isDark: boolean;
  registerAddAction?: (open: () => void) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: groups = [], isLoading } = useAllGroups();
  const showShimmer = isLoading && groups.length === 0;
  const deleteGroup = useDeleteGroup();

  const [showCreate, setShowCreate] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileMode, setProfileMode] = useState<"view" | "edit">("view");
  const [deleteTarget, setDeleteTarget] = useState<GroupSummary | null>(null);

  useEffect(() => {
    registerAddAction?.(() => setShowCreate(true));
  }, [registerAddAction]);

  const openCreate = () => setShowCreate(true);

  const handleRowAction = (g: GroupSummary, action: "view" | "edit" | "delete") => {
    if (action === "delete") {
      setDeleteTarget(g);
      return;
    }
    setProfileMode(action === "edit" ? "edit" : "view");
    setProfileId(g.id);
  };

  if (profileId !== null) {
    return (
      <GroupProfilePage
        groupId={profileId}
        initialMode={profileMode}
        onBack={() => { setProfileId(null); setProfileMode("view"); }}
        C={C}
        accent={accent}
        isDark={isDark}
      />
    );
  }

  const actionLabels = { view: t.viewAction, edit: t.editAction, delete: t.deleteAction };

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} C={C} accent={accent} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t.confirmDelete}
        message={t.confirmDeleteGroup}
        confirmLabel={t.deleteGroup}
        cancelLabel={t.cancelAction}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteGroup.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={deleteGroup.isPending}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <p style={{ margin: 0, fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", maxWidth: "520px", lineHeight: 1.5 }}>
          {t.groupsSub}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        {[
          { label: t.groupsTitle, value: groups.length, icon: "shield" },
          { label: t.permissionsCount, value: groups.reduce((s, g) => s + (g.permission_count ?? 0), 0), icon: "badge" },
        ].map((k, i) => (
          <div key={i} style={{ padding: "16px 18px", borderRadius: "14px", background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: hexA(accent, 0.14), color: accent }}>
                <Icon name={k.icon} size={18} sw={1.8} />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{k.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: C.txtPrimary, fontFamily: "var(--font-cinzel)" }}>{k.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {showShimmer ? (
          <ShimmerForcesTable />
        ) : groups.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            <Icon name="shield" size={26} sw={1.8} />
            <p style={{ marginTop: "12px" }}>{t.noGroups}</p>
            <PrimaryButton onClick={openCreate} accent={accent}>{t.addGroup}</PrimaryButton>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.groupName, t.permissionsCount, t.colAction].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr
                    key={g.id}
                    style={{ borderBottom: `1px solid ${C.tableSep}`, cursor: "pointer" }}
                    onClick={() => handleRowAction(g, "view")}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px 16px", color: C.txtPrimary, fontWeight: 600 }}>{g.name}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <Icon name="badge" size={14} sw={1.8} />
                        {g.permission_count ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <RowActions
                        actions={["view", "edit", "delete"]}
                        onAction={(action) => handleRowAction(g, action)}
                        C={C}
                        accent={accent}
                        labels={actionLabels}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
