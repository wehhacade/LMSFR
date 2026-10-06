"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSurveyRespondent,
  useSurveyRespondentActivity,
  useSurveyRespondentMapTrail,
} from "@/hooks/use-surveys";
import { hexA } from "@/lib/lmsbr/data";
import type { SurveyResponse } from "@/types/surveys";
import type { PulseResponse, ResponseStatus } from "@/types/surveys";
import { Icon } from "../icon";
import { useLang } from "../lang-ctx";
import { ShimmerSuspectList } from "../shimmer";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsesTable } from "./survey-pulse-ui";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "../table-pagination";
import { getDict } from "@/lib/lmsbr/data";
import {
  SurveyEmptyState,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
} from "./survey-layout";
import type { SurveyThemeColors } from "./survey-theme";

const SurveyRespondentsMap = dynamic(
  () => import("./survey-respondents-map").then((m) => m.SurveyRespondentsMap),
  { ssr: false, loading: () => <div style={{ minHeight: 320 }}><ShimmerSuspectList rows={3} /></div> },
);

const AVATAR_COLORS = [
  "#3fd0b5", "#1A365D", "#46c08a", "#5b9fd4", "#9d8ef5",
  "#e0655a", "#6B7280", "#A6742F",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatDate(iso: string, so: boolean): string {
  return new Date(iso).toLocaleDateString(so ? "so-SO" : undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(iso: string, so: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return so ? "hadda" : "just now";
  if (mins < 60) return so ? `${mins}d kahor` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return so ? `${hrs}s kahor` : `${hrs}h ago`;
  return so ? `${Math.floor(hrs / 24)}m kahor` : `${Math.floor(hrs / 24)}d ago`;
}

function toUiResponse(r: SurveyResponse, idx: number, so: boolean): PulseResponse {
  return {
    id: r.id,
    name: r.user_name ?? r.respondent_phone ?? (so ? "Aan la aqoon" : "Anonymous"),
    email: r.respondent_phone,
    avatar: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    survey: r.survey_name,
    submitted: formatRelativeTime(r.submitted_at, so),
    duration: `${r.answer_count}/${r.total_questions}`,
    status: r.completion_status as ResponseStatus,
    deadlineAt: r.deadline_at,
    isDeadlineExpired: r.is_deadline_expired,
    deadlineDaysRemaining: r.deadline_days_remaining,
  };
}

export function SurveyRespondentProfilePage({
  respondentKey,
  C,
  accent,
  isDark,
  onBack,
}: {
  respondentKey: string;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  const { data: respondent, isLoading, isError } = useSurveyRespondent(respondentKey);
  const { data: activity, isLoading: activityLoading } = useSurveyRespondentActivity({
    key: respondentKey,
    page,
    pageSize,
  });
  const { data: trailData } = useSurveyRespondentMapTrail({ key: respondentKey });

  useEffect(() => {
    setPage(1);
  }, [pageSize, respondentKey]);

  const handleBack = onBack ?? (() => router.push("/dashboard/survey"));

  const rows = useMemo(
    () => (activity?.results ?? []).map((r, i) => toUiResponse(r, i, so)),
    [activity?.results, so],
  );
  const total = activity?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const mapPin = useMemo(() => {
    if (!respondent) return null;
    const locations = trailData?.locations ?? [];
    const last = locations[locations.length - 1];
    if (!last) return null;
    return {
      key: respondent.key,
      display_name: respondent.display_name,
      phone_number: respondent.phone_number,
      submission_count: respondent.submission_count,
      district_count: respondent.district_count,
      districts: respondent.county_name || respondent.sub_county_name
        ? [respondent.sub_county_name, respondent.county_name].filter(Boolean) as string[]
        : [],
      latitude: last.latitude,
      longitude: last.longitude,
    };
  }, [respondent, trailData]);

  if (isLoading) {
    return (
      <SurveyPageRoot>
        <Skeleton style={{ height: 140, borderRadius: 14, marginBottom: 16, background: C.barTrack }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} style={{ height: 100, borderRadius: 14, background: C.barTrack }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 1fr)", gap: 16 }}>
          <Skeleton style={{ height: 320, borderRadius: 14, background: C.barTrack }} />
          <Skeleton style={{ height: 320, borderRadius: 14, background: C.barTrack }} />
        </div>
      </SurveyPageRoot>
    );
  }

  if (isError || !respondent) {
    return (
      <SurveyPageRoot>
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "transparent",
            color: C.txtMuted,
            cursor: "pointer",
            fontFamily: "var(--font-outfit)",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 18,
            padding: 0,
          }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="arrow" size={16} sw={2} /></span>
          {so ? "Ku noqo jawaab-bixiyeyaasha" : "Back to respondents"}
        </button>
        <SurveyEmptyState
          C={C}
          accent={accent}
          icon="users"
          title={so ? "Jawaab-bixiye lama helin" : "Respondent not found"}
          message={so ? "Qofkan lama helin ama xogtiisu ma jirto." : "This respondent could not be found."}
        />
      </SurveyPageRoot>
    );
  }

  const avatarColor = AVATAR_COLORS[Math.abs(respondent.key.length * 17) % AVATAR_COLORS.length];
  const location = [respondent.county_name, respondent.sub_county_name].filter(Boolean).join(" · ") || "—";
  const activityLabel = respondent.activity_status === "active"
    ? (so ? "Firfircoon" : "Active")
    : (so ? "Nastay" : "Idle");

  const kpis = [
    {
      label: so ? "Gudbin" : "Submissions",
      value: respondent.submission_count.toLocaleString(),
      hint: so ? `${respondent.survey_count} sahamin` : `${respondent.survey_count} surveys`,
      icon: "folder",
    },
    {
      label: so ? "Dhammaystiran" : "Completed",
      value: respondent.complete_count.toLocaleString(),
      hint: so ? `${respondent.partial_count} qayb ahaan` : `${respondent.partial_count} partial`,
      icon: "check",
    },
    {
      label: so ? "Heerka dhammaystirka" : "Completion rate",
      value: `${respondent.completion_rate}%`,
      hint: so ? "Dhammaan gudbinta" : "Across submissions",
      icon: "chart",
    },
    {
      label: so ? "Degmooyin" : "Districts",
      value: String(respondent.district_count),
      hint: location,
      icon: "map",
    },
  ];

  return (
    <SurveyPageRoot>
      <button
        type="button"
        onClick={handleBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          color: C.txtMuted,
          cursor: "pointer",
          fontFamily: "var(--font-outfit)",
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 18,
          padding: 0,
        }}
      >
        <span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="arrow" size={16} sw={2} /></span>
        {so ? "Ku noqo jawaab-bixiyeyaasha" : "Back to respondents"}
      </button>

      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        marginBottom: 16,
      }}>
        {!isDark && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.4)})`,
          }} />
        )}
        <div style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", minWidth: 0, flex: "1 1 280px" }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(145deg, ${avatarColor}, ${hexA(avatarColor, 0.65)})`,
              color: "#fff",
              fontFamily: "var(--font-cinzel)",
              fontSize: 24,
              fontWeight: 700,
              boxShadow: `0 8px 24px ${hexA(avatarColor, 0.35)}`,
            }}>
              {initials(respondent.display_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: C.txtMuted,
                marginBottom: 8,
              }}>
                {so ? "Profile-ka jawaab-bixiyaha" : "Respondent profile"}
              </div>
              <h1 style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 700,
                color: C.txtPrimary,
                margin: "0 0 8px",
                lineHeight: 1.15,
              }}>
                {respondent.display_name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: respondent.activity_status === "active"
                    ? hexA("#10b981", 0.14)
                    : hexA(C.txtMuted, 0.12),
                  color: respondent.activity_status === "active" ? "#10b981" : C.txtMuted,
                  border: `1px solid ${respondent.activity_status === "active" ? hexA("#10b981", 0.28) : C.tableSep}`,
                }}>
                  {activityLabel}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ fontSize: 12, color: C.txtMuted }}>
              {so ? "Ugu horreeyay" : "First"}: {formatDate(respondent.first_submitted_at, so)}
            </div>
            <div style={{ fontSize: 12, color: C.txtMuted }}>
              {so ? "Ugu dambeeyay" : "Last"}: {formatDate(respondent.last_submitted_at, so)}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 0,
        borderRadius: 14,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        overflow: "hidden",
        marginBottom: 16,
      }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            style={{
              padding: "20px 22px",
              borderRight: i < kpis.length - 1 ? `1px solid ${C.tableSep}` : undefined,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.12), color: accent,
              marginBottom: 14,
            }}>
              <Icon name={k.icon} size={18} sw={1.8} />
            </div>
            <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 22, fontWeight: 700, color: C.txtPrimary, lineHeight: 1.2 }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 6, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 3 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      <div
        className="survey-respondent-profile-grid"
        style={{
          display: "grid",
          gridTemplateColumns: mapPin ? "minmax(0, 1.2fr) minmax(280px, 1fr)" : "1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Taariikhda gudbinta" : "Submission history"}
            sub={activityLoading
              ? (so ? "Soo dejinaya…" : "Loading…")
              : (so ? `${total} gudbin` : `${total} submission${total === 1 ? "" : "s"}`)}
          />
          {activityLoading ? (
            <div style={{ padding: 12 }}><ShimmerSuspectList rows={4} /></div>
          ) : rows.length === 0 ? (
            <SurveyEmptyState
              C={C}
              accent={accent}
              icon="folder"
              title={so ? "Gudbin ma jiro" : "No submissions"}
              message={so ? "Qofkan weli ma gudbin jawaab." : "This respondent has no submissions yet."}
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
                bare
                onRowClick={(id) => router.push(`/dashboard/survey/responses/${id}`)}
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

        {mapPin && (
          <SurveyPanel C={C} accent={accent} isDark={isDark} style={{ minHeight: 360 }}>
            <SurveyPanelHeader
              C={C}
              accent={accent}
              isDark={isDark}
              title={so ? "Goobta" : "Location"}
              sub={respondent.display_name}
            />
            <div style={{ padding: "12px 16px 16px", height: 320 }}>
              <SurveyRespondentsMap
                respondents={[mapPin]}
                selectedKey={respondent.key}
                selectedLocations={[]}
                accent={accent}
                onSelect={() => {}}
              />
            </div>
          </SurveyPanel>
        )}
      </div>

      <style>{`
        @media (max-width: 960px) {
          .survey-respondent-profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </SurveyPageRoot>
  );
}
