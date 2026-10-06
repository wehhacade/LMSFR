"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useCounties, useQeybs } from "@/hooks/use-accounts";
import { useAppUsageReport } from "@/hooks/use-agents";
import { printAppUsageReport } from "@/lib/app-usage-report";
import { ShimmerBlock } from "./shimmer";
import { PrimaryButton, SecondaryButton } from "./accounts-shared";
import type { AccountsThemeColors } from "./accounts-shared";
import type { AppUsageAgentRow, AppUsagePrintMode, AppUsageRegistrar } from "@/types/app-usage-report";
import { DateRangePicker, formatDisplayRange, localTodayIso, monthBounds } from "./amniga-daily-report-page";

type ThemeColors = AccountsThemeColors & { cardBg?: string; cardShadow?: string };

const MEDAL_COLOR = ["#c4a35a", "#9aa3ad", "#b87333"];

function KpiCard({ label, value, color, C }: { label: string; value: number; color: string; C: ThemeColors }) {
  return (
    <div style={{
      padding: "16px 18px", borderRadius: 14, border: `1px solid ${hexA(color, 0.2)}`,
      background: `linear-gradient(140deg, ${hexA(color, 0.1)} 0%, transparent 55%), ${C.cardBg}`,
      boxShadow: C.cardShadow,
    }}>
      <div style={{ fontSize: 11, color: C.txtMuted, marginBottom: 8, fontFamily: "var(--font-outfit)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "var(--font-cinzel)" }}>{value.toLocaleString()}</div>
    </div>
  );
}

function RankCard({ rank, row, C }: { rank: number; row: AppUsageRegistrar; C: ThemeColors }) {
  const color = MEDAL_COLOR[rank] ?? C.txtMuted;
  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${hexA(color, 0.35)}`,
      background: `linear-gradient(135deg, ${hexA(color, 0.08)} 0%, ${C.cardBg} 100%)`,
      padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", right: 12, top: 10, fontSize: 28, opacity: 0.15, fontWeight: 900, color }}>#{rank + 1}</div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", color, textTransform: "uppercase" }}>
        {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank + 1}`}
      </div>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 17, color: C.txtPrimary, marginTop: 6, lineHeight: 1.3 }}>{row.name}</div>
      <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4 }}>{row.county_name || "—"}{row.section_name ? ` · ${row.section_name}` : ""}</div>
      <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 2 }}>ID: {row.service_id || "—"} · {row.phone || "—"}</div>
      <div style={{ marginTop: 10, fontSize: 26, fontWeight: 800, color: "#1f4f8a", fontFamily: "var(--font-cinzel)" }}>
        {row.suspects_registered}
        <span style={{ fontSize: 11, fontWeight: 600, color: C.txtMuted, marginLeft: 6 }}>suspects</span>
      </div>
    </div>
  );
}

function AgentTable({ rows, C, so, mode }: { rows: AppUsageAgentRow[]; C: ThemeColors; so: boolean; mode: "active" | "inactive" | "all" }) {
  const colSpan = mode === "inactive" ? 7 : 8;
  return (
    <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${C.cardBdr}`, background: C.cardBg, boxShadow: C.cardShadow }}>
      <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 12 }}>
        <thead>
          <tr style={{ color: C.tableHead, textAlign: "left", fontSize: 10, textTransform: "uppercase" }}>
            <th style={{ padding: "12px 14px" }}>{so ? "Ciidan" : "Agent"}</th>
            <th style={{ padding: "12px 14px" }}>ID</th>
            <th style={{ padding: "12px 14px" }}>{so ? "Degmo" : "District"}</th>
            <th style={{ padding: "12px 14px" }}>{so ? "Qayb" : "Section"}</th>
            <th style={{ padding: "12px 14px" }}>{so ? "Telefoon" : "Phone"}</th>
            <th style={{ padding: "12px 14px" }}>{so ? "Loogu shubay" : "Installed"}</th>
            {mode === "inactive" ? (
              <th style={{ padding: "12px 14px" }}>{so ? "Tuhunsane (muddadan)" : "Suspects (period)"}</th>
            ) : (
              <>
                <th style={{ padding: "12px 14px" }}>{so ? "Tuhunsane" : "Suspects"}</th>
                <th style={{ padding: "12px 14px" }}>{so ? "Waxqabad (muddadan)" : "Activity (period)"}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {!rows.length ? (
            <tr><td colSpan={colSpan} style={{ padding: 28, textAlign: "center", color: C.txtMuted }}>{so ? "Wax xog ah ma jiro" : "No data"}</td></tr>
          ) : rows.map((r) => (
            <tr key={r.agent_id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
              <td style={{ padding: "10px 14px", color: C.txtPrimary, fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.service_id}</td>
              <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.county_name || "—"}</td>
              <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.section_name || "—"}</td>
              <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.phone || "—"}</td>
              <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.installed_at?.slice(0, 10) || "—"}</td>
              {mode === "inactive" ? (
                <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.period_suspects_registered}</td>
              ) : (
                <>
                  <td style={{ padding: "10px 14px", color: C.txtPrimary, fontWeight: 700 }}>{r.period_suspects_registered}</td>
                  <td style={{ padding: "10px 14px", color: C.txtSecondary }}>{r.last_period_activity_relative}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrintBtn({ label, onClick, C, accent, disabled }: { label: string; onClick: () => void; C: ThemeColors; accent: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      padding: "8px 12px", borderRadius: 10, border: `1px solid ${hexA(accent, 0.35)}`,
      background: hexA(accent, 0.08), color: accent, fontWeight: 600, fontSize: 11.5,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      fontFamily: "var(--font-outfit)", display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <Icon name="printer" size={13} sw={2} />{label}
    </button>
  );
}

export function AmnigaAppUsageReportPage({ C, accent, isDark }: { C: ThemeColors; accent: string; isDark: boolean }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const { data: counties = [] } = useCounties();
  const { data: qeybs = [] } = useQeybs();
  const monthStart = useMemo(() => monthBounds(new Date().getFullYear(), new Date().getMonth() + 1), []);
  const [county, setCounty] = useState("");
  const [department, setDepartment] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStart[0]);
  const [dateTo, setDateTo] = useState(localTodayIso());
  const [tab, setTab] = useState<"overview" | "districts" | "active" | "inactive">("overview");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading, isFetching, refetch } = useAppUsageReport({ county, department, dateFrom, dateTo });

  const selectedQeyb = useMemo(
    () => qeybs.find((q) => String(q.id) === department),
    [qeybs, department],
  );

  const districtOptions = useMemo(() => {
    if (!department || !selectedQeyb?.counties?.length) return counties;
    const allowed = new Set(selectedQeyb.counties.map((c) => String(c.id)));
    return counties.filter((c) => allowed.has(String(c.id)));
  }, [department, selectedQeyb, counties]);

  useEffect(() => {
    if (county && districtOptions.length && !districtOptions.some((c) => String(c.id) === county)) {
      setCounty("");
    }
  }, [county, districtOptions]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (department) parts.push(qeybs.find((q) => String(q.id) === department)?.name || department);
    if (county) parts.push(counties.find((c) => String(c.id) === county)?.name || county);
    return parts.length ? parts.join(" · ") : (so ? "Dhammaan degmooyinka" : "All districts");
  }, [county, department, counties, qeybs, so]);

  const periodLabel = useMemo(
    () => formatDisplayRange(data?.period.date_from || dateFrom, data?.period.date_to || dateTo, so),
    [data, dateFrom, dateTo, so],
  );

  const filteredInactive = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const rows = data?.inactive_agents ?? [];
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q)
      || r.service_id.toLowerCase().includes(q)
      || (r.phone || "").includes(q)
      || (r.county_name || "").toLowerCase().includes(q),
    );
  }, [data?.inactive_agents, deferredSearch]);

  const hasSectionFilter = !!department;
  const hasDistrictFilter = !!county;
  const showOverallTop = !hasSectionFilter && !hasDistrictFilter;
  const filteredActive = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const rows = data?.active_agents ?? [];
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.service_id.toLowerCase().includes(q) || (r.phone || "").includes(q));
  }, [data?.active_agents, deferredSearch]);

  const printOpts = (mode: AppUsagePrintMode) => ({
    mode,
    report: data!,
    lang: (lang === "so" ? "so" : "en") as "so" | "en",
    emblemSrc: `${window.location.origin}/emblem.png`,
    filterLabel,
    selectedScopeLabel: filterLabel,
  });

  const handlePrint = async (mode: AppUsagePrintMode) => {
    if (!data) return;
    await printAppUsageReport(printOpts(mode));
  };

  const summary = data?.summary;

  return (
    <div style={{ animation: "is-fadeUp .35s ease both", paddingBottom: 28 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
            C={C as never}
            accent={accent}
            isDark={isDark}
            so={so}
          />
          <select value={department} onChange={(e) => { setDepartment(e.target.value); setCounty(""); }} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary }}>
            <option value="">{so ? "Dhammaan qaybaha" : "All sections"}</option>
            {qeybs.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <select value={county} onChange={(e) => setCounty(e.target.value)} disabled={!districtOptions.length} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary }}>
            <option value="">{department ? (so ? "Dhammaan degmooyinka qaybta" : "All districts in section") : (so ? "Dhammaan degmooyinka" : "All districts")}</option>
            {districtOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={so ? "Raadi magac / ID / telefoon" : "Search name / ID / phone"} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, minWidth: 200 }} />
        </div>
        <SecondaryButton C={C} onClick={() => refetch()}>{isFetching ? (so ? "Cusboonaysiinaya…" : "Refreshing…") : (so ? "Cusboonaysii" : "Refresh")}</SecondaryButton>
      </div>

      <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 12, background: hexA(accent, isDark ? 0.1 : 0.06), border: `1px solid ${hexA(accent, 0.2)}`, fontSize: 12, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
        <b style={{ color: C.txtPrimary }}>{so ? "Muddada" : "Period"}:</b> {periodLabel}
        {filterLabel !== (so ? "Dhammaan degmooyinka" : "All districts") && <> · <b style={{ color: C.txtPrimary }}>{so ? "Filter" : "Filter"}:</b> {filterLabel}</>}
      </div>

      {isLoading && !data ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => <ShimmerBlock key={i} h={82} />)}
        </div>
      ) : summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          <KpiCard label={so ? "Loogu shubay" : "Installed"} value={summary.total_installed} color={accent} C={C} />
          <KpiCard label={so ? "Tuhunsane diiwaangeliyay" : "Registered suspects"} value={summary.active_in_period} color="#46c08a" C={C} />
          <KpiCard label={so ? "Tuhunsane ma diiwaangelin" : "No suspects registered"} value={summary.inactive_in_period} color="#e0655a" C={C} />
          <KpiCard label={so ? "Tuhunsane muddadan" : "Suspects this period"} value={summary.total_suspects_in_period} color="#3b82f6" C={C} />
        </div>
      )}

      {/* Print actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: "12px 14px", borderRadius: 14, border: `1px solid ${C.cardBdr}`, background: C.cardBg }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase", width: "100%", marginBottom: 4, fontFamily: "var(--font-outfit)" }}>
          {so ? "Daabac / Warbixin" : "Print reports"}
        </span>
        <PrintBtn label={so ? "Top 3 Guud (Shahaado)" : "Top 3 Overall (Certificate)"} onClick={() => handlePrint("top3-overall")} C={C} accent={accent} disabled={!data || !showOverallTop} />
        <PrintBtn label={so ? "Top 3 Qaybta (Shahaado)" : "Top 3 Section (Certificate)"} onClick={() => handlePrint("top3-section")} C={C} accent={accent} disabled={!data || !hasSectionFilter} />
        <PrintBtn label={so ? "Top 3 Degmada (Shahaado)" : "Top 3 District (Certificate)"} onClick={() => handlePrint("top3-district")} C={C} accent={accent} disabled={!data || !hasDistrictFilter} />
        <PrintBtn label={so ? "Top 10 Guud (Shahaado)" : "Top 10 Overall (Certificate)"} onClick={() => handlePrint("top10-overall")} C={C} accent={accent} disabled={!data || !showOverallTop} />
        <PrintBtn label={so ? "Tuhunsane ma diiwaangelin" : "No suspects registered"} onClick={() => handlePrint("inactive")} C={C} accent="#e0655a" disabled={!data} />
        <PrintBtn label={so ? "Shaqaynaya" : "Active agents"} onClick={() => handlePrint("active")} C={C} accent="#46c08a" disabled={!data} />
        <PrintBtn label={so ? "Warbixin buuxda" : "Full report"} onClick={() => handlePrint("full")} C={C} accent={accent} disabled={!data} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {([
          ["overview", so ? "Top & Guud" : "Top & Overview"],
          ["districts", so ? "Degmooyin" : "Districts"],
          ["active", so ? "Shaqaynaya" : "Active"],
          ["inactive", so ? "Tuhunsane ma diiwaangelin" : "No suspects"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} style={{
            padding: "8px 14px", borderRadius: 99, border: `1px solid ${tab === id ? accent : C.inputBdr}`,
            background: tab === id ? hexA(accent, isDark ? 0.18 : 0.12) : C.inputBg,
            color: tab === id ? accent : C.txtSecondary, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 12,
          }}>{label}</button>
        ))}
      </div>

      {tab === "overview" && data && (
        <div style={{ display: "grid", gap: 16 }}>
          {showOverallTop && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 16, color: C.txtPrimary }}>
                  {so ? "Top 3 Tuhunsane — Guud" : "Top 3 Registrars — Overall"}
                </div>
                <PrimaryButton accent={accent} onClick={() => handlePrint("top3-overall")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="printer" size={14} sw={2} />{t.appUsersPrint}</span>
                </PrimaryButton>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {data.top_registrars.overall_top3.map((r, i) => <RankCard key={r.user_id ?? r.name} rank={i} row={r} C={C} />)}
                {!data.top_registrars.overall_top3.length && <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Wax tuhunsane ah lama diiwaangelin muddadan." : "No suspects registered this period."}</div>}
              </div>
            </div>
          )}
          {hasSectionFilter && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 16, color: C.txtPrimary }}>
                  {so ? "Top 3 Tuhunsane — Qaybta" : "Top 3 Registrars — Section"} · {data.top_registrars.section_name || filterLabel}
                </div>
                <PrimaryButton accent={accent} onClick={() => handlePrint("top3-section")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="printer" size={14} sw={2} />{t.appUsersPrint}</span>
                </PrimaryButton>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {data.top_registrars.section_top3.map((r, i) => <RankCard key={`sec-${r.user_id ?? r.name}`} rank={i} row={r} C={C} />)}
                {!data.top_registrars.section_top3.length && <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Wax tuhunsane ah lama diiwaangelin qaybtan muddadan." : "No suspects registered in this section."}</div>}
              </div>
            </div>
          )}
          {hasDistrictFilter && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 16, color: C.txtPrimary }}>
                  {so ? "Top 3 Tuhunsane — Degmada" : "Top 3 Registrars — District"} · {data.top_registrars.district_name || filterLabel}
                </div>
                <PrimaryButton accent={accent} onClick={() => handlePrint("top3-district")}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="printer" size={14} sw={2} />{t.appUsersPrint}</span>
                </PrimaryButton>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {data.top_registrars.district_top3.map((r, i) => <RankCard key={`dist-${r.user_id ?? r.name}`} rank={i} row={r} C={C} />)}
                {!data.top_registrars.district_top3.length && <div style={{ color: C.txtMuted, fontSize: 13 }}>{so ? "Wax tuhunsane ah lama diiwaangelin degmadan muddadan." : "No suspects registered in this district."}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "districts" && data && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.district_breakdown.map((d) => (
            <div key={d.name} style={{ borderRadius: 14, border: `1px solid ${C.cardBdr}`, background: C.cardBg, padding: 16, boxShadow: C.cardShadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 16, color: C.txtPrimary }}>{d.name}</div>
                <div style={{ fontSize: 12, color: C.txtMuted }}>
                  {d.active_in_period} {so ? "shaqaynaya" : "active"} · {d.inactive_in_period} {so ? "aan shaqayn" : "inactive"} · {d.total_suspects} {so ? "tuhunsane" : "suspects"}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {d.top_registrars.map((r, i) => <RankCard key={`${d.name}-${r.user_id}`} rank={i} row={r} C={C} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "active" && data && <AgentTable rows={filteredActive} C={C} so={so} mode="active" />}
      {tab === "inactive" && data && <AgentTable rows={filteredInactive} C={C} so={so} mode="inactive" />}
    </div>
  );
}
