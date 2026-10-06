"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSurveys } from "@/hooks/use-surveys";
import { hexA } from "@/lib/lmsbr/data";
import type { Survey } from "@/types/surveys";
import type { PulseSurvey } from "@/types/surveys";
import { Icon } from "../icon";
import { CreateSurveyModal, EditSurveyModal } from "./survey-form-modal";
import type { SurveyThemeColors } from "./survey-theme";
import {
  SurveyCard,
  SurveysDataTable,
  SurveyStatusFilter,
  SurveyViewToggle,
  type SurveyViewMode,
} from "./survey-pulse-ui";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "../table-pagination";
import { getDict } from "@/lib/lmsbr/data";
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
import { ShimmerBlock } from "../shimmer";
import { useLang } from "../lang-ctx";
import { usePermissions } from "@/hooks/use-permissions";

type Props = {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  onCreate?: () => void;
};

type SortKey = "newest" | "oldest" | "name" | "responses";

const VIEW_KEY = "survey:list:view";
const STATUS_KEY = "survey:list:status";
const SORT_KEY = "survey:list:sort";

function formatMeta(survey: Survey, so: boolean): string {
  const created = new Date(survey.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const parts = [so ? `La abuuray ${created}` : `Created ${created}`];
  if (survey.section_count > 0) {
    parts.push(so ? `${survey.section_count} qaybood` : `${survey.section_count} section${survey.section_count !== 1 ? "s" : ""}`);
  }
  if (survey.created_by_name) parts.push(survey.created_by_name);
  return parts.join(" · ");
}

function toUiSurvey(s: Survey, so: boolean): PulseSurvey {
  return {
    id: s.id,
    title: s.name,
    status: s.status,
    meta: formatMeta(s, so),
    responses: s.response_count,
    completion: 0,
  };
}

function sortSurveys(list: Survey[], sort: SortKey): Survey[] {
  const copy = [...list];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "responses":
      return copy.sort((a, b) => b.response_count - a.response_count);
    default:
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

function GridSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16, padding: "20px 24px" }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ padding: 20, borderRadius: 14, border: "1px solid #E5E7EB" }}>
          <ShimmerBlock w={72} h={24} radius={12} />
          <div style={{ marginTop: 14 }}><ShimmerBlock h={18} radius={6} /></div>
          <div style={{ marginTop: 10 }}><ShimmerBlock w="65%" h={12} radius={5} /></div>
        </div>
      ))}
    </div>
  );
}

export function SurveysListPage({ C, accent, isDark, onCreate }: Props) {
  const router = useRouter();
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const { canAdd, canEdit } = usePermissions();
  const allowAdd = canAdd("surveys");
  const allowEdit = canEdit("surveys");
  const [view, setView] = useState<SurveyViewMode>("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [showCreate, setShowCreate] = useState(false);
  const [editSurvey, setEditSurvey] = useState<Survey | null>(null);

  const deferredSearch = useDeferredValue(search);
  const deferredStatus = useDeferredValue(statusFilter);

  useLayoutEffect(() => {
    const savedView = localStorage.getItem(VIEW_KEY);
    if (savedView === "grid" || savedView === "table") setView(savedView);
    setStatusFilter(localStorage.getItem(STATUS_KEY) ?? "");
    const savedSort = localStorage.getItem(SORT_KEY) as SortKey | null;
    if (savedSort && ["newest", "oldest", "name", "responses"].includes(savedSort)) setSort(savedSort);
  }, []);

  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
  useEffect(() => { localStorage.setItem(STATUS_KEY, statusFilter); }, [statusFilter]);
  useEffect(() => { localStorage.setItem(SORT_KEY, sort); }, [sort]);
  useEffect(() => { setPage(1); }, [deferredSearch, deferredStatus, pageSize]);

  const { data, isLoading, isError, isFetching, isPlaceholderData } = useSurveys({
    page,
    pageSize,
    search: deferredSearch,
    status: deferredStatus || undefined,
  });

  const surveys = useMemo(() => sortSurveys(data?.results ?? [], sort), [data?.results, sort]);
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showShimmer = isLoading && !data;

  useEffect(() => {
    if (!data) return;
    const max = Math.max(1, Math.ceil(data.count / pageSize));
    if (page > max) setPage(max);
  }, [data?.count, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNewSurveyClick() {
    setShowCreate(true);
    onCreate?.();
  }

  function openSurvey(id: number) {
    router.push(`/dashboard/survey/${id}`);
  }

  const countLabel = showShimmer
    ? (so ? "Soo dejinaya…" : "Loading…")
    : `${total} ${so ? "sahamin" : `survey${total === 1 ? "" : "s"}`}${deferredSearch ? ` · "${deferredSearch}"` : ""}`;

  return (
    <>
      <CreateSurveyModal open={showCreate} onClose={() => setShowCreate(false)} />
      <EditSurveyModal survey={editSurvey} onClose={() => setEditSurvey(null)} />

      <SurveyPageRoot>
        <SurveyCompactPageHeader
          C={C}
          accent={accent}
          isDark={isDark}
          moduleLabel="Survey"
          title={so ? "Sahamin" : "Surveys"}
          subtitle={so ? "Abuur, daabac, oo maamul sahaminta goobta" : "Create, publish, and manage field surveys"}
          actions={allowAdd ? (
            <button
              type="button"
              onClick={handleNewSurveyClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: `linear-gradient(120deg, ${accent}, ${hexA(accent, 0.85)})`,
                color: "#fff",
                fontFamily: "var(--font-outfit)",
                fontWeight: 600,
                fontSize: 14,
                boxShadow: `0 4px 14px -4px ${hexA(accent, 0.45)}`,
                transition: "transform .2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
            >
              <Icon name="plus" size={17} sw={2} />
              {so ? "Sahamin cusub" : "New survey"}
            </button>
          ) : undefined}
        />

        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title={so ? "Dhammaan sahaminada" : "All surveys"}
            sub={countLabel}
          />

          <div style={{ padding: "16px 24px 20px", borderBottom: `1px solid ${C.tableSep}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <SurveySearchField
                C={C}
                isDark={isDark}
                value={search}
                onChange={setSearch}
                placeholder={so ? "Raadi sahamin…" : "Search surveys…"}
                style={{ maxWidth: 340 }}
              />
              <SurveyViewToggle mode={view} onChange={setView} />
              {isFetching && !showShimmer && (
                <span style={{ fontSize: 12, color: accent, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
                  {so ? "Cusboonaysiinaya" : "Updating"}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <SurveyStatusFilter value={statusFilter} onChange={setStatusFilter} />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                style={surveySelectStyle(C)}
                aria-label={so ? "Kala saar sahaminta" : "Sort surveys"}
              >
                <option value="newest">{so ? "Ugu cusub marka hore" : "Newest first"}</option>
                <option value="oldest">{so ? "Ugu horeeyay marka hore" : "Oldest first"}</option>
                <option value="name">{so ? "Magac A–Z" : "Name A–Z"}</option>
                <option value="responses">{so ? "Jawaabaha ugu badan" : "Most responses"}</option>
              </select>
            </div>
          </div>

          {isError && (
            <div style={{ padding: "16px 24px 0" }}>
              <SurveyErrorBanner message={so ? "Soo dejinta sahaminada way fashilantay. Fadlan mar kale isku day." : "Failed to load surveys. Please try again."} />
            </div>
          )}

          <div style={{ padding: "0 24px" }}>
            <TableRowsSelect
              pageSize={pageSize}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              C={C}
              label={so ? "Tiro" : "Rows"}
            />
          </div>

          <div style={{ opacity: isPlaceholderData && isFetching ? 0.72 : 1, transition: "opacity .2s" }}>
            {showShimmer ? (
              <GridSkeleton />
            ) : surveys.length === 0 && !isError ? (
              <SurveyEmptyState
                C={C}
                accent={accent}
                icon={deferredSearch ? "search" : "clipboard"}
                title={deferredSearch ? (so ? "Isbarbar-dhac lama helin" : "No matches found") : (so ? "Weli sahamin ma jiro" : "No surveys yet")}
                message={
                  deferredSearch
                    ? (so ? `"${deferredSearch}" wax la mid ah lama helin. Isku day raadis kale ama nadiifi shaandhada.` : `Nothing matches "${deferredSearch}". Try a different search or clear filters.`)
                    : (so ? "Abuur sahamintaada koowaad si aad u bilowdo ururinta jawaabaha goobta." : "Create your first survey to start collecting field responses.")
                }
                action={
                  !deferredSearch && allowAdd ? (
                    <button
                      type="button"
                      onClick={handleNewSurveyClick}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        background: `linear-gradient(120deg, ${accent}, ${hexA(accent, 0.85)})`,
                        color: "#fff",
                        fontFamily: "var(--font-outfit)",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      {so ? "Abuur sahamin" : "Create survey"}
                    </button>
                  ) : undefined
                }
              />
            ) : view === "grid" ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
                gap: 16,
                padding: "20px 24px",
              }}>
                {surveys.map((s) => (
                  <SurveyCard
                    key={s.id}
                    survey={toUiSurvey(s, so)}
                    onClick={() => openSurvey(s.id)}
                    onEdit={allowEdit ? () => setEditSurvey(s) : undefined}
                    accent={accent}
                    isDark={isDark}
                  />
                ))}
              </div>
            ) : (
              <SurveysDataTable
                surveys={surveys}
                onOpen={openSurvey}
                onEdit={allowEdit ? setEditSurvey : undefined}
                bare
              />
            )}

            {!showShimmer && data && surveys.length > 0 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={setPage}
                C={C}
                accent={accent}
                isDark={isDark}
                labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
                totalLabel={`${total.toLocaleString()} ${so ? "sahamin" : `survey${total !== 1 ? "s" : ""}`} · ${t.page} ${page} ${t.of} ${totalPages}`}
                hideWhenSinglePage
              />
            )}
          </div>
        </SurveyPanel>
      </SurveyPageRoot>
    </>
  );
}
