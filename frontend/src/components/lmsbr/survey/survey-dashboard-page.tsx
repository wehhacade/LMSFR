"use client";

import { useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSurveyStats,
  useAnalyticsResponsesBySurvey,
  useAnalyticsCompletionBreakdown,
  useSurveyResponses,
} from "@/hooks/use-surveys";
import type { SurveyResponse } from "@/types/surveys";
import type { TimeRange, PulseResponse, ResponseStatus } from "@/types/surveys";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "../icon";
import { ShimmerBlock } from "../shimmer";
import { useLang } from "../lang-ctx";
import type { SurveyThemeColors } from "./survey-theme";
import { ResponsesTable, TimeRangeToggle, rangeWindowLabel } from "./survey-pulse-ui";
import {
  AnalyticsDonutChart,
  CompletionBreakdownPanel,
  DashboardStackedBarChart,
} from "./survey-analytics-charts";
import {
  SurveyChartEmpty,
  SurveyCompactPageHeader,
  SurveyKpiStrip,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
  SurveySearchField,
  type SurveyKpiCtx,
} from "./survey-layout";

const AVATAR_COLORS = [
  "#3fd0b5", "#1A365D", "#46c08a", "#5b9fd4", "#9d8ef5",
  "#e0655a", "#6B7280", "#A6742F",
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function toUiResponse(r: SurveyResponse, idx: number): PulseResponse {
  return {
    id: r.id,
    name: r.user_name ?? r.respondent_phone ?? "Anonymous",
    email: r.respondent_phone || r.guri_number || "—",
    avatar: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    survey: r.survey_name,
    submitted: formatRelativeTime(r.submitted_at),
    duration: `${r.answer_count}/${r.total_questions}`,
    status: r.completion_status as ResponseStatus,
    deadlineAt: r.deadline_at,
    isDeadlineExpired: r.is_deadline_expired,
    deadlineDaysRemaining: r.deadline_days_remaining,
  };
}

export function SurveyDashboardPage({
  C,
  accent,
  isDark,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const so = lang === "so";
  const [range, setRange] = useState<TimeRange>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: stats, isLoading: statsLoading } = useSurveyStats();
  const { data: responsesBySurvey, isLoading: chartLoading } =
    useAnalyticsResponsesBySurvey(range);
  const { data: completionBreakdown } = useAnalyticsCompletionBreakdown(range);
  const { data: responsesPage } = useSurveyResponses({
    page: 1,
    search: deferredSearch,
  });

  const chartData = (responsesBySurvey ?? []).map((r) => ({
    name: r.name,
    complete: r.total,
    partial: 0,
    total: r.total,
  }));

  const segments = (completionBreakdown ?? []).map((b) => ({
    label: b.label,
    pct: b.pct,
    count: b.count,
    color: b.color,
  }));

  const completedItem = completionBreakdown?.find((b) => b.label === "Completed");
  const completedPct = completedItem?.pct ?? 0;
  const completedCount = completedItem?.count ?? 0;
  const completionTotal = (completionBreakdown ?? []).reduce((sum, b) => sum + (b.count ?? 0), 0);

  const recentRows = (responsesPage?.results ?? [])
    .slice(0, 5)
    .map((r, i) => toUiResponse(r, i));

  const kpiCtx: SurveyKpiCtx = {
    todayResponses: stats?.today_responses ?? 0,
    totalResponses: stats?.total_responses ?? 0,
    liveSurveys: stats?.live_surveys ?? 0,
    totalSurveys: stats?.total_surveys ?? 0,
    draftSurveys: stats?.draft_surveys ?? 0,
    closedSurveys: stats?.closed_surveys ?? 0,
    completedPct,
    completedCount,
    completionTotal,
  };

  const panelHeadBg = isDark ? hexA(accent, 0.03) : "#FAFAF9";

  return (
    <SurveyPageRoot>
      <SurveyCompactPageHeader
        C={C}
        accent={accent}
        isDark={isDark}
        moduleLabel="Survey"
        title={so ? "Bogga Hore" : "Dashboard"}
        subtitle={so ? "Dulmar hawlgal — xaalad nool iyo dhaqdhaqaaqii ugu dambeeyay" : "Operational overview — live status and recent activity"}
        actions={(
          <>
            <SurveySearchField
              C={C}
              isDark={isDark}
              value={search}
              onChange={setSearch}
              placeholder={so ? "Raadi jawaabaha…" : "Search responses…"}
              style={{ maxWidth: 300, flex: "1 1 200px" }}
            />
            <TimeRangeToggle value={range} onChange={setRange} />
          </>
        )}
      />

      <SurveyKpiStrip C={C} accent={accent} isDark={isDark} ctx={kpiCtx} loading={statsLoading} />

      <div
        className="survey-dash-charts"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.65fr) minmax(240px, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{
          borderRadius: 14,
          overflow: "hidden",
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
          minWidth: 0,
        }}>
          <div style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${C.tableSep}`,
            background: panelHeadBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 17, color: C.txtPrimary }}>
              {so ? "Jawaabaha sahamin kasta" : "Responses by survey"}
            </div>
            <div style={{
              fontSize: 12,
              color: C.txtMuted,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}>
              {rangeWindowLabel(range, so)}
            </div>
          </div>
          <div style={{ padding: "16px 24px 14px", minHeight: 150 }}>
            {chartLoading ? (
              <ShimmerBlock w="100%" h={130} radius={10} />
            ) : chartData.length === 0 ? (
              <SurveyChartEmpty C={C} accent={accent} message={so ? "Jawaabo ma jiraan mudadan" : "No responses in this period"} icon="chart" />
            ) : (
              <DashboardStackedBarChart data={chartData} height={140} />
            )}
          </div>
        </div>

        <div style={{
          borderRadius: 14,
          overflow: "hidden",
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${C.tableSep}`,
            background: panelHeadBg,
          }}>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 17, color: C.txtPrimary }}>
              {so ? "Heerka dhammaystirka" : "Completion rate"}
            </div>
            <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 4 }}>{so ? "Dhammaan gudbinta" : "All submissions"}</div>
          </div>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px 16px 14px",
            minHeight: 150,
          }}>
            {segments.length > 0 ? (
              <CompletionBreakdownPanel segments={segments} size={128} />
            ) : (
              <SurveyChartEmpty C={C} accent={accent} message={so ? "Weli xog ma jirto" : "No data yet"} icon="check" />
            )}
          </div>
        </div>
      </div>

      <SurveyPanel C={C} accent={accent} isDark={isDark}>
        <SurveyPanelHeader
          C={C}
          accent={accent}
          isDark={isDark}
          title="Recent responses"
          sub={recentRows.length === 0 ? (so ? "Weli gudbin ma jiro" : "No submissions yet") : (so ? `${recentRows.length} ugu dambeeyay` : `${recentRows.length} latest shown`)}
        />
        {recentRows.length === 0 ? (
          <div style={{ padding: "36px 24px", color: C.txtMuted, fontSize: 14, textAlign: "center" }}>
            <span style={{
              width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.1), color: accent,
            }}>
              <Icon name="folder" size={22} sw={1.8} />
            </span>
            {so ? "Jawaabuhu halkan ayay ka muuqanayaan marka sahaminadu helaan gudbin." : "Responses will appear here once surveys receive submissions."}
          </div>
        ) : (
          <ResponsesTable
            rows={recentRows}
            onRowClick={(id) => router.push(`/dashboard/survey/responses/${id}`)}
            bare
          />
        )}
      </SurveyPanel>

      <style>{`
        @media (max-width: 960px) {
          .survey-dash-charts { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .survey-compact-header { align-items: flex-start !important; }
        }
      `}</style>
    </SurveyPageRoot>
  );
}
