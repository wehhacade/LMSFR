"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSurveyOptions,
  useSurveyResponses,
} from "@/hooks/use-surveys";
import { useCounties } from "@/hooks/use-accounts";
import type { SurveyResponse } from "@/types/surveys";
import type { PulseResponse, ResponseStatus } from "@/types/surveys";
import type { SurveyThemeColors } from "./survey-theme";
import {
  FilterTabs,
  ResponsesTable,
} from "./survey-pulse-ui";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "../table-pagination";
import { getDict } from "@/lib/lmsbr/data";
import {
  SurveyCompactPageHeader,
  SurveyDateField,
  SurveyEmptyState,
  SurveyErrorBanner,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
  SurveySearchField,
  surveySelectStyle,
} from "./survey-layout";
import {
  deadlineFilterOptions,
  type DeadlineFilterValue,
} from "./survey-deadline";
import { ShimmerSuspectList } from "../shimmer";
import { useLang } from "../lang-ctx";

type Tab = "all" | "complete" | "partial";

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

function tabToStatus(tab: Tab): string | undefined {
  if (tab === "all") return undefined;
  return tab;
}

export function SurveyResponsesPage({
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
  const t = getDict(lang);
  const so = lang === "so";
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [surveyFilter, setSurveyFilter] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilterValue>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const deferredSearch = useDeferredValue(search);

  const { data: surveyOptions } = useSurveyOptions();
  const { data: counties = [] } = useCounties();
  const { data, isLoading, isError } = useSurveyResponses({
    page,
    search: deferredSearch,
    surveyId: surveyFilter || undefined,
    countyId: countyFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    completionStatus: tabToStatus(tab),
    pageSize,
    deadlineStatus: deadlineFilter || undefined,
  });
  useEffect(() => {
    setPage(1);
  }, [deferredSearch, surveyFilter, countyFilter, dateFrom, dateTo, tab, pageSize, deadlineFilter]);

  const responses = data?.results ?? [];
  const rows = responses.map((r, i) => toUiResponse(r, i));
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hasFilters = !!(surveyFilter || countyFilter || dateFrom || dateTo || tab !== "all" || deferredSearch || deadlineFilter);
  const countLabel = isLoading
    ? (so ? "Soo dejinaya…" : "Loading…")
    : `${total} ${so ? "jawaab" : `response${total === 1 ? "" : "s"}`}${deferredSearch ? ` · "${deferredSearch}"` : ""}`;

  function clearFilters() {
    setSurveyFilter("");
    setCountyFilter("");
    setDateFrom("");
    setDateTo("");
    setDeadlineFilter("");
    setTab("all");
    setSearch("");
  }

  return (
    <SurveyPageRoot>
        <SurveyCompactPageHeader
          C={C}
          accent={accent}
          isDark={isDark}
          moduleLabel="Survey"
          title={so ? "Jawaabaha" : "Responses"}
          subtitle={so ? "Baadh oo dib u eeg dhammaan gudbinta" : "Browse and review all submissions"}
          actions={
            hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  color: C.txtSecondary,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {so ? "Nadiifi shaandhada" : "Clear filters"}
              </button>
            ) : undefined
          }
        />

        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Sanduuqa jawaabaha" : "Response inbox"}
            sub={countLabel}
          />

          <div style={{ padding: "16px 24px 20px", borderBottom: `1px solid ${C.tableSep}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <SurveySearchField
                C={C}
                isDark={isDark}
                value={search}
                onChange={setSearch}
                placeholder={so ? "Raadi jawaab-bixiyeyaasha…" : "Search respondents…"}
                style={{ maxWidth: 320 }}
              />
              <select
                value={surveyFilter}
                onChange={(e) => setSurveyFilter(e.target.value)}
                style={{ ...surveySelectStyle(C), minWidth: 180 }}
                aria-label={so ? "Ku shaandhee sahamin" : "Filter by survey"}
              >
                <option value="">{so ? "Dhammaan sahaminada" : "All surveys"}</option>
                {(surveyOptions ?? []).map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              <select
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value)}
                style={{ ...surveySelectStyle(C), minWidth: 160 }}
                aria-label={so ? "Ku shaandhee degmo" : "Filter by district"}
              >
                <option value="">{so ? "Dhammaan degmooyinka" : "All districts"}</option>
                {counties.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
              <SurveyDateField C={C} value={dateFrom} onChange={setDateFrom} label={so ? "Laga bilaabo taariikh" : "From date"} />
              <SurveyDateField C={C} value={dateTo} onChange={setDateTo} label={so ? "Ilaa taariikh" : "To date"} />
              <select
                value={deadlineFilter}
                onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilterValue)}
                style={{ ...surveySelectStyle(C), minWidth: 180 }}
                aria-label={so ? "Ku shaandhee muddada" : "Filter by deadline"}
              >
                {deadlineFilterOptions(so).map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <FilterTabs
              tabs={so ? ["Dhammaan", "Dhammaystiran", "Qayb ahaan"] : ["All", "Complete", "Partial"]}
              active={tab === "all" ? (so ? "Dhammaan" : "All") : tab === "complete" ? (so ? "Dhammaystiran" : "Complete") : (so ? "Qayb ahaan" : "Partial")}
              onChange={(t) => setTab((so ? ({ Dhammaan: "all", Dhammaystiran: "complete", "Qayb ahaan": "partial" } as const)[t as "Dhammaan" | "Dhammaystiran" | "Qayb ahaan"] : ({ All: "all", Complete: "complete", Partial: "partial" } as const)[t as "All" | "Complete" | "Partial"]) ?? "all")}
              compact
            />
          </div>

          {isError && (
            <div style={{ padding: "16px 24px 0" }}>
              <SurveyErrorBanner message={so ? "Soo dejinta jawaabaha way fashilantay. Fadlan mar kale isku day." : "Failed to load responses. Please try again."} />
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: "8px 0" }}>
              <ShimmerSuspectList rows={5} />
            </div>
          ) : rows.length === 0 ? (
            <SurveyEmptyState
              C={C}
              accent={accent}
              icon={hasFilters ? "search" : "check"}
              title={hasFilters ? (so ? "Isbarbar-dhac lama helin" : "No matches") : (so ? "Weli jawaabo ma jiraan" : "No responses yet")}
              message={
                hasFilters
                  ? (so ? "Isku day inaad wax ka beddesho shaandhada ama erayga raadinta." : "Try adjusting your filters or search terms.")
                  : (so ? "Gudbintu halkan ayay ka muuqan doontaa marka sahaminadu bilaabaan helitaanka jawaabo." : "Submissions will appear here once surveys start receiving responses.")
              }
            />
          ) : (
            <>
              <div style={{ padding: "0 24px" }}>
                <TableRowsSelect
                  pageSize={pageSize}
                  onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                  C={C}
                  label={so ? "Tiro" : "Rows"}
                />
              </div>
              <ResponsesTable
                rows={rows}
                onRowClick={(id) => router.push(`/dashboard/survey/responses/${id}`)}
                bare
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={setPage}
                C={C}
                accent={accent}
                isDark={isDark}
                labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
                totalLabel={`${total.toLocaleString()} ${so ? "jawaab" : `response${total !== 1 ? "s" : ""}`} · ${t.page} ${page} ${t.of} ${totalPages}`}
                hideWhenSinglePage
              />
            </>
          )}
        </SurveyPanel>
    </SurveyPageRoot>
  );
}
