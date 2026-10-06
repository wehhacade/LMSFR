"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useCreateRequirement,
  useDeleteRequirement,
  useRequirements,
  useUpdateRequirement,
  useUtilities,
} from "@/hooks/use-dhacdooyinka";
import type { DhacdooyinkaRequirement } from "@/types/dhacdooyinka";
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

function selectStyle(C: AccountsThemeColors): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: `1px solid ${C.inputBdr}`,
    background: C.inputBg,
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    fontSize: "14px",
    outline: "none",
  };
}

function RequirementFormModal({
  open,
  onClose,
  C,
  accent,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  C: AccountsThemeColors;
  accent: string;
  initial?: DhacdooyinkaRequirement | null;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: utilities = [] } = useUtilities();
  const [type, setType] = useState("");
  const [utilityId, setUtilityId] = useState("");
  const create = useCreateRequirement();
  const update = useUpdateRequirement();
  const isEdit = !!initial;

  useEffect(() => {
    setType(initial?.type ?? "");
    setUtilityId(initial?.nooca_dhacdooyinka_guud ? String(initial.nooca_dhacdooyinka_guud) : "");
  }, [open, initial]);

  if (!open) return null;

  const pending = create.isPending || update.isPending;

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={isEdit ? t.dhacdoEditNooca : t.dhacdoAddNooca}
      subtitle={t.dhacdoNoocaSub}
      C={C}
      accent={accent}
      size="md"
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              const payload = {
                type: type.trim(),
                nooca_dhacdooyinka_guud: utilityId ? Number(utilityId) : null,
              };
              if (isEdit && initial) {
                update.mutate({ id: initial.id, payload }, { onSuccess: onClose });
              } else {
                create.mutate(payload, { onSuccess: onClose });
              }
            }}
            disabled={pending || !type.trim()}
            accent={accent}
          >
            {pending ? t.permSaving : isEdit ? t.userSave : t.dhacdoAddNooca}
          </PrimaryButton>
        </>
      }
    >
      <FormField label={t.dhacdoNoocaType} required C={C}>
        <TextInput value={type} onChange={setType} placeholder={t.dhacdoNoocaType} C={C} />
      </FormField>
      <FormField label={t.dhacdoQaybahaName} C={C}>
        <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} style={selectStyle(C)}>
          <option value="">{t.dhacdoSelectQaybaha}</option>
          {utilities.map((u) => (
            <option key={u.id} value={u.id}>{u.name || `${t.dhacdoQaybahaTitle} #${u.id}`}</option>
          ))}
        </select>
      </FormField>
    </AccountModal>
  );
}

export function DhacdooyinkaRequirementsListPage({
  C,
  accent,
  isDark,
  registerAddAction,
}: {
  C: AccountsThemeColors;
  accent: string;
  isDark: boolean;
  registerAddAction?: (open: () => void) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: utilities = [] } = useUtilities();
  const [utilityFilter, setUtilityFilter] = useState("");
  const { data: items = [], isLoading } = useRequirements("", utilityFilter);
  const showShimmer = isLoading && items.length === 0;
  const deleteRequirement = useDeleteRequirement();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DhacdooyinkaRequirement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DhacdooyinkaRequirement | null>(null);

  useEffect(() => {
    registerAddAction?.(() => {
      setEditTarget(null);
      setShowForm(true);
    });
  }, [registerAddAction]);

  const actionLabels = { view: t.viewAction, edit: t.editAction, delete: t.deleteAction };

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      <RequirementFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        C={C}
        accent={accent}
        initial={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t.confirmDelete}
        message={t.dhacdoConfirmDeleteNooca}
        confirmLabel={t.deleteAction}
        cancelLabel={t.cancelAction}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRequirement.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={deleteRequirement.isPending}
      />

      <p style={{ margin: "0 0 18px", fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", maxWidth: "560px", lineHeight: 1.5 }}>
        {t.dhacdoNoocaSub}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "18px", alignItems: "center" }}>
        <label style={{ fontSize: "13px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.dhacdoFilterQaybaha}</label>
        <select
          value={utilityFilter}
          onChange={(e) => setUtilityFilter(e.target.value)}
          style={{ ...selectStyle(C), width: "auto", minWidth: "200px" }}
        >
          <option value="">{t.dhacdoAllQaybaha}</option>
          {utilities.map((u) => (
            <option key={u.id} value={u.id}>{u.name || `${t.dhacdoQaybahaTitle} #${u.id}`}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 18px", borderRadius: "14px", background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: hexA(accent, 0.14), color: accent }}>
              <Icon name="list" size={18} sw={1.8} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.dhacdoNoocaTitle}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: C.txtPrimary, fontFamily: "var(--font-cinzel)" }}>{items.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {showShimmer ? (
          <ShimmerForcesTable />
        ) : items.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            <Icon name="list" size={26} sw={1.8} />
            <p style={{ marginTop: "12px" }}>{t.dhacdoNoNooca}</p>
            <PrimaryButton onClick={() => setShowForm(true)} accent={accent}>{t.dhacdoAddNooca}</PrimaryButton>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.dhacdoNoocaType, t.dhacdoQaybahaName, t.colCreated, t.colAction].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: `1px solid ${C.tableSep}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px 16px", color: C.txtPrimary, fontWeight: 600 }}>{row.type || "—"}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary }}>{row.utility_name || "—"}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary }}>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }} onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        actions={["edit", "delete"]}
                        onAction={(action) => {
                          if (action === "edit") {
                            setEditTarget(row);
                            setShowForm(true);
                          } else {
                            setDeleteTarget(row);
                          }
                        }}
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
