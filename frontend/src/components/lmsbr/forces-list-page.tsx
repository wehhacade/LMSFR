"use client";

import { useEffect, useLayoutEffect, useRef, useState, useDeferredValue, type CSSProperties } from "react";
import Image from "next/image";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { DARK_CORE } from "@/lib/lmsbr/theme-tokens";
import { Icon } from "./icon";
import { useForces, useForceDistricts, useForceStats } from "@/hooks/use-forces";
import { ShimmerForcesTable, ShimmerKPI } from "./shimmer";
import type { Force, ForceRank, ForceStatus } from "@/types/forces";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";

type ThemeColors = {
  cardBg: string; cardBdr: string; cardBdrHov: string; cardShadow: string;
  panelBg: string; panelShadow: string; tableSep: string; tableHead: string; tableHov: string;
  txtPrimary: string; txtSecondary: string; txtMuted: string; txtAccentHd: string;
  inputBg: string; inputBdr: string; inputFocusBdr: string; btnBg: string; btnBdr: string;
  dropdownBg?: string;
};

/* ── colour helpers ── */
function rankColor(rank: ForceRank): string {
  const map: Record<ForceRank, string> = {
    private: "#64748b", corporal: "#0ea5e9", sergeant: "#6366f1",
    lieutenant: "#8b5cf6", captain: "#f59e0b", major: "#ef4444",
  };
  return map[rank] ?? "#64748b";
}
function statusColor(s: ForceStatus): string {
  const map: Record<ForceStatus, string> = {
    on_duty: "#46c08a", on_leave: "#f59e0b", medical: "#0ea5e9", suspended: "#e0655a",
  };
  return map[s] ?? "#64748b";
}

function ForceAvatar({ force, size, accent }: { force: Force; size: number; accent: string }) {
  const [err, setErr] = useState(false);
  const initials = force.name.split(" ").slice(0, 2).map(w => w[0]).join("");
  if (err || !force.photo) {
    return (
      <div style={{ width:size, height:size, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(135deg,${accent},${hexA(accent,0.5)})`, color:"#fff", fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:size*0.32 }}>
        {initials}
      </div>
    );
  }
  return (
    <div style={{ position:"relative", width:size, height:size, borderRadius:10, overflow:"hidden", flexShrink:0, border:`2px solid ${hexA(accent,0.3)}` }}>
      <Image src={force.photo} alt={force.name} fill sizes={`${size}px`} style={{ objectFit:"cover" }} onError={() => setErr(true)} />
    </div>
  );
}

function RankBadge({ rank, t }: { rank: ForceRank; t: ReturnType<typeof getDict> }) {
  const color = rankColor(rank);
  const labels: Record<ForceRank, string> = {
    private: t.rankPrivate, corporal: t.rankCorporal, sergeant: t.rankSergeant,
    lieutenant: t.rankLieutenant, captain: t.rankCaptain, major: t.rankMajor,
  };
  return (
    <span style={{ fontSize:"12px", fontWeight:600, padding:"4px 10px", borderRadius:"20px", background:hexA(color,0.14), color, border:`1px solid ${hexA(color,0.28)}`, fontFamily:"var(--font-outfit)", whiteSpace:"nowrap" }}>
      {labels[rank]}
    </span>
  );
}

function StatusBadge({ status, t }: { status: ForceStatus; t: ReturnType<typeof getDict> }) {
  const color = statusColor(status);
  const labels: Record<ForceStatus, string> = {
    on_duty: t.statusOnDuty, on_leave: t.statusOnLeave, medical: t.statusMedical, suspended: t.statusSuspended,
  };
  return (
    <span style={{ fontSize:"12px", fontWeight:500, padding:"4px 10px", borderRadius:"20px", background:hexA(color,0.12), color, border:`1px solid ${hexA(color,0.25)}`, fontFamily:"var(--font-outfit)", whiteSpace:"nowrap" }}>
      {labels[status]}
    </span>
  );
}

function DistrictDropdown({ value, options, onChange, placeholder, accent, C, isDark }: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  accent: string;
  C: ThemeColors;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = !!value;

  return (
    <div ref={ref} style={{ position:"relative" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", gap:"8px",
          padding:"9px 13px", borderRadius:"10px",
          background: C.inputBg,
          border:`1px solid ${active ? hexA(accent, 0.55) : open ? C.inputFocusBdr : C.inputBdr}`,
          color: active ? accent : C.txtSecondary,
          cursor:"pointer", transition:"border-color .2s, color .2s",
          fontFamily:"var(--font-outfit)", fontSize:"14px",
          minWidth:"175px", whiteSpace:"nowrap",
        }}
      >
        <span style={{ display:"flex", color: active ? accent : C.txtMuted, flexShrink:0 }}>
          <Icon name="map" size={15} sw={1.8} />
        </span>
        <span style={{ flex:1, textAlign:"left" }}>{value || placeholder}</span>
        {active && (
          <span
            onClick={e => { e.stopPropagation(); onChange(""); setOpen(false); }}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", width:18, height:18, borderRadius:"50%", background:hexA(accent,0.18), color:accent, cursor:"pointer", flexShrink:0 }}
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
            </svg>
          </span>
        )}
        {!active && (
          <span style={{ display:"flex", color:C.txtMuted, transform: open ? "rotate(180deg)" : "none", transition:"transform .25s", flexShrink:0 }}>
            <Icon name="chevdown" size={14} sw={2} />
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:200,
          minWidth:"200px", maxHeight:"280px", overflowY:"auto",
          borderRadius:"13px",
          background: isDark ? (C.dropdownBg ?? DARK_CORE.dropdown) : "#ffffff",
          border:`1px solid ${isDark ? "rgba(214,176,114,0.16)" : "rgba(180,130,60,0.2)"}`,
          boxShadow: isDark
            ? "0 28px 56px -16px rgba(0,0,0,0.82), inset 0 1px 0 rgba(248,228,180,0.04)"
            : "0 12px 32px -8px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06)",
          padding:"6px",
          animation:"is-fadeUp .18s ease both",
        }}>
          {/* All Districts option */}
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            style={{
              width:"100%", textAlign:"left", padding:"9px 12px",
              borderRadius:"8px", border:"none", cursor:"pointer",
              fontFamily:"var(--font-outfit)", fontSize:"13.5px",
              display:"flex", alignItems:"center", gap:"10px",
              background: !value ? hexA(accent, isDark ? 0.18 : 0.10) : "transparent",
              color: !value ? accent : C.txtSecondary,
              transition:"background .15s, color .15s",
            }}
            onMouseEnter={e => { if (value) { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(198,144,73,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = C.txtPrimary; } }}
            onMouseLeave={e => { if (value) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.txtSecondary; } }}
          >
            {!value && <span style={{ width:6, height:6, borderRadius:"50%", background:accent, flexShrink:0 }} />}
            <span>{placeholder}</span>
          </button>

          {/* Divider */}
          <div style={{ height:"1px", background: isDark ? "rgba(214,176,114,0.1)" : "rgba(180,130,60,0.12)", margin:"4px 6px" }} />

          {/* District options */}
          {options.map(d => (
            <button
              key={d}
              onClick={() => { onChange(d); setOpen(false); }}
              style={{
                width:"100%", textAlign:"left", padding:"9px 12px",
                borderRadius:"8px", border:"none", cursor:"pointer",
                fontFamily:"var(--font-outfit)", fontSize:"13.5px",
                display:"flex", alignItems:"center", gap:"10px",
                background: value === d ? hexA(accent, isDark ? 0.18 : 0.10) : "transparent",
                color: value === d ? accent : C.txtSecondary,
                transition:"background .15s, color .15s",
              }}
              onMouseEnter={e => { if (value !== d) { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(198,144,73,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = C.txtPrimary; } }}
              onMouseLeave={e => { if (value !== d) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.txtSecondary; } }}
            >
              {value === d && <span style={{ width:6, height:6, borderRadius:"50%", background:accent, flexShrink:0 }} />}
              <span>{d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ForcesListPage({
  C, accent, isDark, persistKey,
}: {
  C: ThemeColors; accent: string; isDark: boolean; persistKey: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);

  const searchKey   = `${persistKey}:search`;
  const districtKey = `${persistKey}:district`;
  const pageKey     = `${persistKey}:page`;

  const [search,   setSearch]   = useState("");
  const [district, setDistrict] = useState("");
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  // Restore from localStorage before first paint (no hydration mismatch).
  useLayoutEffect(() => {
    setSearch(  localStorage.getItem(searchKey)   ?? "");
    setDistrict(localStorage.getItem(districtKey) ?? "");
    const p = Number(localStorage.getItem(pageKey));
    if (Number.isFinite(p) && p >= 1) setPage(Math.floor(p));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const deferredSearch   = useDeferredValue(search);
  const deferredDistrict = useDeferredValue(district);

  // Reset to page 1 on filter/search change.
  useEffect(() => { setPage(1); }, [deferredSearch, deferredDistrict, pageSize]);

  const { data, isLoading, isFetching, isPlaceholderData } = useForces({
    page, pageSize, search: deferredSearch, district: deferredDistrict,
  });
  const { data: stats, isLoading: statsLoading } = useForceStats();
  const { data: districts = [] }                 = useForceDistricts();

  const list        = data?.results ?? [];
  const totalPages  = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;
  const showShimmer = isLoading && !data;

  // Clamp page if data shrinks.
  useEffect(() => {
    if (!data) return;
    const max = Math.max(1, Math.ceil(data.count / pageSize));
    if (page > max) setPage(max);
  }, [data?.count, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist.
  useEffect(() => { localStorage.setItem(searchKey,   search);   }, [searchKey,   search]);
  useEffect(() => { localStorage.setItem(districtKey, district); }, [districtKey, district]);
  useEffect(() => { localStorage.setItem(pageKey, String(page)); }, [pageKey,     page]);

  const cols = [t.colName, t.colBadge, t.colRank, t.colUnit, t.colDistrict, t.colStatus, t.colPhone];

  const kpis = stats ? [
    { label: t.totalSuspects, value: stats.total,     icon: "users",  color: accent          },
    { label: t.statusOnDuty,  value: stats.on_duty,   icon: "shield", color: "#46c08a"       },
    { label: t.statusOnLeave, value: stats.on_leave,  icon: "clock",  color: "#f59e0b"       },
    { label: t.statusSuspended,value:stats.suspended, icon: "alert",  color: "#e0655a"       },
  ] : [];

  const inputBase: CSSProperties = {
    border: "none", outline: "none", background: "transparent",
    color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px", flex: 1,
  };

  return (
    <div style={{ marginTop:"8px", opacity: isPlaceholderData && isFetching ? 0.72 : 1, transition:"opacity .2s" }}>

      {/* ── KPI row ── */}
      {statsLoading ? <ShimmerKPI /> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"14px" }}>
          {kpis.map((k, i) => (
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

      {/* ── Toolbar: search + district filter ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap", marginTop:"22px", marginBottom:"16px" }}>
        {/* Search */}
        <div style={{ display:"flex", alignItems:"center", gap:"9px", padding:"9px 14px", borderRadius:"10px", background:C.inputBg, border:`1px solid ${C.inputBdr}`, flex:"1 1 220px", minWidth:"180px", transition:"border-color .2s" }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.inputFocusBdr; }}
          onBlurCapture={e  => { (e.currentTarget as HTMLDivElement).style.borderColor = C.inputBdr; }}
        >
          <span style={{ display:"flex", color:C.txtMuted }}><Icon name="search" size={16} sw={1.8} /></span>
          <input
            placeholder={t.searchForces}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={inputBase}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ display:"flex", color:C.txtMuted, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              <Icon name="plus" size={14} sw={2} />
            </button>
          )}
        </div>

        {/* District filter */}
        <DistrictDropdown
          value={district}
          options={districts}
          onChange={setDistrict}
          placeholder={t.filterDistrict}
          accent={accent}
          C={C}
          isDark={isDark}
        />

        {/* Count + fetching indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginLeft:"auto" }}>
          {isFetching && !showShimmer && (
            <span style={{ fontSize:"12px", color:accent, fontFamily:"var(--font-outfit)", display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:accent, opacity:0.8 }} />
              …
            </span>
          )}
          {data && (
            <span style={{ fontSize:"13px", color:C.txtMuted, fontFamily:"var(--font-outfit)", whiteSpace:"nowrap" }}>
              {data.count} {t.forcesTitle.toLowerCase()}
            </span>
          )}
        </div>
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      {/* ── Table ── */}
      {showShimmer ? (
        <ShimmerForcesTable rows={8} />
      ) : list.length === 0 ? (
        <div style={{ padding:"64px 24px", textAlign:"center", borderRadius:"14px", background:C.panelBg, border:`1px solid ${C.cardBdr}` }}>
          <div style={{ width:56, height:56, borderRadius:14, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", background:hexA(accent,0.12), color:accent }}>
            <Icon name="search" size={26} sw={1.8} />
          </div>
          <p style={{ marginTop:"16px", fontSize:"15px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>{t.noResults}</p>
        </div>
      ) : (
        <div style={{ borderRadius:"14px", overflow:"hidden", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"720px" }}>
              <thead>
                <tr>
                  <th style={{ width:64 }} />
                  {cols.map((col, i) => (
                    <th key={i} style={{ textAlign:"left", padding:"13px 16px", fontSize:"11px", fontWeight:500, letterSpacing:".08em", textTransform:"uppercase", color:C.txtMuted, background:C.tableHead, fontFamily:"var(--font-outfit)", whiteSpace:"nowrap" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((f: Force, i) => (
                  <tr key={f.id}
                    style={{ borderTop:`1px solid ${C.tableSep}`, transition:".2s", cursor:"pointer", animation:"is-fadeUp .4s ease both", animationDelay:`${i*0.025}s` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding:"12px 16px" }}>
                      <ForceAvatar force={f} size={40} accent={accent} />
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ fontSize:"14px", fontWeight:500, color:C.txtPrimary, fontFamily:"var(--font-outfit)" }}>{f.name}</div>
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:"13px", color:accent, fontFamily:"var(--font-outfit)", fontWeight:600 }}>
                      {f.badge_number}
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <RankBadge rank={f.rank} t={t} />
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:"13.5px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>
                      {f.unit}
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:"13.5px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>
                      {f.district}
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <StatusBadge status={f.status} t={t} />
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:"13px", color:C.txtMuted, fontFamily:"var(--font-outfit)" }}>
                      {f.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            C={C}
            accent={accent}
            isDark={isDark}
            labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
            totalLabel={`${data?.count ?? 0} ${t.forcesTitle.toLowerCase()} · ${t.page} ${page} ${t.of} ${totalPages}`}
            hideWhenSinglePage
          />
        </div>
      )}
    </div>
  );
}
