"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hexA } from "@/lib/lmsbr/data";
import {
  useSurveyRespondentMap,
  useSurveyRespondentMapTrail,
  useSurveyRespondentSummary,
} from "@/hooks/use-surveys";
import type { SurveyRespondentMapLocation, SurveyRespondentMapPinItem } from "@/types/surveys";
import type { SurveyThemeColors } from "./survey-theme";
import { Icon } from "../icon";
import { RespondentCell } from "./survey-pulse-ui";
import { AnalyticsKpi } from "./survey-analytics-charts";
import {
  SurveyCompactPageHeader,
  SurveyDateField,
  SurveyEmptyState,
  SurveyErrorBanner,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
} from "./survey-layout";
import { ShimmerSuspectList } from "../shimmer";
import { useLang } from "../lang-ctx";

const SurveyRespondentsMap = dynamic(
  () => import("./survey-respondents-map").then((m) => m.SurveyRespondentsMap),
  { ssr: false, loading: () => <div style={{ minHeight: 460 }}><ShimmerSuspectList rows={4} /></div> },
);

const AVATAR_COLORS = [
  "#3fd0b5", "#1A365D", "#46c08a", "#5b9fd4", "#9d8ef5",
  "#e0655a", "#6B7280", "#A6742F",
];

const MAP_AND_LIST_COLUMN_HEIGHT = 560;
const RESPONDENT_ROW_HEIGHT = 73;
const LIST_OVERSCAN_ROWS = 6;

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RespondentListRow({
  item,
  idx,
  selected,
  accent,
  isDark,
  C,
  so,
  onSelect,
  onOpenProfile,
}: {
  item: SurveyRespondentMapPinItem;
  idx: number;
  selected: boolean;
  accent: string;
  isDark: boolean;
  C: SurveyThemeColors;
  so: boolean;
  onSelect: () => void;
  onOpenProfile: () => void;
}) {
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const subtitle = so
    ? `${item.submission_count} jawaab · ${item.district_count} degmo`
    : `${item.submission_count} response${item.submission_count === 1 ? "" : "s"} · ${item.district_count} degmo${item.district_count === 1 ? "" : "oyin"}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "10px 12px 10px 16px",
        borderBottom: `1px solid ${C.tableSep}`,
        background: selected ? hexA(accent, isDark ? 0.12 : 0.07) : "transparent",
        borderLeft: selected ? `3px solid ${accent}` : "3px solid transparent",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-outfit)",
          padding: "4px 0",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <RespondentCell name={item.display_name} email={subtitle} color={color} />
        </div>
        {item.districts.length > 0 && (
          <div style={{
            fontSize: 11,
            color: C.txtSecondary,
            textAlign: "right",
            maxWidth: 90,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}>
            {item.districts.slice(0, 2).join(", ")}
            {item.districts.length > 2 ? "…" : ""}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onOpenProfile}
        title={so ? "Fur profile" : "Open profile"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 9,
          border: `1px solid ${isDark ? hexA(accent, 0.55) : accent}`,
          background: isDark ? hexA(accent, 0.22) : accent,
          color: isDark ? accent : "#fff",
          cursor: "pointer",
          boxShadow: isDark ? "none" : `0 2px 8px ${hexA(accent, 0.35)}`,
        }}
      >
        <Icon name="arrow" size={15} sw={2.2} />
      </button>
    </div>
  );
}

export function SurveySettingsPage({
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function openProfile(key: string) {
    router.push(`/dashboard/survey/respondents/${encodeURIComponent(key)}`);
  }
  const [dateFrom, setDateFrom] = useState(() => localToday());
  const [dateTo, setDateTo] = useState(() => localToday());
  const [scrollTop, setScrollTop] = useState(0);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const filterParams = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data: summary, isLoading: summaryLoading } = useSurveyRespondentSummary(filterParams);
  const { data: mapData, isLoading: mapLoading, isError: mapError } = useSurveyRespondentMap(filterParams);
  const { data: trailData } = useSurveyRespondentMapTrail({
    key: selectedKey,
    ...filterParams,
  });

  const respondents = mapData ?? [];
  const selectedRespondent = useMemo(
    () => respondents.find((r) => r.key === selectedKey) ?? null,
    [respondents, selectedKey],
  );
  const selectedLocations: SurveyRespondentMapLocation[] = trailData?.locations ?? [];
  const visibleRows = Math.ceil(MAP_AND_LIST_COLUMN_HEIGHT / RESPONDENT_ROW_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / RESPONDENT_ROW_HEIGHT) - LIST_OVERSCAN_ROWS);
  const endIndex = Math.min(
    respondents.length,
    startIndex + visibleRows + LIST_OVERSCAN_ROWS * 2,
  );
  const virtualRows = respondents.slice(startIndex, endIndex);
  const today = localToday();
  const isTodayFilter = dateFrom === today && dateTo === today;
  const hasCustomDateFilter = !!(dateFrom || dateTo) && !isTodayFilter;

  useEffect(() => {
    setSelectedKey(null);
    setScrollTop(0);
    if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!mapLoading && respondents.length > 0) {
      setSelectedKey((prev) => (prev && respondents.some((r) => r.key === prev) ? prev : respondents[0].key));
    }
    if (!mapLoading && respondents.length === 0) {
      setSelectedKey(null);
    }
  }, [mapLoading, respondents]);

  function resetToToday() {
    setDateFrom(today);
    setDateTo(today);
  }

  function showAllTime() {
    setDateFrom("");
    setDateTo("");
  }

  return (
    <SurveyPageRoot>
      <SurveyCompactPageHeader
        C={C}
        accent={accent}
        isDark={isDark}
        moduleLabel="Survey"
        title={so ? "Jawaab-bixiyeyaal" : "Respondents"}
        subtitle={so ? "Kuwa maanta gudbiyay ee map-ka — beddel taariikhaha si aad u aragto maalmo kale" : "Today's submitters on the map — change dates to browse other days"}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <SurveyDateField C={C} value={dateFrom} onChange={setDateFrom} label={so ? "Laga bilaabo" : "From"} />
            <SurveyDateField C={C} value={dateTo} onChange={setDateTo} label={so ? "Ilaa" : "To"} />
            {!isTodayFilter && (
              <button
                type="button"
                onClick={resetToToday}
                style={{
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: `1px solid ${hexA(accent, 0.45)}`,
                  background: hexA(accent, isDark ? 0.12 : 0.08),
                  color: accent,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {so ? "Maanta" : "Today"}
              </button>
            )}
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={showAllTime}
                style={{
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
                {so ? "Waqti dhan" : "All time"}
              </button>
            )}
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <AnalyticsKpi
          label={so ? "Wadarta jawaab-bixiyeyaasha" : "Total respondents"}
          value={summaryLoading ? "—" : String(summary?.total_respondents ?? 0)}
          sub={so ? "Gudbiye gaar ah" : "Unique submitters"}
          delta={so ? `${summary?.active_respondents ?? 0} firfircoon` : `${summary?.active_respondents ?? 0} active`}
          showBar
          barPct={summary?.total_respondents ? Math.round(((summary.active_respondents ?? 0) / summary.total_respondents) * 100) : 0}
        />
        <AnalyticsKpi
          label={so ? "Map-ka ku jira" : "On map"}
          value={mapLoading ? "—" : String(respondents.length)}
          sub={so ? "Leh isku-duwaha GPS" : "With GPS coordinates"}
          delta={isTodayFilter ? (so ? "Maanta" : "Today") : hasCustomDateFilter ? (so ? "Taariikh ayaa lagu shaandheeyay" : "Filtered by date") : (so ? "Waqti dhan" : "All time")}
          blue
        />
        <AnalyticsKpi
          label={so ? "Gudbinta toddobaadkan" : "Submissions this week"}
          value={summaryLoading ? "—" : String(summary?.submissions_this_week ?? 0)}
          sub={so ? "7dii maalmood ee ugu dambeysay" : "Last 7 days"}
          delta={so ? "Dhammaan sahaminada" : "All surveys"}
          showBar
          barPct={summary?.submissions_this_week ? Math.min(100, summary.submissions_this_week * 5) : 0}
        />
      </div>

      <div className="lmsbr-stack-2" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
        gap: 16,
        alignItems: "start",
      }}>
        <SurveyPanel C={C} accent={accent} isDark={isDark} style={{ height: MAP_AND_LIST_COLUMN_HEIGHT, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Khariidadda goobta" : "Location map"}
            sub={
              mapLoading
                ? (so ? "Soo dejinaya…" : "Loading…")
                : respondents.length === 0
                  ? (so ? "Jawaab-bixiye ma jiro" : "No respondents")
                  : selectedRespondent
                    ? `${selectedRespondent.display_name} · ${respondents.length} ${so ? "map-ka ku jira" : "on map"}`
                    : `${respondents.length} ${so ? "jawaab-bixiye" : `respondent${respondents.length === 1 ? "" : "s"}`} ${so ? "map-ka ku jira" : "on map"}`
            }
          />
          <div style={{
            flex: 1,
            minHeight: 0,
            padding: "12px 16px 16px",
            display: "flex",
            alignItems: !mapLoading && !mapError && respondents.length === 0 ? "center" : "stretch",
            justifyContent: !mapLoading && !mapError && respondents.length === 0 ? "center" : "flex-start",
          }}>
            {mapError ? (
              <SurveyErrorBanner message={so ? "Soo dejinta xogta khariidadda way fashilantay." : "Failed to load map data."} />
            ) : mapLoading ? (
              <ShimmerSuspectList rows={4} />
            ) : respondents.length === 0 ? (
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SurveyEmptyState
                  C={C}
                  accent={accent}
                  icon="map"
                  title={isTodayFilter ? (so ? "Maanta gudbin ma jiro" : "No submissions today") : hasCustomDateFilter ? (so ? "Isbarbar-dhac lama helin" : "No matches") : (so ? "Weli xog GPS ma jirto" : "No GPS data yet")}
                  message={
                    isTodayFilter
                      ? (so ? "Maanta jawaab-bixiye leh GPS ma gudbin." : "No respondents with GPS submitted a response today.")
                      : hasCustomDateFilter
                        ? (so ? "Kala duwanaanshahan taariikheed jawaab-bixiye leh GPS ma jiro." : "No respondents with GPS in this date range.")
                        : (so ? "Jawaab-bixiyeyaashu waxay muuqdaan marka gudbintu leedahay latitude iyo longitude." : "Respondents appear when submissions include latitude and longitude.")
                  }
                />
              </div>
            ) : (
              <SurveyRespondentsMap
                respondents={respondents}
                selectedKey={selectedKey}
                selectedLocations={selectedLocations}
                accent={accent}
                onSelect={setSelectedKey}
              />
            )}
          </div>
        </SurveyPanel>

        <SurveyPanel C={C} accent={accent} isDark={isDark} style={{ height: MAP_AND_LIST_COLUMN_HEIGHT, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Jawaab-bixiyeyaal" : "Respondents"}
            sub={mapLoading ? (so ? "Soo dejinaya…" : "Loading…") : `${respondents.length} ${so ? "wadarta" : "total"}`}
          />
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {mapLoading ? (
              <div style={{ padding: 12 }}><ShimmerSuspectList rows={5} /></div>
            ) : respondents.length === 0 ? (
              <div style={{ padding: 20, fontSize: 13, color: C.txtMuted }}>
                {isTodayFilter ? (so ? "Maanta gudbin GPS leh ma jiro." : "No submissions with GPS today.") : hasCustomDateFilter ? (so ? "Taariikhdan jawaab-bixiye ma jiro." : "No respondents in this date range.") : (so ? "Weli jawaab-bixiye ma jiro." : "No respondents yet.")}
              </div>
            ) : (
              <div
                ref={listScrollRef}
                onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
                style={{ height: "100%", overflowY: "auto", overscrollBehavior: "contain" }}
              >
                <div style={{ height: respondents.length * RESPONDENT_ROW_HEIGHT, position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: startIndex * RESPONDENT_ROW_HEIGHT,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {virtualRows.map((item, idx) => (
                      <RespondentListRow
                        key={item.key}
                        item={item}
                        idx={startIndex + idx}
                        selected={selectedKey === item.key}
                        accent={accent}
                        isDark={isDark}
                        C={C}
                        so={so}
                        onSelect={() => setSelectedKey(item.key)}
                        onOpenProfile={() => openProfile(item.key)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SurveyPanel>
      </div>
    </SurveyPageRoot>
  );
}
