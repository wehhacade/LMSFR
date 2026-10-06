"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useDeleteDhacdooyinkaRecord,
  useDhacdooyinkaRecords,
  useDhacdooyinkaStats,
} from "@/hooks/use-dhacdooyinka";
import { ShimmerForcesTable } from "./shimmer";
import { DhacdooyinkaFormModal } from "./dhacdooyinka-form-modal";
import { DhacdooyinkaProfilePage } from "./dhacdooyinka-profile-page";
import { ConfirmDialog, RowActions, type AccountsThemeColors } from "./accounts-shared";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import type { DhacdooyinkaRecord } from "@/types/dhacdooyinka";

type ThemeColors = AccountsThemeColors;

const MONTHS = [
  { value: "", label: "All Months" },
  ...Array.from({ length: 12 }, (_, i) => {
    const v = String(i + 1).padStart(2, "0");
    return { value: v, label: v };
  }),
];

function yearsAroundNow(count = 6) {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => String(y - i));
}

function formatEventDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const abs = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  let rel = "";
  if (days < 1) rel = "today";
  else if (days === 1) rel = "1 day ago";
  else if (days < 7) rel = `${days} days ago`;
  else if (days < 30) rel = `${Math.floor(days / 7)} weeks ago`;
  else rel = `${Math.floor(days / 30)} months ago`;
  return `${abs} — (${rel})`;
}

function FilterSelect({
  value, onChange, options, C, accent, isDark, minWidth = 120,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  minWidth?: number;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "10px 12px",
        borderRadius: "10px",
        border: `1px solid ${value ? hexA(accent, 0.45) : C.inputBdr}`,
        background: C.inputBg,
        color: C.txtPrimary,
        fontFamily: "var(--font-outfit)",
        fontSize: "14px",
        minWidth,
        cursor: "pointer",
        boxShadow: value && !isDark ? `0 0 0 3px ${hexA(accent, 0.08)}` : undefined,
      }}
    >
      {options.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function DhacdooyinkaListPage({
  C, accent, isDark, search = "", profileId, setProfileId, victimId, setVictimId, registerAddAction,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  search?: string;
  profileId?: number | null;
  setProfileId?: (id: number | null) => void;
  victimId?: number | null;
  setVictimId?: (id: number | null) => void;
  registerAddAction?: (open: () => void) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const deferredSearch = useDeferredValue(search);

  const [page, setPage] = useState(1);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [localProfileId, setLocalProfileId] = useState<number | null>(null);
  const activeProfileId = profileId ?? localProfileId;
  const openProfile = setProfileId ?? setLocalProfileId;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DhacdooyinkaRecord | null>(null);

  const filters = useMemo(() => ({ year, month, search: deferredSearch }), [year, month, deferredSearch]);

  const { data, isLoading, isFetching } = useDhacdooyinkaRecords({
    page,
    search: deferredSearch,
    year,
    month,
    page_size: pageSize,
  });
  const { data: stats } = useDhacdooyinkaStats(filters);
  const deleteRecord = useDeleteDhacdooyinkaRecord();

  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showShimmer = isLoading && rows.length === 0;

  useEffect(() => { setPage(1); }, [deferredSearch, year, month, pageSize]);

  useEffect(() => {
    registerAddAction?.(() => { setEditId(null); setShowForm(true); });
  }, [registerAddAction]);

  const yearOptions = useMemo(
    () => [{ value: "", label: t.dhacdoAllYears }, ...yearsAroundNow().map((y) => ({ value: y, label: y }))],
    [t.dhacdoAllYears],
  );
  const monthOptions = useMemo(
    () => MONTHS.map((m, i) => (i === 0 ? { ...m, label: t.dhacdoAllMonths } : m)),
    [t.dhacdoAllMonths],
  );

  const actionLabels = { view: t.viewAction, edit: t.editAction, delete: t.deleteAction };
  const paginationLabels = { prev: t.prev, next: t.next, page: t.page, of: t.of };

  if (activeProfileId !== null) {
    return (
      <>
        <DhacdooyinkaProfilePage
          recordId={activeProfileId}
          onBack={() => openProfile(null)}
          onEdit={() => { setEditId(activeProfileId); setShowForm(true); }}
          C={C}
          accent={accent}
          isDark={isDark}
          victimId={victimId}
          setVictimId={setVictimId}
        />
        <DhacdooyinkaFormModal
          open={showForm}
          onClose={() => { setShowForm(false); setEditId(null); }}
          recordId={editId}
          C={C}
          accent={accent}
        />
      </>
    );
  }

  return (
    <div style={{ marginTop: 24, animation: "is-fadeUp .5s ease both" }}>
      <DhacdooyinkaFormModal open={showForm} onClose={() => { setShowForm(false); setEditId(null); }} recordId={editId} C={C} accent={accent} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t.confirmDelete}
        message={t.dhacdoConfirmDeleteEvent}
        confirmLabel={t.deleteAction}
        cancelLabel={t.cancelAction}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRecord.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={deleteRecord.isPending}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => { setEditId(null); setShowForm(true); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: `0 4px 14px -4px ${hexA(accent, 0.45)}` }}
        >
          <Icon name="plus" size={17} sw={2} /> {t.dhacdoAddEvent}
        </button>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <FilterSelect value={year} onChange={setYear} options={yearOptions} C={C} accent={accent} isDark={isDark} minWidth={100} />
          <FilterSelect value={month} onChange={setMonth} options={monthOptions} C={C} accent={accent} isDark={isDark} minWidth={130} />
        </div>
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      <div style={{ borderRadius: 14, background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {showShimmer ? (
          <ShimmerForcesTable />
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            <Icon name="calendar" size={26} sw={1.8} />
            <p style={{ marginTop: 12 }}>{t.dhacdoNoEvents}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", minWidth: 900 }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.dhacdoColTx, t.dhacdoColWaaxda, t.dhacdoCiddaFulisay, t.dhacdoNoocaType, t.dhacdoDhimasho, t.dhacdoDhaawac, t.dhacdoColVictims, t.dhacdoColDate, t.colAction].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: `1px solid ${C.tableSep}` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => openProfile(row.id)}
                        style={{
                          padding: 0, border: "none", background: "transparent", cursor: "pointer",
                          fontSize: 13, fontWeight: 600, color: accent, fontFamily: "var(--font-outfit)",
                          letterSpacing: ".02em", textDecoration: "none",
                        }}
                      >
                        {row.tixraac_lambar || "—"}
                      </button>
                    </td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary, maxWidth: 260 }}>{row.location_display}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 8, background: hexA("#dc2626", 0.12), color: "#b91c1c", fontSize: 13, fontWeight: 500 }}>
                        {row.cidda_fulisay || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary }}>{row.nooca_dhacdada_name || "—"}</td>
                    <td style={{ padding: "14px 16px", color: C.txtPrimary, textAlign: "center" }}>{row.dhimasho ?? "0"}</td>
                    <td style={{ padding: "14px 16px", color: C.txtPrimary, textAlign: "center" }}>{row.dhaawac ?? "0"}</td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 28, padding: "4px 10px", borderRadius: 8,
                        background: hexA(accent, 0.12), color: accent, fontSize: 13, fontWeight: 600,
                      }}>
                        {row.victim_count ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: C.txtMuted, fontSize: 13, minWidth: 220 }}>{formatEventDate(row.date_recorded)}</td>
                    <td style={{ padding: "14px 16px" }} onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        actions={["edit", "delete"]}
                        iconOnly
                        onAction={(action) => {
                          if (action === "edit") { setEditId(row.id); setShowForm(true); }
                          else setDeleteTarget(row);
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

        <Pagination
          page={page}
          totalPages={totalPages}
          total={stats?.total ?? total}
          totalLabel={`${t.dhacdoTotal}: ${stats?.total ?? total}`}
          onPage={setPage}
          isFetching={isFetching}
          C={C}
          accent={accent}
          isDark={isDark}
          labels={paginationLabels}
        />
      </div>
    </div>
  );
}
