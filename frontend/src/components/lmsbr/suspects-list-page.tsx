"use client";

import { useEffect, useLayoutEffect, useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { formatCaptureDateTime, suspectCaptureDistrict, tuhunkaColor, tuhunkaLabel } from "@/lib/lmsbr/suspect-utils";
import { fetchCounties } from "@/lib/accounts-api";
import { Icon } from "./icon";
import { SuspectPhoto } from "./suspect-photo";
import { SuspectPhotoPreview } from "./suspect-photo-preview";
import { useDeleteSuspect, useSuspectStats, useSuspectTypes, useSuspects } from "@/hooks/use-suspects";
import { ShimmerSuspectGrid, ShimmerSuspectList, ShimmerKPI } from "./shimmer";
import { SuspectProfilePage } from "./suspect-profile-page";
import { SuspectFormModal } from "./suspect-form-modal";
import { BailCountBadge } from "./bail-count-badge";
import { ConfirmDialog, RowActions, type AccountsThemeColors } from "./accounts-shared";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { UserProfilePage } from "./user-profile-page";
import type { Suspect } from "@/types/suspect";

type ThemeColors = AccountsThemeColors & {
  cardBdrHov: string; cardShadow: string; panelShadow: string; tableSep: string; tableHead: string; tableHov: string;
  txtAccentHd: string; btnBg: string; btnBdr: string; btnColor: string;
};

type ViewMode = "grid" | "list";

function SuspectAvatar({ suspect, size, accent, onPreview }: { suspect: Suspect; size: number; accent: string; onPreview?: (e: React.MouseEvent) => void }) {
  const initials = suspect.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  const radius = size > 60 ? 14 : 12;

  if (!suspect.photo) {
    return (
      <div onClick={onPreview} style={{ width:size, height:size, borderRadius:radius, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(135deg,${accent},${hexA(accent,0.5)})`, color:"#fff", fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:size * 0.32, cursor: onPreview ? "zoom-in" : undefined }}>
        {initials}
      </div>
    );
  }

  return (
    <div onClick={onPreview} style={{ position:"relative", width:size, height:size, borderRadius:radius, overflow:"hidden", flexShrink:0, border:`2px solid ${hexA(accent,0.35)}`, cursor: onPreview ? "zoom-in" : undefined }}>
      <SuspectPhoto
        photo={suspect.photo}
        alt={suspect.name}
        loading="eager"
        fallback={
          <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(135deg,${accent},${hexA(accent,0.5)})`, color:"#fff", fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:size * 0.32 }}>
            {initials}
          </div>
        }
      />
    </div>
  );
}

function ViewToggle({ mode, setMode, C, accent, isDark, t }: { mode: ViewMode; setMode: (m: ViewMode) => void; C: ThemeColors; accent: string; isDark: boolean; t: ReturnType<typeof getDict> }) {
  const btn = (m: ViewMode, label: string, icon: string) => {
    const on = mode === m;
    return (
      <button onClick={() => setMode(m)} title={label}
        style={{ display:"flex", alignItems:"center", gap:"7px", padding:"8px 14px", borderRadius:"9px", border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"13px", fontWeight:500, transition:".2s",
          background: on ? (isDark ? hexA(accent, 0.22) : hexA(accent, 0.12)) : "transparent",
          color: on ? (isDark ? "#f3ead9" : accent) : C.txtMuted,
          boxShadow: on ? `inset 0 0 0 1px ${hexA(accent, 0.35)}` : "none",
        }}
      >
        <span style={{ display:"flex" }}><Icon name={icon} size={16} sw={1.9} /></span>
        {label}
      </button>
    );
  };
  return (
    <div style={{ display:"flex", padding:"4px", borderRadius:"11px", background:C.inputBg, border:`1px solid ${C.inputBdr}` }}>
      {btn("grid", t.gridView, "grid")}
      {btn("list", t.listView, "list")}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder, C, accent, isDark }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder: string; C: ThemeColors; accent: string; isDark: boolean;
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
        minWidth: "170px",
        cursor: "pointer",
        boxShadow: value && !isDark ? `0 0 0 3px ${hexA(accent, 0.08)}` : undefined,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function NameSearchInput({ value, onChange, placeholder, C, accent, isDark }: {
  value: string; onChange: (v: string) => void; placeholder: string; C: ThemeColors; accent: string; isDark: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flex: "1 1 220px", minWidth: 220,
      padding: "9px 14px", borderRadius: 10, border: `1px solid ${value ? hexA(accent, 0.45) : C.inputBdr}`,
      background: C.inputBg, boxShadow: value && !isDark ? `0 0 0 3px ${hexA(accent, 0.08)}` : undefined,
    }}>
      <span style={{ display: "flex", color: value ? accent : C.txtMuted }}><Icon name="search" size={16} sw={1.9} /></span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: "none", outline: "none", background: "transparent", width: "100%",
          color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 14,
        }}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          style={{ border: "none", background: "transparent", color: C.txtMuted, cursor: "pointer", display: "flex" }}>
          <Icon name="close" size={14} sw={2} />
        </button>
      )}
    </div>
  );
}

function SuspectGridCard({ suspect, C, accent, isDark, t, onOpen, onPreview }: { suspect: Suspect; C: ThemeColors; accent: string; isDark: boolean; t: ReturnType<typeof getDict>; onOpen: () => void; onPreview: (e: React.MouseEvent) => void }) {
  const tc = tuhunkaColor(suspect.suspect_type_name);
  const initials = suspect.name.split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <article
      onClick={onOpen}
      style={{
        borderRadius: 18, overflow: "hidden", background: isDark ? hexA(accent, 0.05) : "#fff",
        border: `1px solid ${C.cardBdr}`,
        boxShadow: isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)",
        transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
        cursor: "pointer", animation: "is-fadeUp .45s ease both",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLElement).style.borderColor = hexA(accent, 0.42);
        (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 40px -18px ${hexA(accent, 0.38)}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.borderColor = C.cardBdr;
        (e.currentTarget as HTMLElement).style.boxShadow = isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)";
      }}
    >
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "5/6", overflow: "hidden", cursor: "zoom-in", background: isDark ? "#1e293b" : "#f8fafc" }}
        onClick={onPreview}
      >
        <SuspectPhoto
          photo={suspect.photo}
          alt={suspect.name}
          fallback={
            <div style={{
              width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              background: `linear-gradient(165deg, ${hexA(accent, 0.14)} 0%, ${hexA(accent, 0.05)} 100%)`,
            }}>
              <span style={{ fontFamily: "var(--font-cinzel)", fontSize: 36, fontWeight: 700, color: hexA(accent, 0.55) }}>{initials || "?"}</span>
              <img src="/emblem.png" alt="" style={{ width: 56, height: 56, opacity: 0.4, objectFit: "contain" }} />
            </div>
          }
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 42%, rgba(0,0,0,0.78) 100%)" }} />
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: hexA(tc, 0.92), color: "#fff", fontFamily: "var(--font-outfit)", letterSpacing: ".04em" }}>{tuhunkaLabel(suspect.suspect_type_name, t)}</span>
          {(suspect.bail_count ?? 0) > 1 && <BailCountBadge count={suspect.bail_count!} accent={accent} C={C} t={t} variant="overlay" />}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px" }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: "#fff", lineHeight: 1.3 }}>{suspect.name}</div>
          {suspect.alias && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 3, fontFamily: "var(--font-outfit)" }}>@{suspect.alias}</div>}
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : hexA(accent, 0.08)}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{suspect.case_ref}</span>
          {(suspect.bail_count ?? 0) > 1 && <BailCountBadge count={suspect.bail_count!} accent={accent} C={C} t={t} variant="pill" />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)", flexWrap: "wrap" }}>
          {(() => {
            const captured = formatCaptureDateTime(suspect.created_at);
            if (!captured) return null;
            return (
              <span style={{ fontSize: 12, color: C.txtMuted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                <span style={{ color: C.txtSecondary, fontWeight: 500 }}>{captured.date}</span>
                <span style={{ opacity: 0.45, margin: "0 5px" }}>·</span>
                <span>{captured.time}</span>
              </span>
            );
          })()}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ display: "flex", color: accent, flexShrink: 0 }}><Icon name="map" size={14} sw={1.8} /></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{suspectCaptureDistrict(suspect)}</span>
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: C.txtMuted, marginTop: 8, fontFamily: "var(--font-outfit)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{suspect.offense}</div>
        <button onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 9, borderRadius: 9, border: `1px solid ${hexA(accent, 0.35)}`, background: hexA(accent, 0.08), color: accent, fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          {t.viewProfile}<span style={{ display: "flex" }}><Icon name="arrow" size={13} sw={2} /></span>
        </button>
      </div>
    </article>
  );
}

function SuspectListTable({ suspects, C, accent, t, onOpen, onAction, onPreview }: {
  suspects: Suspect[]; C: ThemeColors; accent: string; t: ReturnType<typeof getDict>;
  onOpen: (id: number) => void;
  onAction: (s: Suspect, action: "view" | "edit" | "delete") => void;
  onPreview: (s: Suspect, e: React.MouseEvent) => void;
}) {
  const actionLabels = { view: t.viewAction, edit: t.editAction, delete: t.deleteAction };
  return (
    <div style={{ borderRadius:"14px", overflow:"hidden", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow }}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"820px" }}>
          <thead>
            <tr>
              <th style={{ width:72 }} />
              {[t.colName, t.colLastSeen, t.colDistrict, t.colCase, t.colTuhunka, t.colAction].map((col, i) => (
                <th key={i} style={{ textAlign:"left", padding:"13px 16px", fontSize:"11px", fontWeight:500, letterSpacing:".08em", textTransform:"uppercase", color:C.txtMuted, background:C.tableHead, fontFamily:"var(--font-outfit)" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suspects.map((s, i) => {
              const tc = tuhunkaColor(s.suspect_type_name);
              const captured = formatCaptureDateTime(s.created_at);
              return (
                <tr key={s.id} onClick={() => onOpen(s.id)} style={{ borderTop:`1px solid ${C.tableSep}`, transition:".2s", cursor:"pointer", animation:"is-fadeUp .4s ease both", animationDelay:`${i * 0.03}s` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background=C.tableHov; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background="transparent"; }}
                >
                  <td style={{ padding:"12px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <SuspectAvatar suspect={s} size={52} accent={accent} onPreview={(e) => onPreview(s, e)} />
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ fontSize:"14px", fontWeight:500, color:C.txtPrimary, fontFamily:"var(--font-outfit)" }}>{s.name}</div>
                    <div style={{ fontSize:"12px", color:C.txtMuted, marginTop:"2px" }}>@{s.alias}</div>
                  </td>
                  <td style={{ padding:"12px 16px", fontFamily:"var(--font-outfit)", whiteSpace:"nowrap" }}>
                    {captured ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                        <span style={{ fontSize:13.5, fontWeight:500, color:C.txtPrimary, letterSpacing:".01em" }}>{captured.date}</span>
                        <span style={{ fontSize:12, color:C.txtMuted, fontVariantNumeric:"tabular-nums" }}>{captured.time}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize:13, color:C.txtMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:"14px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>{suspectCaptureDistrict(s)}</td>
                  <td style={{ padding:"12px 16px", fontSize:"13px", color:accent, fontFamily:"var(--font-outfit)", fontWeight:500 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span>{s.case_ref}</span>
                      {(s.bail_count ?? 0) > 1 && (
                        <BailCountBadge count={s.bail_count!} accent={accent} C={C} t={t} variant="chip" />
                      )}
                    </div>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ fontSize:"12px", fontWeight:600, padding:"5px 12px", borderRadius:"20px", background:hexA(tc,0.14), color:tc, border:`1px solid ${hexA(tc,0.28)}`, fontFamily:"var(--font-outfit)", letterSpacing:".04em" }}>{tuhunkaLabel(s.suspect_type_name, t)}</span>
                  </td>
                  <td style={{ padding:"12px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <RowActions actions={["view", "edit", "delete"]} labels={actionLabels} C={C} accent={accent}
                      onAction={(action) => onAction(s, action as "view" | "edit" | "delete")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SuspectsListPage({
  C, accent, isDark, search, profileId, setProfileId, persistKey, registerAddAction, onViewingUserProfile,
}: {
  C: ThemeColors; accent: string; isDark: boolean; search: string;
  profileId: number | null;
  setProfileId: (id: number | null) => void;
  persistKey: string;
  registerAddAction?: (open: () => void) => void;
  onViewingUserProfile?: (viewing: boolean) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);

  const viewKey = `${persistKey}:view`;
  const pageKey = `${persistKey}:page`;
  const countyKey = `${persistKey}:county`;
  const nameSearchKey = `${persistKey}:name-search`;
  const tuhunkaKey = `${persistKey}:tuhunka`;
  const periodKey = `${persistKey}:period`;

  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [countyFilter, setCountyFilter] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [tuhunkaFilter, setTuhunkaFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Suspect | null>(null);
  const [previewSuspect, setPreviewSuspect] = useState<Suspect | null>(null);
  const [officerUserId, setOfficerUserId] = useState<string | null>(null);
  const deferredNameSearch = useDeferredValue(nameSearch);
  const deferredSearch = useDeferredValue([search, deferredNameSearch].filter(Boolean).join(" ").trim());
  const deferredCounty = useDeferredValue(countyFilter);
  const deferredTuhunka = useDeferredValue(tuhunkaFilter);
  const deferredPeriod = useDeferredValue(periodFilter);
  const deleteSuspect = useDeleteSuspect();

  const { data: counties = [] } = useQuery({ queryKey: ["counties"], queryFn: fetchCounties });

  useLayoutEffect(() => {
    const savedView = localStorage.getItem(viewKey);
    if (savedView === "list" || savedView === "grid") setView(savedView);
    const raw = localStorage.getItem(pageKey);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 1) setPage(Math.floor(n));
    }
    setCountyFilter(localStorage.getItem(countyKey) ?? localStorage.getItem(`${persistKey}:district`) ?? "");
    setNameSearch(localStorage.getItem(nameSearchKey) ?? "");
    setTuhunkaFilter(localStorage.getItem(tuhunkaKey) ?? localStorage.getItem(`${persistKey}:risk`) ?? "");
    const savedPeriod = localStorage.getItem(periodKey);
    if (savedPeriod === "today" || savedPeriod === "") setPeriodFilter(savedPeriod);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { registerAddAction?.(() => setShowCreate(true)); }, [registerAddAction]);
  useEffect(() => { setPage(1); }, [deferredSearch, deferredCounty, deferredTuhunka, deferredPeriod, pageSize]);

  const { data, isLoading, isFetching, isPlaceholderData } = useSuspects({
    page,
    pageSize,
    search: deferredSearch,
    county: deferredCounty || undefined,
    suspect_type: deferredTuhunka || undefined,
    period: deferredPeriod || undefined,
  });
  const { data: stats, isLoading: statsLoading } = useSuspectStats();
  const { data: suspectTypes = [] } = useSuspectTypes();

  // All hooks must be called before any conditional return.
  const list = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;
  const showShimmer = isLoading && !data;

  useEffect(() => {
    if (!data) return;
    const max = Math.max(1, Math.ceil(data.count / pageSize));
    if (page > max) setPage(max);
  }, [data?.count, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(viewKey, view);
  }, [viewKey, view]);

  useEffect(() => {
    localStorage.setItem(pageKey, String(page));
  }, [pageKey, page]);

  useEffect(() => { localStorage.setItem(countyKey, countyFilter); }, [countyKey, countyFilter]);
  useEffect(() => { localStorage.setItem(nameSearchKey, nameSearch); }, [nameSearchKey, nameSearch]);
  useEffect(() => { localStorage.setItem(tuhunkaKey, tuhunkaFilter); }, [tuhunkaKey, tuhunkaFilter]);
  useEffect(() => { localStorage.setItem(periodKey, periodFilter); }, [periodKey, periodFilter]);

  useEffect(() => {
    onViewingUserProfile?.(officerUserId !== null);
    return () => onViewingUserProfile?.(false);
  }, [officerUserId, onViewingUserProfile]);

  useEffect(() => {
    if (profileId === null) setOfficerUserId(null);
  }, [profileId]);

  const openPhotoPreview = (suspect: Suspect, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewSuspect(suspect);
  };

  const handleRowAction = (s: Suspect, action: "view" | "edit" | "delete") => {
    if (action === "delete") { setDeleteTarget(s); return; }
    if (action === "edit") { setEditId(s.id); return; }
    setProfileId(s.id);
  };

  const modals = (
    <>
      <SuspectFormModal open={showCreate} onClose={() => setShowCreate(false)} editId={null} C={C} accent={accent} counties={counties} />
      <SuspectFormModal open={editId !== null} onClose={() => setEditId(null)} editId={editId} C={C} accent={accent} counties={counties} />
      <ConfirmDialog
        open={!!deleteTarget}
        title={t.confirmDelete}
        message={t.confirmDeleteSuspect}
        confirmLabel={t.deleteAction}
        cancelLabel={t.cancelAction}
        onConfirm={() => {
          if (deleteTarget) deleteSuspect.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={deleteSuspect.isPending}
      />
      {previewSuspect && (
        <SuspectPhotoPreview
          suspect={previewSuspect}
          open
          onClose={() => setPreviewSuspect(null)}
          accent={accent}
          isDark={isDark}
          lang={lang}
          onOpenProfile={() => setProfileId(previewSuspect.id)}
        />
      )}
    </>
  );

  if (profileId !== null && officerUserId) {
    return (
      <>
        {modals}
        <UserProfilePage
          userId={officerUserId}
          onBack={() => setOfficerUserId(null)}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      </>
    );
  }

  if (profileId !== null) {
    return (
      <>
        {modals}
        <SuspectProfilePage
          suspectId={profileId}
          onBack={() => setProfileId(null)}
          onEdit={() => setEditId(profileId)}
          onOpenUser={(userId) => setOfficerUserId(userId)}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      </>
    );
  }

  const miniKpis = stats ? [
    { label: t.totalSuspects, value: stats.total, icon: "badge", color: accent },
    { label: t.todayRegistered, value: stats.today_registered ?? 0, icon: "calendar", color: "#46c08a" },
    { label: t.activeCases, value: stats.active, icon: "alert", color: "#e0655a" },
    { label: t.tuhunkaTyped, value: stats.tuhunka_typed, icon: "target", color: "#e6b25c" },
    { label: t.thisMonth, value: stats.this_month, icon: "chart", color: "#5b9fd4" },
  ] : [];

  return (
    <div style={{ marginTop:"8px", opacity: isPlaceholderData && isFetching ? 0.72 : 1, transition:"opacity .2s" }}>
      {modals}
      {statsLoading ? <ShimmerKPI /> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"14px" }}>
          {miniKpis.map((k, i) => (
            <div key={i} style={{ padding:"18px 20px", borderRadius:"14px", background:C.cardBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.cardShadow, display:"flex", alignItems:"center", gap:"14px" }}>
              <div style={{ width:44, height:44, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", background:hexA(k.color,0.14), color:k.color, border:`1px solid ${hexA(k.color,0.25)}` }}>
                <Icon name={k.icon} size={20} sw={1.8} />
              </div>
              <div>
                <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:"26px", color:C.txtPrimary, lineHeight:1 }}>{k.value}</div>
                <div style={{ fontSize:"12px", color:C.txtMuted, marginTop:"4px", fontFamily:"var(--font-outfit)" }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 22, marginBottom: 14 }}>
        <NameSearchInput
          value={nameSearch}
          onChange={setNameSearch}
          placeholder={t.searchSuspectName}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <FilterSelect
          value={countyFilter}
          onChange={setCountyFilter}
          placeholder={t.filterDistrict}
          options={counties.map((c) => ({ value: String(c.id), label: c.name }))}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <FilterSelect
          value={tuhunkaFilter}
          onChange={setTuhunkaFilter}
          placeholder={t.filterAllTuhunka}
          options={suspectTypes.map((st) => ({ value: String(st.id), label: st.name }))}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <FilterSelect
          value={periodFilter}
          onChange={setPeriodFilter}
          placeholder={t.filterAllDays}
          options={[{ value: "today", label: t.filterToday }]}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", flexWrap:"wrap", marginBottom:"18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <ViewToggle mode={view} setMode={setView} C={C} accent={accent} isDark={isDark} t={t} />
          {data && <span style={{ fontSize:"13px", color:C.txtMuted, fontFamily:"var(--font-outfit)" }}>{data.count} {t.suspectListTitle.toLowerCase()}</span>}
        </div>
        {isFetching && !showShimmer && (
          <span style={{ fontSize:"12px", color:accent, fontFamily:"var(--font-outfit)", display:"flex", alignItems:"center", gap:"6px" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:accent, opacity:0.8 }} />
            …
          </span>
        )}
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      {showShimmer ? (
        view === "grid" ? <ShimmerSuspectGrid count={pageSize} /> : <ShimmerSuspectList rows={6} />
      ) : list.length === 0 ? (
        <div style={{ padding:"64px 24px", textAlign:"center", borderRadius:"14px", background:C.panelBg, border:`1px solid ${C.cardBdr}` }}>
          <div style={{ width:56, height:56, borderRadius:14, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", background:hexA(accent,0.12), color:accent }}>
            <Icon name="search" size={26} sw={1.8} />
          </div>
          <p style={{ marginTop:"16px", fontSize:"15px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>{t.noResults}</p>
        </div>
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
          {list.map((s) => (
            <SuspectGridCard
              key={s.id}
              suspect={s}
              C={C}
              accent={accent}
              isDark={isDark}
              t={t}
              onOpen={() => setProfileId(s.id)}
              onPreview={(e) => openPhotoPreview(s, e)}
            />
          ))}
        </div>
      ) : (
        <SuspectListTable suspects={list} C={C} accent={accent} t={t} onOpen={setProfileId} onAction={handleRowAction} onPreview={openPhotoPreview} />
      )}

      {!showShimmer && data && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          C={C}
          accent={accent}
          isDark={isDark}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
          totalLabel={`${data.count} ${t.suspectListTitle.toLowerCase()} · ${t.page} ${page} ${t.of} ${totalPages}`}
          hideWhenSinglePage
        />
      )}
    </div>
  );
}
