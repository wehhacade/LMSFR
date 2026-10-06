"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { SuspectPhoto } from "./suspect-photo";
import { ShimmerKPI, ShimmerSuspectGrid, ShimmerSuspectList } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { BaarisCitizenProfilePage } from "./baaris-citizen-profile-page";
import { useBaarisCitizens, useBaarisStats } from "@/hooks/use-baaris";
import { fetchCounties } from "@/lib/accounts-api";
import type { AccountsThemeColors } from "./accounts-shared";
import type { BaarisCitizenRow } from "@/types/baaris";

type ThemeColors = AccountsThemeColors & {
  cardBg: string; cardBdr: string; cardShadow?: string; tableSep: string;
};

type ViewMode = "grid" | "list";

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

function ViewToggle({ mode, setMode, C, accent, isDark, so }: {
  mode: ViewMode; setMode: (m: ViewMode) => void; C: ThemeColors; accent: string; isDark: boolean; so: boolean;
}) {
  const btn = (m: ViewMode, label: string, icon: string) => {
    const on = mode === m;
    return (
      <button type="button" onClick={() => setMode(m)} style={{
        display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer",
        background: on ? (isDark ? hexA(accent, 0.22) : hexA(accent, 0.12)) : "transparent",
        color: on ? (isDark ? "#f3ead9" : accent) : C.txtMuted,
        boxShadow: on ? `inset 0 0 0 1px ${hexA(accent, 0.35)}` : "none",
        fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 500,
      }}>
        <Icon name={icon} size={16} sw={1.9} />{label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", padding: 4, borderRadius: 11, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
      {btn("grid", so ? "Sawir" : "Grid", "grid")}
      {btn("list", so ? "Liis" : "List", "list")}
    </div>
  );
}

function CitizenCard({ row, C, accent, isDark, onOpen }: {
  row: BaarisCitizenRow; C: ThemeColors; accent: string; isDark: boolean;
  onOpen: () => void;
}) {
  const initials = (row.name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <article onClick={onOpen} style={{
      borderRadius: 18, overflow: "hidden", cursor: "pointer",
      background: isDark ? hexA(accent, 0.05) : "#fff",
      border: `1px solid ${C.cardBdr}`,
      boxShadow: isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)",
      transition: "transform .22s ease, box-shadow .22s ease",
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLElement).style.borderColor = hexA(accent, 0.42);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.borderColor = C.cardBdr;
      }}
    >
      <div style={{ position: "relative", aspectRatio: "5/6", overflow: "hidden", background: isDark ? "#1e293b" : "#f8fafc" }}>
        <SuspectPhoto
          photo={row.photo}
          alt={row.name}
          fallback={
            <div style={{
              width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(165deg, ${hexA(accent, 0.14)}, ${hexA(accent, 0.05)})`,
              fontFamily: "var(--font-cinzel)", fontSize: 36, fontWeight: 700, color: hexA(accent, 0.55),
            }}>{initials}</div>
          }
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 42%, rgba(0,0,0,0.78) 100%)" }} />
        <span style={{
          position: "absolute", top: 12, right: 12, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
          background: hexA(accent, 0.92), color: "#fff",
        }}>Baaris</span>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px" }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: "#fff" }}>{row.name}</div>
          {row.mother ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 3 }}>{row.mother}</div> : null}
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 12, color: C.txtMuted, marginBottom: 8 }}>{row.case_ref || "—"}</div>
        <div style={{ fontSize: 13, color: C.txtSecondary }}>
          {[row.tnumber, row.degmada, row.waaxda].filter(Boolean).join(" · ") || "—"}
        </div>
        {row.created_ago ? <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 6 }}>{row.created_ago}</div> : null}
      </div>
    </article>
  );
}

export function BaarisCitizensListPage({
  C, accent, isDark, search = "",
}: {
  C: ThemeColors; accent: string; isDark: boolean; search?: string;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const deferredSearch = useDeferredValue(search);
  const [localSearch, setLocalSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [county, setCounty] = useState("");
  const deferredCounty = useDeferredValue(county);
  const [view, setView] = useState<ViewMode>("grid");
  const [profileId, setProfileId] = useState<number | null>(null);

  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: fetchCounties,
  });

  const q = (deferredSearch || localSearch).trim();
  const { data: stats } = useBaarisStats(true);
  const { data, isLoading, isFetching } = useBaarisCitizens(
    { page, pageSize, search: q, county: deferredCounty || undefined },
    true,
  );

  useEffect(() => { setPage(1); }, [q, deferredCounty, pageSize]);

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;

  const kpis = useMemo(() => [
    { label: so ? "Wadar" : "Total", value: stats?.total_citizens ?? 0 },
    { label: so ? "Maanta" : "Today", value: stats?.registered_today ?? 0 },
    { label: so ? "Bishaan" : "This month", value: stats?.this_month ?? 0 },
    { label: so ? "Firfircoon" : "Active", value: stats?.active_records ?? 0 },
  ], [stats, so]);

  if (profileId != null) {
    return (
      <BaarisCitizenProfilePage
        citizenId={profileId}
        onBack={() => setProfileId(null)}
        C={C}
        accent={accent}
        isDark={isDark}
      />
    );
  }

  return (
    <div style={{ animation: "is-fadeUp .4s ease both", paddingBottom: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            padding: "16px 18px", borderRadius: 14, background: C.cardBg, border: `1px solid ${C.cardBdr}`,
          }}>
            {!stats ? <ShimmerKPI /> : (
              <>
                <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 26, fontWeight: 700, color: C.txtPrimary }}>{k.value}</div>
                <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4 }}>{k.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flex: "1 1 220px", minWidth: 220,
          padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg,
        }}>
          <Icon name="search" size={16} sw={1.9} />
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={so ? "Raadi magac / telefoon…" : "Search name / phone…"}
            style={{ border: "none", outline: "none", background: "transparent", width: "100%", color: C.txtPrimary, fontSize: 14 }}
          />
        </div>
        <FilterSelect
          value={county}
          onChange={setCounty}
          placeholder={so ? "Dhammaan degmooyin" : "All districts"}
          options={counties.map((c) => ({ value: String(c.id), label: c.name }))}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <ViewToggle mode={view} setMode={setView} C={C} accent={accent} isDark={isDark} so={so} />
        <span style={{ fontSize: 12, color: C.txtMuted }}>{isFetching ? "…" : `${rows.length} ${so ? "natiijo" : "results"}`}</span>
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={so ? "Tiro" : "Rows"}
      />

      {isLoading ? (
        view === "grid" ? <ShimmerSuspectGrid /> : <ShimmerSuspectList />
      ) : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: C.txtMuted }}>{so ? "Muwaadin lama helin." : "No citizens found."}</div>
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {rows.map((row) => (
            <CitizenCard
              key={row.id}
              row={row}
              C={C}
              accent={accent}
              isDark={isDark}
              onOpen={() => setProfileId(row.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: `1px solid ${C.cardBdr}`, background: C.cardBg, overflow: "hidden" }}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setProfileId(row.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                border: "none", borderBottom: `1px solid ${C.tableSep}`, background: "transparent", cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", background: hexA(accent, 0.15), flexShrink: 0 }}>
                {row.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontWeight: 700 }}>
                    {(row.name || "?").slice(0, 1)}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.txtPrimary, fontWeight: 600 }}>{row.name}</div>
                <div style={{ color: C.txtMuted, fontSize: 12 }}>{[row.tnumber, row.degmada, row.waaxda, row.registered_by].filter(Boolean).join(" · ")}</div>
              </div>
              <span style={{ fontSize: 11, color: C.txtMuted }}>{row.created_ago || ""}</span>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div style={{ marginTop: 16 }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            C={C}
            accent={accent}
            isDark={isDark}
            labels={{ prev: so ? "Dib" : "Prev", next: so ? "Xiga" : "Next", page: so ? "Bog" : "Page", of: so ? "ee" : "of" }}
          />
        </div>
      ) : null}
    </div>
  );
}
