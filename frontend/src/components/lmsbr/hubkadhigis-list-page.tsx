"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import {
  formatRecordDate,
  personImageUrl,
  primaryGalleryImageUrl,
  recordStatus,
  weaponImageUrl,
} from "@/lib/record-display";
import { Icon } from "./icon";
import { HubRecordThumbStack } from "./hubkadhigis-record-thumb";
import { HubGalleryPhotoCard } from "./hub-gallery-photo-card";
import {
  useDeleteDisarmamentRecord,
  useDisarmamentRecords,
  useHubkadhigisLookups,
} from "@/hooks/use-hubkadhigis";
import { fetchCounties } from "@/lib/accounts-api";
import { useQuery } from "@tanstack/react-query";
import { ShimmerSuspectGrid, ShimmerSuspectList } from "./shimmer";
import { HubkadhigisProfilePage } from "./hubkadhigis-profile-page";
import { HubkadhigisFormModal } from "./hubkadhigis-form-modal";
import { ConfirmDialog, RowActions, type AccountsThemeColors } from "./accounts-shared";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import type { DisarmamentRecord } from "@/types/hubkadhigis";

type ThemeColors = AccountsThemeColors & {
  cardBg: string;
  cardBdrHov: string;
  cardShadow: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  tableHead: string;
  tableHov: string;
  inputBg: string;
  inputBdr: string;
  txtMuted: string;
  txtSecondary: string;
  txtPrimary: string;
  btnBg: string;
  btnBdr: string;
};

type ViewMode = "grid" | "list";

const VIEW_STORAGE_KEY = "lmsbr-hub-records-view";

function ViewToggle({
  mode, setMode, C, accent, isDark, t,
}: {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
}) {
  const btn = (m: ViewMode, label: string, icon: string) => {
    const on = mode === m;
    return (
      <button type="button" onClick={() => setMode(m)} title={label}
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
          border: "none", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 500, transition: ".2s",
          background: on ? (isDark ? hexA(accent, 0.22) : hexA(accent, 0.12)) : "transparent",
          color: on ? (isDark ? "#f3ead9" : accent) : C.txtMuted,
          boxShadow: on ? `inset 0 0 0 1px ${hexA(accent, 0.35)}` : "none",
        }}
      >
        <span style={{ display: "flex" }}><Icon name={icon} size={16} sw={1.9} /></span>
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", padding: 4, borderRadius: 11, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
      {btn("grid", t.gridView, "grid")}
      {btn("list", t.listView, "list")}
    </div>
  );
}

function FilterSelect({
  value, onChange, options, placeholder, C, accent, isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: `1px solid ${value ? hexA(accent, 0.45) : C.inputBdr}`,
        background: C.inputBg,
        color: value ? C.txtPrimary : C.txtSecondary,
        fontFamily: "var(--font-outfit)",
        fontSize: "14px",
        minWidth: "160px",
        cursor: "pointer",
        boxShadow: value && !isDark ? `0 0 0 3px ${hexA(accent, 0.08)}` : undefined,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function StatusPill({ status, t }: { status: ReturnType<typeof recordStatus>; t: ReturnType<typeof getDict> }) {
  const handed = status === "handed_over";
  const color = handed ? "#059669" : "#C69049";
  return (
    <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color, fontFamily: "var(--font-outfit)", whiteSpace: "nowrap", textAlign: "right" }}>
      {handed ? t.hubStatusHandedOver : t.hubStatusRegistered}
    </span>
  );
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", fontSize: "12px", fontWeight: 600,
      padding: "4px 10px", borderRadius: 20, color, background: bg,
      border: `1px solid ${hexA(color, 0.25)}`, fontFamily: "var(--font-outfit)", letterSpacing: ".03em",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export function HubkadhigisListPage({
  C, accent, isDark, search, profileId, setProfileId, registerAddAction,
  moduleName,
  moduleTagline,
}: {
  C: ThemeColors; accent: string; isDark: boolean; search: string;
  profileId: number | null; setProfileId: (id: number | null) => void;
  registerAddAction?: (fn: () => void) => void;
  moduleName?: string;
  moduleTagline?: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { canEdit, canDelete, canAdd } = usePermissions();
  const allowAdd = canAdd("records");
  const allowEdit = canEdit("records");
  const allowDelete = canDelete("records");
  const rowActions: ("view" | "edit" | "delete")[] = [
    "view",
    ...(allowEdit ? ["edit" as const] : []),
    ...(allowDelete ? ["delete" as const] : []),
  ];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [view, setView] = useState<ViewMode>("list");
  const [status, setStatus] = useState<"" | "handed_over" | "registered">("");
  const [weaponType, setWeaponType] = useState("");
  const [forceUnit, setForceUnit] = useState("");
  const [county, setCounty] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [prefillFrom, setPrefillFrom] = useState<DisarmamentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisarmamentRecord | null>(null);
  const deferredSearch = useDeferredValue(search);

  const { data: lookups } = useHubkadhigisLookups();
  const { data: counties = [] } = useQuery({ queryKey: ["counties"], queryFn: fetchCounties });
  const { data, isLoading, isFetching } = useDisarmamentRecords({
    page, pageSize, search: deferredSearch, weapon_type: weaponType, force_unit: forceUnit, county,
    status,
  });
  const del = useDeleteDisarmamentRecord();

  useEffect(() => {
    registerAddAction?.(() => { setEditId(null); setModalOpen(true); });
  }, [registerAddAction]);

  useEffect(() => { setPage(1); }, [deferredSearch, weaponType, forceUnit, county, status, pageSize]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "list") setView(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch { /* ignore */ }
  }, [view]);

  if (profileId !== null) {
    return (
      <>
        <HubkadhigisProfilePage
          recordId={profileId}
          onBack={() => setProfileId(null)}
          onEdit={() => { setEditId(profileId); setPrefillFrom(null); setModalOpen(true); }}
          onRegisterNew={(r) => { setPrefillFrom(r); setEditId(null); setModalOpen(true); }}
          onOpenRecord={(id) => setProfileId(id)}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <HubkadhigisFormModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditId(null); setPrefillFrom(null); }}
          editId={editId}
          prefillFrom={prefillFrom}
          C={C}
          accent={accent}
        />
      </>
    );
  }

  const records = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasFilters = !!(weaponType || forceUnit || county || status);
  const showShimmer = isLoading && records.length === 0;

  const clearFilters = () => {
    setWeaponType("");
    setForceUnit("");
    setCounty("");
    setStatus("");
  };

  const listTitle = t.hubRecordsTitle;
  const listSubtitle = moduleTagline ?? t.hubRecordsSub;

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div
        className="hub-compact-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: accent,
              boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
            }} />
            {moduleName && (
              <span style={{
                fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
                color: accent, fontWeight: 600, fontFamily: "var(--font-outfit)",
              }}>
                {moduleName}
              </span>
            )}
          </div>
          <h1 style={{
            fontFamily: "var(--font-cinzel)",
            fontWeight: 600,
            fontSize: "clamp(22px, 2.8vw, 30px)",
            color: C.txtPrimary,
            margin: 0,
            lineHeight: 1.15,
          }}>
            {listTitle}
          </h1>
          {listSubtitle && (
            <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.45 }}>
              {listSubtitle}
            </p>
          )}
        </div>
        {allowAdd && (
          <button
            type="button"
            onClick={() => { setEditId(null); setModalOpen(true); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 18px",
              borderRadius: 10, border: isDark ? `1px solid ${hexA(accent, 0.4)}` : "none",
              background: `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.65)})`,
              color: "#fff", fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14,
              cursor: "pointer",
              boxShadow: isDark ? `0 12px 28px -12px ${hexA(accent, 0.42)}` : `0 4px 14px -4px ${hexA(accent, 0.45)}`,
              transition: ".3s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
          >
            <Icon name="plus" size={17} sw={2} />
            {t.hubAddRecord}
          </button>
        )}
      </div>

      <div style={{
        borderRadius: 14,
        overflow: "hidden",
        background: C.panelBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.panelShadow,
        marginBottom: 16,
      }}>
        <div style={{
          padding: "18px 22px",
          borderBottom: `1px solid ${C.tableSep}`,
          background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
        }}>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <ViewToggle mode={view} setMode={setView} C={C} accent={accent} isDark={isDark} t={t} />
              <div style={{ fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                {isLoading ? "…" : `${totalCount} ${totalCount === 1 ? "record" : "records"}`}
                {deferredSearch ? ` · "${deferredSearch}"` : ""}
                {isFetching && !showShimmer ? " · …" : ""}
              </div>
            </div>
            {hasFilters && (
              <button type="button" onClick={clearFilters}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtSecondary,
                  fontFamily: "var(--font-outfit)", fontSize: 13, cursor: "pointer",
                }}
              >
                <Icon name="close" size={14} sw={2} />
                {t.hubClearFilters}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <FilterSelect
              value={status}
              onChange={(v) => setStatus(v as "" | "handed_over" | "registered")}
              placeholder={t.filterAllStatus}
              options={[
                { value: "handed_over", label: t.filterStatusHanded },
                { value: "registered", label: t.filterStatusRegistered },
              ]}
              C={C} accent={accent} isDark={isDark}
            />
            <FilterSelect
              value={weaponType}
              onChange={setWeaponType}
              placeholder={t.filterAllWeapon}
              options={(lookups?.weapon_types ?? []).map((w) => ({ value: String(w.id), label: w.name }))}
              C={C} accent={accent} isDark={isDark}
            />
            <FilterSelect
              value={forceUnit}
              onChange={setForceUnit}
              placeholder={t.filterAllUnit}
              options={(lookups?.force_units ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
              C={C} accent={accent} isDark={isDark}
            />
            <FilterSelect
              value={county}
              onChange={setCounty}
              placeholder={t.filterDistrict}
              options={counties.map((c) => ({ value: String(c.id), label: c.name }))}
              C={C} accent={accent} isDark={isDark}
            />
          </div>
        </div>

        <div style={{ padding: "0 22px" }}>
          <TableRowsSelect
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            C={C}
            label={lang === "so" ? "Tiro" : "Rows"}
          />
        </div>

        {showShimmer ? (
          <div style={{ padding: view === "grid" ? 20 : "8px 0" }}>
            {view === "grid" ? <ShimmerSuspectGrid count={pageSize} /> : <ShimmerSuspectList />}
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.1), color: accent,
            }}>
              <Icon name="archive" size={28} sw={1.8} />
            </div>
            <p style={{ margin: 0, color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontSize: 15, fontWeight: 500 }}>{t.hubNoResults}</p>
            <p style={{ margin: "8px 0 0", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>
              {hasFilters || deferredSearch ? t.hubClearFilters : t.hubAddRecord}
            </p>
          </div>
        ) : view === "grid" ? (
          <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 16 }}>
            {records.map((r) => (
              <HubGalleryPhotoCard
                key={r.id}
                record={r}
                accent={accent}
                isDark={isDark}
                border={C.cardBdr}
                onClick={() => setProfileId(r.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr>
                  {[t.hubGallery, t.hubRef, t.hubPersonName, t.hubWeaponType, t.hubWeaponSerial, t.hubSurrenderDate, t.colStatus, t.colAction].map((col) => (
                    <th key={col} style={{
                      textAlign: col === t.colStatus ? "right" : "left", padding: "13px 16px", fontSize: 11, fontWeight: 500,
                      letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted,
                      background: C.tableHead, fontFamily: "var(--font-outfit)",
                      borderBottom: `1px solid ${C.tableSep}`,
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const statusVal = recordStatus(r);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setProfileId(r.id)}
                      style={{
                        borderTop: i === 0 ? "none" : `1px solid ${C.tableSep}`,
                        transition: ".2s",
                        cursor: "pointer",
                        animation: "is-fadeUp .4s ease both",
                        animationDelay: `${i * 0.03}s`,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.tableHov; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <HubRecordThumbStack
                          weaponUrl={weaponImageUrl(r)}
                          personUrl={primaryGalleryImageUrl(r) ?? personImageUrl(r)}
                          personName={r.person_name}
                          size={44}
                          border={C.cardBdr}
                        />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: accent, fontFamily: "var(--font-outfit)",
                          letterSpacing: ".02em",
                        }}>{r.reference_number}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>{r.person_name}</div>
                        {r.phone_number && (
                          <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 2, fontFamily: "var(--font-outfit)" }}>{r.phone_number}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {r.weapon_type_name ? (
                          <Badge color={accent} bg={hexA(accent, 0.12)}>{r.weapon_type_name}</Badge>
                        ) : (
                          <span style={{ color: C.txtMuted, fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                        {r.weapon_serial || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                        {formatRecordDate(r.surrender_date ?? r.created_at) ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <StatusPill status={statusVal} t={t} />
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          C={C} accent={accent}
                          labels={{ view: t.viewAction, edit: t.editAction, delete: t.deleteAction }}
                          actions={rowActions}
                          onAction={(action) => {
                            if (action === "view") setProfileId(r.id);
                            if (action === "edit") { setEditId(r.id); setModalOpen(true); }
                            if (action === "delete") setDeleteTarget(r);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ background: C.tableHead }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            C={C}
            accent={accent}
            isDark={isDark}
            labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
            totalLabel={`${totalCount} ${totalCount === 1 ? "record" : "records"}${totalPages > 1 ? ` · ${t.page} ${page} ${t.of} ${totalPages}` : ""}`}
            isFetching={isFetching}
          />
        </div>
      </div>

      <HubkadhigisFormModal open={modalOpen} onClose={() => { setModalOpen(false); setEditId(null); }} editId={editId} C={C} accent={accent} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t.confirmDelete}
        message={t.confirmDeleteHub}
        confirmLabel={t.deleteAction}
        cancelLabel={t.cancelAction}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={del.isPending}
      />
    </div>
  );
}
