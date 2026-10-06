"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCounties } from "@/hooks/use-accounts";
import { useSurveyOptions, useSurveyOwners } from "@/hooks/use-surveys";
import { getDict, hexA } from "@/lib/lmsbr/data";
import type { SurveyThemeColors } from "./survey-theme";
import { useLang } from "../lang-ctx";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "../table-pagination";
import { ShimmerSuspectList } from "../shimmer";
import {
  SurveyCompactPageHeader,
  SurveyEmptyState,
  SurveyErrorBanner,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
  SurveySearchField,
  surveySelectStyle,
} from "./survey-layout";
import {
  SurveyDeadlineCell,
  deadlineFilterOptions,
  type DeadlineFilterValue,
} from "./survey-deadline";

function formatSubmittedAt(value: string, so: boolean): string {
  return new Intl.DateTimeFormat(so ? "so-SO" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SurveyOwnersPage({
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
  const [search, setSearch] = useState("");
  const [surveyFilter, setSurveyFilter] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [cameraFilter, setCameraFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilterValue>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const deferredSearch = useDeferredValue(search);
  const { data: surveyOptions } = useSurveyOptions();
  const { data: counties = [] } = useCounties();
  const { data, isLoading, isFetching, isError } = useSurveyOwners({
    page,
    search: deferredSearch,
    surveyId: surveyFilter || undefined,
    countyId: countyFilter || undefined,
    camera: cameraFilter || undefined,
    pageSize,
    deadlineStatus: deadlineFilter || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, surveyFilter, countyFilter, cameraFilter, pageSize, deadlineFilter]);

  const owners = data?.results ?? [];
  const total = data?.count ?? 0;
  const summary = data?.summary;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(deferredSearch || surveyFilter || countyFilter || cameraFilter || deadlineFilter);
  const selectedDistrict =
    summary?.county_name
    || counties.find((c) => String(c.id) === countyFilter)?.name
    || "";

  return (
    <SurveyPageRoot>
      <SurveyCompactPageHeader
        C={C}
        accent={accent}
        isDark={isDark}
        moduleLabel="Survey"
        title={so ? "Milkiilayaasha" : "Owners"}
        subtitle={
          so
            ? "Jawaabaha su'aasha “MAGACA MILKILAHA”"
            : "Answers to the “MAGACA MILKILAHA” question"
        }
      />

      <SurveyPanel C={C} accent={accent} isDark={isDark}>
        <SurveyPanelHeader
          C={C}
          accent={accent}
          isDark={isDark}
          title={so ? "Liiska milkiilayaasha" : "Owner directory"}
          sub={
            isLoading
              ? (so ? "Soo dejinaya…" : "Loading…")
              : selectedDistrict
                ? (so
                  ? `${(summary?.total ?? total).toLocaleString()} milkiile · ${selectedDistrict}`
                  : `${(summary?.total ?? total).toLocaleString()} owner${(summary?.total ?? total) === 1 ? "" : "s"} · ${selectedDistrict}`)
                : `${(summary?.total ?? total).toLocaleString()} ${so ? "milkiile" : `owner${(summary?.total ?? total) === 1 ? "" : "s"}`}`
          }
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "16px 24px",
            borderBottom: `1px solid ${C.tableSep}`,
          }}
        >
          <SurveySearchField
            C={C}
            isDark={isDark}
            value={search}
            onChange={setSearch}
            placeholder={so ? "Raadi magaca milkiilaha…" : "Search owner name…"}
            style={{ maxWidth: 340 }}
          />
          <select
            value={surveyFilter}
            onChange={(event) => setSurveyFilter(event.target.value)}
            style={{ ...surveySelectStyle(C), minWidth: 190 }}
            aria-label={so ? "Ku shaandhee sahamin" : "Filter by survey"}
          >
            <option value="">{so ? "Dhammaan sahaminada" : "All surveys"}</option>
            {(surveyOptions ?? []).map((survey) => (
              <option key={survey.id} value={String(survey.id)}>
                {survey.name}
              </option>
            ))}
          </select>
          <select
            value={countyFilter}
            onChange={(event) => setCountyFilter(event.target.value)}
            style={{ ...surveySelectStyle(C), minWidth: 180 }}
            aria-label={so ? "Ku shaandhee degmo" : "Filter by district"}
          >
            <option value="">{so ? "Dhammaan degmooyinka" : "All districts"}</option>
            {counties.map((county) => (
              <option key={county.id} value={String(county.id)}>
                {county.name}
              </option>
            ))}
          </select>
          <select
            value={cameraFilter}
            onChange={(event) => setCameraFilter(event.target.value)}
            style={{ ...surveySelectStyle(C), minWidth: 160 }}
            aria-label={so ? "Ku shaandhee kaamiro" : "Filter by camera"}
          >
            <option value="">{so ? "Dhammaan" : "All"}</option>
            <option value="haa">Haa</option>
            <option value="maya">Maya</option>
          </select>
          <select
            value={deadlineFilter}
            onChange={(event) => setDeadlineFilter(event.target.value as DeadlineFilterValue)}
            style={{ ...surveySelectStyle(C), minWidth: 180 }}
            aria-label={so ? "Ku shaandhee muddada" : "Filter by deadline"}
          >
            {deadlineFilterOptions(so).map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {!isLoading && summary && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              padding: "14px 24px",
              borderBottom: `1px solid ${C.tableSep}`,
            }}
          >
            {([
              {
                key: "",
                label: selectedDistrict
                  ? (so ? `Milkiilayaasha ${selectedDistrict}` : `Owners in ${selectedDistrict}`)
                  : (so ? "Dhammaan milkiilayaasha" : "All owners"),
                value: summary.total,
                color: C.txtPrimary,
              },
              {
                key: "haa",
                label: so ? "Kaamiro Haa" : "Has camera",
                value: summary.haa,
                color: "#16a34a",
              },
              {
                key: "maya",
                label: so ? "Kaamiro Maya" : "No camera",
                value: summary.maya,
                color: "#dc2626",
              },
            ] as const).map((card) => {
              const active = cameraFilter === card.key;
              return (
                <button
                  key={card.key || "all"}
                  type="button"
                  onClick={() => setCameraFilter(active ? "" : card.key)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${active ? hexA(card.color, 0.45) : C.tableSep}`,
                    background: active ? hexA(card.color, isDark ? 0.16 : 0.08) : C.panelBg,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", color: C.txtMuted, textTransform: "uppercase" }}>
                    {card.label}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: card.color }}>
                    {card.value.toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {isError && (
          <div style={{ padding: "16px 24px 0" }}>
            <SurveyErrorBanner
              message={
                so
                  ? "Liiska milkiilayaasha lama soo dejin karin. Fadlan mar kale isku day."
                  : "Failed to load owners. Please try again."
              }
            />
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: "8px 0" }}>
            <ShimmerSuspectList rows={8} />
          </div>
        ) : owners.length === 0 ? (
          <SurveyEmptyState
            C={C}
            accent={accent}
            icon={hasFilters ? "search" : "users"}
            title={hasFilters ? (so ? "Wax natiijo ah lama helin" : "No owners found") : (so ? "Weli milkiile ma jiro" : "No owners yet")}
            message={
              hasFilters
                ? (so ? "Beddel erayga raadinta, degmada ama sahaminta." : "Try changing the search, district, or survey filter.")
                : (so ? "Jawaabaha MAGACA MILKILAHA halkan ayay kasoo muuqan doonaan." : "MAGACA MILKILAHA answers will appear here.")
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {(so
                      ? ["MILKIILAHA", "LAMBARKA GURIGA", "DEGMO / WAAX", "KAAMIRO MA U XIRANTAHAY", "SAHAMINTA", "MUDDADA", "LA GUDBIYAY"]
                      : ["OWNER", "HOUSE NO.", "DISTRICT / SUB-COUNTY", "CAMERA MA U XIRANTAHAY", "SURVEY", "DEADLINE", "SUBMITTED"]
                    ).map((column) => (
                      <th
                        key={column}
                        style={{
                          padding: "13px 20px",
                          textAlign: "left",
                          background: C.tableHead,
                          borderBottom: `1px solid ${C.tableSep}`,
                          color: C.txtMuted,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: ".08em",
                        }}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => {
                    const initials = owner.owner_name
                      .trim()
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <tr
                        key={owner.id}
                        onClick={() => router.push(`/dashboard/survey/responses/${owner.response}`)}
                        style={{
                          cursor: "pointer",
                          borderBottom: `1px solid ${C.tableSep}`,
                          transition: "background .15s",
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = C.tableHov;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            <span
                              style={{
                                width: 34,
                                height: 34,
                                flexShrink: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                background: `${accent}22`,
                                border: `1px solid ${accent}55`,
                                color: accent,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {initials || "—"}
                            </span>
                            <div>
                              <div style={{ color: C.txtPrimary, fontSize: 14, fontWeight: 600 }}>
                                {owner.owner_name}
                              </div>
                              <div style={{ marginTop: 2, color: C.txtMuted, fontSize: 11 }}>
                                {owner.phone_number || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", color: C.txtSecondary, fontSize: 13 }}>
                          {owner.guri_number || "—"}
                        </td>
                        <td style={{ padding: "14px 20px", color: C.txtSecondary, fontSize: 13 }}>
                          {[owner.county_name, owner.sub_county_name].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          {owner.camera_installed ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                background: `${accent}18`,
                                color: accent,
                                border: `1px solid ${accent}40`,
                              }}
                            >
                              {owner.camera_installed}
                            </span>
                          ) : (
                            <span style={{ color: C.txtMuted, fontSize: 13 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 20px", color: C.txtSecondary, fontSize: 13 }}>
                          {owner.survey_name}
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <SurveyDeadlineCell
                            deadlineAt={owner.deadline_at}
                            isExpired={owner.is_deadline_expired}
                            daysRemaining={owner.deadline_days_remaining}
                            so={so}
                            mutedColor={C.txtMuted}
                          />
                        </td>
                        <td style={{ padding: "14px 20px", color: C.txtMuted, fontSize: 12, whiteSpace: "nowrap" }}>
                          {formatSubmittedAt(owner.submitted_at, so)}
                        </td>
                      </tr>
                    );
                  })}
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
              totalLabel={`${total.toLocaleString()} ${so ? "milkiile" : `owner${total === 1 ? "" : "s"}`} · ${t.page} ${page} ${t.of} ${totalPages}`}
              isFetching={isFetching}
            />
          </>
        )}
      </SurveyPanel>
    </SurveyPageRoot>
  );
}
