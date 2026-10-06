"use client";

import { useDeferredValue, useState } from "react";
import {
  useAnalyticsByDistrict,
  useAnalyticsCompletionTrend,
  useAnalyticsHourlyActivity,
  useAnalyticsPeriodSummary,
  useAnalyticsTopRespondents,
} from "@/hooks/use-surveys";
import { formatCompletionPct } from "@/lib/survey-completion";
import type { TimeRange } from "@/types/surveys";
import type { SurveyThemeColors } from "./survey-theme";
import { hexA } from "@/lib/lmsbr/data";
import { ShimmerBlock } from "../shimmer";
import { TimeRangeToggle, rangeWindowLabel } from "./survey-pulse-ui";
import {
  SurveyChartEmpty,
  SurveyCompactPageHeader,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
  SurveySearchField,
} from "./survey-layout";
import {
  AnalyticsKpi,
  HourlyActivityChart,
  StackedDailyCompletionChart,
  SurveyHorizontalBarChart,
} from "./survey-analytics-charts";
import { useLang } from "../lang-ctx";

function formatDelta(pct: number): string {
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return "0%";
}

function formatPeakDay(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SurveyAnalyticsPage({
  C,
  accent,
  isDark,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const [range, setRange] = useState<TimeRange>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: summary, isLoading: summaryLoading } = useAnalyticsPeriodSummary(range, deferredSearch);
  const { data: completionTrend, isLoading: trendLoading } = useAnalyticsCompletionTrend(range, deferredSearch);
  const { data: hourly, isLoading: hourlyLoading } = useAnalyticsHourlyActivity(range, deferredSearch);
  const { data: districts, isLoading: districtLoading } = useAnalyticsByDistrict(range, deferredSearch);
  const { data: topRespondents, isLoading: topLoading } = useAnalyticsTopRespondents(range, deferredSearch);

  const trendData = (completionTrend ?? []).map((d) => ({
    complete: d.complete,
    partial: d.partial,
  }));
  const trendLabels = (completionTrend ?? []).map((d) => d.label);
  const hasTrend = (completionTrend ?? []).some((d) => d.total > 0);

  return (
    <SurveyPageRoot>
      <SurveyCompactPageHeader
        C={C}
        accent={accent}
        isDark={isDark}
        moduleLabel="Survey"
        title={so ? "Falanqayn" : "Analytics"}
        subtitle={so ? "Aragti qoto dheer — isbeddel, juqraafi, iyo dhaqdhaqaaqa goobta" : "Deep insights — trends, geography, and field activity"}
        actions={(
          <>
            <SurveySearchField
              C={C}
              isDark={isDark}
              value={search}
              onChange={setSearch}
              placeholder={so ? "Ku shaandhee sahamin ama jawaab-bixiye…" : "Filter by survey or respondent…"}
              style={{ maxWidth: 300, flex: "1 1 200px" }}
            />
            <TimeRangeToggle value={range} onChange={setRange} />
          </>
        )}
      />

      <div
        className="survey-analytics-kpis"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {summaryLoading ? (
          Array.from({ length: 6 }, (_, i) => <ShimmerBlock key={i} w="100%" h={118} radius={14} />)
        ) : (
          <>
            <AnalyticsKpi
              label={so ? "Jawaabaha mudadan" : "Period responses"}
              value={(summary?.total_responses ?? 0).toLocaleString()}
              sub={rangeWindowLabel(range, so)}
              delta={formatDelta(summary?.change_vs_previous_pct ?? 0)}
              blue={(summary?.change_vs_previous_pct ?? 0) >= 0}
            />
            <AnalyticsKpi
              label={so ? "Jawaab-bixiyeyaal gaar ah" : "Unique respondents"}
              value={(summary?.unique_respondents ?? 0).toLocaleString()}
              sub={so ? "Dad gaar ah" : "Distinct people"}
              delta={`${summary?.avg_per_day ?? 0}/day`}
            />
            <AnalyticsKpi
              label={so ? "Heerka dhammaystirka" : "Completion rate"}
              value={formatCompletionPct(summary?.completion_pct ?? 0, summary?.completed_count ?? 0)}
              sub={so ? `${(summary?.partial_count ?? 0).toLocaleString()} qayb ahaan` : `${(summary?.partial_count ?? 0).toLocaleString()} partial`}
              delta={so ? `${(summary?.completed_count ?? 0).toLocaleString()} la dhammaystiray` : `${(summary?.completed_count ?? 0).toLocaleString()} done`}
              showBar
              barPct={Math.min(100, summary?.completion_pct ?? 0)}
            />
            <AnalyticsKpi
              label={so ? "Daboolka GPS" : "GPS coverage"}
              value={`${summary?.gps_coverage_pct ?? 0}%`}
              sub={so ? "Gudbinta leh goob" : "Submissions with location"}
              delta={so ? `${range} daaqad` : `${range} window`}
              showBar
              barPct={summary?.gps_coverage_pct ?? 0}
            />
            <AnalyticsKpi
              label={so ? "Maalinta ugu badan" : "Peak day"}
              value={formatPeakDay(summary?.peak_day ?? "")}
              sub={so ? `${(summary?.peak_day_count ?? 0).toLocaleString()} jawaabo` : `${(summary?.peak_day_count ?? 0).toLocaleString()} responses`}
              delta={so ? "Maalinta ugu mashquulka badan" : "Busiest day"}
            />
            <AnalyticsKpi
              label={so ? "Marka loo eego mudadii hore" : "vs previous period"}
              value={(summary?.previous_period_responses ?? 0).toLocaleString()}
              sub={so ? "Wadarta mudadii hore" : "Prior window total"}
              delta={formatDelta(summary?.change_vs_previous_pct ?? 0)}
              blue={(summary?.change_vs_previous_pct ?? 0) >= 0}
            />
          </>
        )}
      </div>

      <SurveyPanel C={C} accent={accent} isDark={isDark} style={{ marginBottom: 16 }}>
        <SurveyPanelHeader
          C={C}
          accent={accent}
          isDark={isDark}
          title={so ? "Isbeddelka dhammaystirka" : "Completion trend"}
          sub={so ? `Dhammaystiran vs qayb ahaan · ugu dambeeyay ${range}` : `Completed vs partial submissions · last ${range}`}
        />
        <div style={{ padding: "20px 24px 16px" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
            <LegendDot color={isDark ? "#10b98199" : "#059669"} label={so ? "Dhammaystiran" : "Completed"} C={C} />
            <LegendDot color={isDark ? "#f59e0b99" : "#f59e0b"} label={so ? "Qayb ahaan" : "Partial"} C={C} />
          </div>
          {trendLoading ? (
            <ShimmerBlock w="100%" h={220} radius={10} />
          ) : !hasTrend ? (
            <SurveyChartEmpty C={C} accent={accent} message={so ? "Gudbin ma jiraan mudadan" : "No submissions in this period"} icon="chart" />
          ) : (
            <StackedDailyCompletionChart data={trendData} labels={trendLabels} />
          )}
        </div>
      </SurveyPanel>

      <div
        className="survey-analytics-mid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Dhaqdhaqaaq saacadle" : "Hourly activity"}
            sub={so ? "Waqtiga ay jawaab-bixiyeyaashu gudbiyaan maalinta gudaheeda" : "When respondents submit during the day"}
          />
          <div style={{ padding: "20px 24px 16px" }}>
            {hourlyLoading ? (
              <ShimmerBlock w="100%" h={180} radius={10} />
            ) : (hourly ?? []).every((h) => h.count === 0) ? (
              <SurveyChartEmpty C={C} accent={accent} message={so ? "Weli dhaqdhaqaaq saacadle ma jiro" : "No hourly activity yet"} icon="chart" />
            ) : (
              <HourlyActivityChart data={hourly ?? []} />
            )}
          </div>
        </SurveyPanel>

        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Kala-qaybinta juqraafi" : "Geographic breakdown"}
            sub={so ? "Degmooyinka ugu jawaabaha badan (ugu sareeya)" : "Districts ranked by submission volume"}
          />
          <div style={{ padding: "20px 24px 16px" }}>
            {districtLoading ? (
              <ShimmerBlock w="100%" h={200} radius={10} />
            ) : (districts ?? []).length === 0 ? (
              <SurveyChartEmpty C={C} accent={accent} message={so ? "Xog degmo ma jirto mudadan" : "No district data in this period"} />
            ) : (
              <SurveyHorizontalBarChart
                data={districts ?? []}
                pageSize={6}
                labels={so ? { prev: "Hore", next: "Xiga", of: "ee" } : { prev: "Prev", next: "Next", of: "of" }}
              />
            )}
          </div>
        </SurveyPanel>
      </div>

      <SurveyPanel C={C} accent={accent} isDark={isDark}>
        <SurveyPanelHeader
          C={C}
          accent={accent}
          isDark={isDark}
          title={so ? "Jawaab-bixiyeyaasha ugu firfircoon" : "Top active respondents"}
          sub={so ? `Gudbinta ugu badan ${range} ee ugu dambeysay` : `Most submissions in the last ${range}`}
        />
        {topLoading ? (
          <div style={{ padding: 16 }}><ShimmerBlock w="100%" h={220} radius={10} /></div>
        ) : (topRespondents ?? []).length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: C.txtMuted, fontSize: 14 }}>
            {so ? "Dhaqdhaqaaq jawaab-bixiye ma jiro mudadan." : "No respondent activity in this period."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.tableSep}`, color: C.txtMuted, textAlign: "left" }}>
                  <th style={{ padding: "12px 20px", fontWeight: 600 }}>#</th>
                  <th style={{ padding: "12px 8px", fontWeight: 600 }}>{so ? "Jawaab-bixiye" : "Respondent"}</th>
                  <th style={{ padding: "12px 8px", fontWeight: 600 }}>{so ? "Gudbin" : "Submissions"}</th>
                  <th style={{ padding: "12px 8px", fontWeight: 600 }}>{so ? "Dhammaystiran" : "Completed"}</th>
                  <th style={{ padding: "12px 20px", fontWeight: 600 }}>{so ? "Heer" : "Rate"}</th>
                </tr>
              </thead>
              <tbody>
                {(topRespondents ?? []).map((row, idx) => (
                  <tr key={row.key} style={{ borderBottom: `1px solid ${hexA(C.tableSep, 0.6)}` }}>
                    <td style={{ padding: "14px 20px", color: C.txtMuted }}>{idx + 1}</td>
                    <td style={{ padding: "14px 8px", color: C.txtPrimary, fontWeight: 500 }}>{row.display_name}</td>
                    <td style={{ padding: "14px 8px", color: C.txtPrimary }}>{row.submission_count.toLocaleString()}</td>
                    <td style={{ padding: "14px 8px", color: C.txtSecondary }}>{row.complete_count.toLocaleString()}</td>
                    <td style={{ padding: "14px 20px", color: accent, fontWeight: 600 }}>
                      {row.completion_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurveyPanel>

      <style>{`
        @media (max-width: 1200px) {
          .survey-analytics-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 960px) {
          .survey-analytics-mid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .survey-analytics-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .survey-compact-header { align-items: flex-start !important; }
        }
      `}</style>
    </SurveyPageRoot>
  );
}

function LegendDot({ color, label, C }: { color: string; label: string; C: SurveyThemeColors }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.txtMuted }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {label}
    </div>
  );
}
