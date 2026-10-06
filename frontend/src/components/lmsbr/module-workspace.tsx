"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo, useMemo, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useLang } from "./lang-ctx";
import { useTheme } from "./theme-ctx";
import { useColorPalette } from "./color-palette-ctx";
import { ColorToggle } from "./color-toggle";
import { getDict, getModules, hexA, type ModuleId, type MenuItem } from "@/lib/lmsbr/data";
import {
  defaultModuleNav,
  mergeModuleNav,
  openSubsForActiveMenu,
  persistModuleNav,
  persistNavLayoutPreference,
  consumeOpenMyProfile,
  readModuleNavFromDocumentCookie,
  readModuleNavFromStorage,
  readNavLayoutPreference,
  type NavMode,
  type ModuleNavSnapshot,
} from "@/lib/lmsbr/module-nav-persist";
import { filterMenuItems } from "@/lib/permissions";
import { logPageVisit } from "@/lib/audit-tracker";
import { applyPalette, sidebarSurfaceStyle } from "@/lib/lmsbr/palette";
import { DASHBOARD_DARK, type DashboardThemeColors } from "@/lib/lmsbr/theme-tokens";
import { Icon } from "./icon";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchModuleMenu } from "@/lib/module-prefetch";
import { useLogout } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { HubkadhigisListPage } from "./hubkadhigis-list-page";
import { HubkadhigisDashboardPage } from "./hubkadhigis-dashboard-page";
import { HubkadhigisGalleryPage } from "./hubkadhigis-gallery-page";
import { HubkadhigisAnalyticsPage } from "./hubkadhigis-analytics-page";
import { SuspectsListPage } from "./suspects-list-page";
import { AmnigaDailyReportPage } from "./amniga-daily-report-page";
import { AmnigaFaceMatchPage } from "./amniga-face-match-page";
import { AmnigaDashboardPage } from "./amniga-dashboard-page";
import { AgentsListPage } from "./agents-list-page";
import { AgentProfilePage } from "./agent-profile-page";
import { PersonnelDashboardPage } from "./personnel/personnel-dashboard-page";
import { AttendanceSessionPage } from "./personnel/attendance-session-page";
import { AgentImportWizardPage } from "./personnel/agent-import-wizard-page";
import { PersonnelReportsPage } from "./personnel/personnel-reports-page";
import { DistrictManagementPage } from "./personnel/district-management-page";
import {
  AmnigaDistrictTasksPage,
  AmnigaUserReportsPage,
} from "./amniga-cish-reports";
import { AmnigaAppUsersPage } from "./amniga-app-users-page";
import { AmnigaAppReleasePage } from "./amniga-app-release-page";
import { UsersListPage } from "./users-list-page";
import { GroupsListPage } from "./groups-list-page";
import { QeybahaListPage } from "./qeybaha-list-page";
import { DhacdooyinkaUtilityListPage } from "./dhacdooyinka-utility-list-page";
import { DhacdooyinkaRequirementsListPage } from "./dhacdooyinka-requirements-list-page";
import { DhacdooyinkaListPage } from "./dhacdooyinka-list-page";
import { DhacdooyinkaDashboardPage } from "./dhacdooyinka-dashboard-page";
import { BaarisCitizensListPage } from "./baaris-citizens-list-page";
import { BaarisDashboardPage } from "./baaris-dashboard-page";
import { BaarisWantedListPage } from "./baaris-wanted-list-page";
import { VisitorsListPage } from "./visitors-list-page";
import { VisitorsDashboardPage } from "./visitors-dashboard-page";
import { AuditTrailsPage } from "./audit-trails-page";
import { ErrorLogsPage } from "./error-logs-page";
import { APITrafficPage } from "./api-traffic-page";
import { PermissionsListPage } from "./permissions-list-page";
import { UserControlDashboardPage } from "./usercontrol-dashboard-page";
import { HeaderProfileMenu } from "./header-profile-menu";
import { UserProfilePage } from "./user-profile-page";
import { SurveysListPage } from "./survey/surveys-list-page";
import { SurveyProfilePage } from "./survey/survey-profile-page";
import { SurveyDashboardPage } from "./survey/survey-dashboard-page";
import { SurveyResponsesPage } from "./survey/survey-responses-page";
import { SurveyOwnersPage } from "./survey/survey-owners-page";
import { SurveyResponseProfilePage } from "./survey/survey-response-profile-page";
import { SurveyAnalyticsPage } from "./survey/survey-analytics-page";
import { SurveySettingsPage } from "./survey/survey-settings-page";
import { SurveyRespondentProfilePage } from "./survey/survey-respondent-profile-page";
import { SurveySubmitPage } from "./survey/survey-submit-page";
import { SurveyThemeProvider } from "./survey/survey-theme";
import {
  getSurveyMenu, normalizeSurveyNav, SURVEY_ACCENT, SURVEY_GRAD, SURVEY_GLOW, type SurveyMenuItem,
} from "@/lib/survey-config";
import { useSurveyStats } from "@/hooks/use-surveys";
import { useAmnigaAnalytics, useAmnigaStatsEnabled } from "@/hooks/use-amniga";
import type { SurveyThemeColors } from "./survey/survey-theme";

const AmnigaTrackMapPage = dynamic(
  () => import("./amniga-track-map-page").then((m) => m.AmnigaTrackMapPage),
  { ssr: false },
);

/** Stable shell — do not define inline inside ModuleWorkspace (causes full remount every render). */
function SurveyPageShell({
  C, accent, isDark, children,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  children: ReactNode;
}) {
  return (
    <SurveyThemeProvider C={C} accent={accent} isDark={isDark}>
      {children}
    </SurveyThemeProvider>
  );
}

/* ─── theme token maps ─── */
const DK = { ...DASHBOARD_DARK };
const LT = {
  /* ── SIDEBAR — pure white, clean ── */
  sidebarBg:    "#FFFFFF",
  sidebarBdr:   "#E5E7EB",
  sidebarShadow:"1px 0 0 #E5E7EB,4px 0 16px rgba(0,0,0,0.05)",
  btnBg:        "#F3F4F6",
  btnBdr:       "#E5E7EB",
  btnColor:     "#374151",
  menuActive:   "#000000",
  menuInactive: "#000000",
  menuSubActive:"#000000",
  menuSubInact: "#000000",
  logoutHovBg:  "rgba(224,101,90,.06)",
  logoutHovBdr: "rgba(224,101,90,.30)",
  logoutHovC:   "#e0655a",
  /* ── PAGE CANVAS — light gray so white cards lift off ── */
  pageBg:       "#F3F4F6",
  navBg:        "rgba(255,255,255,0.97)",
  navBdr:       "#E5E7EB",
  headerBg:     "rgba(255,255,255,0.97)",
  headerBdr:    "#E5E7EB",
  headerShadow: "0 1px 0 #E5E7EB,0 2px 8px rgba(0,0,0,0.04)",
  /* ── SURFACES — pure white with real elevation shadows ── */
  cardBg:       "#FFFFFF",
  cardBdr:      "#E5E7EB",
  cardBdrHov:   "#C9CDD4",
  cardShadow:   "0 1px 3px rgba(0,0,0,0.08),0 6px 20px rgba(0,0,0,0.07)",
  panelBg:      "#FFFFFF",
  panelShadow:  "0 1px 3px rgba(0,0,0,0.08),0 10px 32px rgba(0,0,0,0.08)",
  tableSep:     "#E5E7EB",
  tableHead:    "#F9FAFB",
  tableHov:     "#F3F4F6",
  barTrack:     "#E5E7EB",
  inputBg:      "#F9FAFB",
  inputBdr:     "#D1D5DB",
  inputFocusBdr:"#C69049",
  /* ── TYPOGRAPHY — clean dark with clear hierarchy ── */
  txtPrimary:   "#111827",
  txtSecondary: "#374151",
  txtMuted:     "#6B7280",
  txtAccentHd:  "#92400E",
  notifBorder:  "#FFFFFF",
  footerBdr:    "#E5E7EB",
  footerTxt:    "#9CA3AF",
  footerTxtMd:  "#6B7280",
  /* ── EMBLEM watermark — visible on light like dark/launcher ── */
  emblemGrad:   "radial-gradient(circle at 46% 40%,#c89238,#9d6b28 48%,#6b4518 88%)",
  emblemBlend:  "multiply" as React.CSSProperties["mixBlendMode"],
  emblemOp:     0.12,
  beamGrad:     "transparent",
  topGlowGrad:  "transparent",
  drawerOverlay:"rgba(17,24,39,0.4)",
  dropdownBg:   "#FFFFFF",
  modalOverlay: "rgba(17,24,39,0.4)",
};

/* ─── small inner components ─── */
function LangToggle({ C, inline }: { C: DashboardThemeColors; inline?: boolean }) {
  const { lang, setLang } = useLang();
  const onA = (c: boolean) => c ? "linear-gradient(120deg,#c69049,#a36f2a)" : "transparent";
  const onF = (c: boolean) => c ? "#100d0a" : C.menuInactive;
  return (
    <div style={{ display:"flex", flexShrink:0, background:C.btnBg, border:`1px solid ${C.btnBdr}`, borderRadius: inline ? "10px" : "9px", padding: inline ? "3px" : "3px" }}>
      {(["en","so"] as const).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{ border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize: inline ? "11px" : "11.5px", fontWeight:600, padding: inline ? "5px 8px" : "4px 9px", borderRadius: inline ? "7px" : "6px", transition:".25s", background:onA(lang===l), color:onF(lang===l) }}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

function NavModeToggle({ navMode, setNavMode, C, inline }: { navMode: NavMode; setNavMode: (m: NavMode) => void; C: DashboardThemeColors; inline?: boolean }) {
  const onA = (c: boolean) => c ? "linear-gradient(120deg,#c69049,#a36f2a)" : "transparent";
  const onF = (c: boolean) => c ? "#100d0a" : C.menuInactive;
  return (
    <div style={{ display:"flex", flexShrink:0, background:C.btnBg, border:`1px solid ${C.btnBdr}`, borderRadius: inline ? "10px" : "9px", padding:"3px" }}>
      {([["vertical","sidebar"],["horizontal","header"]] as const).map(([mode, icon]) => (
        <button key={mode} onClick={() => setNavMode(mode)} title={mode} style={{ display:"flex", alignItems:"center", justifyContent:"center", width: inline ? "26px" : "28px", height: inline ? "26px" : "24px", borderRadius:"7px", cursor:"pointer", border:"none", transition:".25s", background:onA(navMode===mode), color:onF(navMode===mode) }}>
          <Icon name={icon} size={14} sw={1.9} />
        </button>
      ))}
    </div>
  );
}

function ThemeToggleBtn({ C, inline }: { C: DashboardThemeColors; inline?: boolean }) {
  return <ColorToggle btnBg={C.btnBg} btnBdr={C.btnBdr} menuInactive={C.menuInactive} inline={inline} />;
}

function useKpiCounter(targets: number[]) {
  const [vals, setVals] = useState(() => targets.map(() => 0));
  const rafRef = useRef<number>(0);
  const key = targets.join(",");
  useEffect(() => {
    const dur = 1400; const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVals(targets.map(v => Math.round(v * e)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [key]); // eslint-disable-line
  return vals;
}

/* ─── MenuTokens: subset of theme tokens used by the sidebar ─── */
interface MenuTokens {
  menuActive: string; menuInactive: string;
  menuSubActive: string; menuSubInact: string;
  txtMuted: string; panelBg: string; cardBdr: string;
}
interface MenuItemsProps {
  menu: MenuItem[]; accent: string; C: MenuTokens;
  activeMenu: string; openSubs: Record<string, boolean>; isDark: boolean;
  horizontal?: boolean;
  setActiveMenu: (id: string) => void;
  toggleSub: (id: string) => void;
  closeSub: (id: string) => void;
  setDrawerOpen: (open: boolean) => void;
  setSuspectProfileId: (id: number | null) => void;
}

/* Defined at module level so React can reconcile without unmounting,
   which would replay the slide-in animations on every state change. */
const MenuItems = memo(function MenuItems({
  menu, accent, C, activeMenu, openSubs, isDark, horizontal = false,
  setActiveMenu, toggleSub, closeSub, setDrawerOpen, setSuspectProfileId,
}: MenuItemsProps) {
  const isAct = (item: { id: string; subs?: { id: string }[] }) =>
    activeMenu === item.id || (item.subs || []).some(s => s.id === activeMenu);

  return (
    <>
      {menu.map((item, mi) => {
        const hasSub = !!(item.subs?.length);
        const showSub = hasSub && !!openSubs[item.id];
        const act = isAct(item);

        if (horizontal) {
          return (
            <div key={item.id} style={{ position:"relative" }}>
              <button onClick={() => hasSub ? toggleSub(item.id) : setActiveMenu(item.id)}
                style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"10px", border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", background: act ? hexA(accent, 0.18) : "transparent", color: act ? C.menuActive : C.menuInactive, transition:".2s", whiteSpace:"nowrap" }}
                onMouseEnter={e => { if (!act) { (e.currentTarget as HTMLElement).style.background=isDark?"rgba(255,255,255,0.05)":"#F3F4F6"; (e.currentTarget as HTMLElement).style.color=C.menuActive; } }}
                onMouseLeave={e => { if (!act) { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color=C.menuInactive; } }}
              >
                <span style={{ display:"flex", color: act ? accent : C.txtMuted }}><Icon name={item.icon} size={17} sw={1.8} /></span>
                <span style={{ fontSize:"14px" }}>{item.label}</span>
                {hasSub && <span style={{ display:"flex", color:C.txtMuted, transform: showSub ? "rotate(180deg)" : "none", transition:"transform .3s" }}><Icon name="chevdown" size={15} sw={2} /></span>}
              </button>
              {hasSub && showSub && (
                <div style={{ position:"absolute", top:"46px", left:0, minWidth:"190px", zIndex:60, padding:"8px", borderRadius:"13px", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:"0 24px 50px -20px rgba(0,0,0,.3)", display:"flex", flexDirection:"column", gap:"2px", animation:"is-fadeUp .25s ease both" }}>
                  {item.subs!.map(sub => (
                    <button key={sub.id} onClick={() => { setActiveMenu(sub.id); closeSub(item.id); if (sub.id !== "suspect") setSuspectProfileId(null); }}
                      style={{ width:"100%", textAlign:"left", padding:"9px 11px", borderRadius:"8px", border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"13.5px", transition:".2s", background: activeMenu===sub.id ? hexA(accent,0.14) : "transparent", color: activeMenu===sub.id ? C.menuSubActive : C.menuSubInact }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background=isDark?"rgba(255,255,255,0.05)":"#F3F4F6"; (e.currentTarget as HTMLElement).style.color=C.menuActive; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background=activeMenu===sub.id?hexA(accent,0.14):"transparent"; (e.currentTarget as HTMLElement).style.color=activeMenu===sub.id?C.menuSubActive:C.menuSubInact; }}
                    >{sub.label}</button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={item.id}>
            <button onClick={() => hasSub ? toggleSub(item.id) : setActiveMenu(item.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 13px", borderRadius:"12px", border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", textAlign:"left", background: act ? `linear-gradient(100deg,${hexA(accent,0.18)},${hexA(accent,0.05)})` : "transparent", color: act ? C.menuActive : C.menuInactive, boxShadow: act ? `inset 0 0 0 1px ${hexA(accent,0.28)},0 4px 14px -8px ${hexA(accent,0.3)}` : "none", transition:".25s" }}
              onMouseEnter={e => { if (!act) { (e.currentTarget as HTMLElement).style.background=isDark?"rgba(255,255,255,0.05)":"#F3F4F6"; (e.currentTarget as HTMLElement).style.color=C.menuActive; (e.currentTarget as HTMLElement).style.transform="translateX(3px)"; } }}
              onMouseLeave={e => { if (!act) { (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color=C.menuInactive; (e.currentTarget as HTMLElement).style.transform=""; } }}
            >
              <span style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <span style={{ display:"flex", color: act ? accent : C.txtMuted }}><Icon name={item.icon} size={19} sw={1.8} /></span>
                <span style={{ fontSize:"14.5px", letterSpacing:".02em" }}>{item.label}</span>
              </span>
              <span style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                {(item as SurveyMenuItem).badge && (
                  <span style={{
                    fontSize:"11px", fontWeight:700, padding:"2px 8px", borderRadius:"20px",
                    background: hexA(accent, isDark ? 0.18 : 0.14), color: isDark ? accent : C.menuActive,
                    border: `1px solid ${hexA(accent, isDark ? 0.3 : 0.35)}`,
                  }}>
                    {(item as SurveyMenuItem).badge}
                  </span>
                )}
                {hasSub && <span style={{ display:"flex", color:C.txtMuted, transition:"transform .3s", transform: showSub?"rotate(90deg)":"none" }}><Icon name="chevron" size={16} sw={2} /></span>}
              </span>
            </button>
            {hasSub && showSub && (
              <div style={{ margin:"3px 0 6px 17px", paddingLeft:"13px", borderLeft:`1px solid ${hexA(accent,0.2)}`, display:"flex", flexDirection:"column", gap:"2px", animation:"is-fadeUp .3s ease both" }}>
                {item.subs!.map(sub => (
                  <button key={sub.id} onClick={() => { setActiveMenu(sub.id); setDrawerOpen(false); if (sub.id !== "suspect") setSuspectProfileId(null); }}
                    style={{ width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:"9px", border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"13.5px", transition:".2s", background: activeMenu===sub.id?hexA(accent,0.12):"transparent", color: activeMenu===sub.id?C.menuSubActive:C.menuSubInact }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background=isDark?"rgba(255,255,255,0.05)":"#F3F4F6"; (e.currentTarget as HTMLElement).style.color=C.menuActive; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background=activeMenu===sub.id?hexA(accent,0.12):"transparent"; (e.currentTarget as HTMLElement).style.color=activeMenu===sub.id?C.menuSubActive:C.menuSubInact; }}
                  >{sub.label}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

function formatLoginAgoWorkspace(iso: string, t: ReturnType<typeof getDict>): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return t.amnigaAgoJustNow;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t.amnigaAgoJustNow;
  if (mins === 1) return `1 ${t.amnigaAgoMinute}`;
  if (mins < 60) return `${mins} ${t.amnigaAgoMinutes}`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return `1 ${t.amnigaAgoHour}`;
  if (hours < 24) return `${hours} ${t.amnigaAgoHours}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `1 ${t.amnigaAgoDay}`;
  if (days < 7) return `${days} ${t.amnigaAgoDays}`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return `1 ${t.amnigaAgoWeek}`;
  return `${weeks} ${t.amnigaAgoWeeks}`;
}

export function ModuleWorkspace({
  moduleId,
  initialNav,
  initialSurveyProfileId,
  initialSurveySubmit,
  initialSurveyResponseId,
  initialSurveyRespondentKey,
  initialAgentProfileId,
  initialDhacdoProfileId,
  initialDhacdoVictimId,
}: {
  moduleId: ModuleId;
  initialNav?: ModuleNavSnapshot;
  initialSurveyProfileId?: number;
  initialSurveySubmit?: boolean;
  initialSurveyResponseId?: number;
  initialSurveyRespondentKey?: string;
  initialAgentProfileId?: number;
  initialDhacdoProfileId?: number;
  initialDhacdoVictimId?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const agentPathMatch = useMemo(() => {
    if (moduleId !== "amniga") return null;
    return pathname?.match(/^\/dashboard\/amniga\/ciidan\/(\d+)\/?$/);
  }, [moduleId, pathname]);
  const agentIdFromPath = agentPathMatch ? Number(agentPathMatch[1]) : null;
  const activeAgentProfileId = agentIdFromPath ?? initialAgentProfileId ?? null;
  const surveyResponsePathMatch = useMemo(() => {
    if (moduleId !== "survey") return null;
    const m = pathname?.match(/^\/dashboard\/survey\/responses\/(\d+)\/?$/);
    return m ? Number(m[1]) : null;
  }, [moduleId, pathname]);
  const surveyRespondentPathMatch = useMemo(() => {
    if (moduleId !== "survey") return null;
    const m = pathname?.match(/^\/dashboard\/survey\/respondents\/([^/]+)\/?$/);
    if (!m?.[1]) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }, [moduleId, pathname]);
  const surveyPathMatch = useMemo(() => {
    if (moduleId !== "survey") return null;
    if (pathname?.includes("/responses/") || pathname?.includes("/respondents/")) return null;
    return pathname?.match(/^\/dashboard\/survey\/(\d+)(?:\/(submit))?\/?$/);
  }, [moduleId, pathname]);
  const surveyIdFromPath = surveyPathMatch ? Number(surveyPathMatch[1]) : null;
  const isSurveySubmitPath = surveyPathMatch?.[2] === "submit";
  const dhacdoPathMatch = useMemo(() => {
    if (moduleId !== "dhacdooyin") return null;
    return pathname?.match(/^\/dashboard\/dhacdooyin\/(\d+)(?:\/victim\/(\d+))?\/?$/);
  }, [moduleId, pathname]);
  const dhacdoIdFromPath = dhacdoPathMatch ? Number(dhacdoPathMatch[1]) : null;
  const dhacdoVictimIdFromPath = dhacdoPathMatch?.[2] ? Number(dhacdoPathMatch[2]) : null;
  const logout = useLogout();
  const { lang } = useLang();
  const { theme } = useTheme();
  const { palette } = useColorPalette();
  const isDark = theme === "dark";
  const C = applyPalette(isDark ? DK : LT, palette, isDark);
  const sidebarSurface = sidebarSurfaceStyle(isDark, C.sidebarBg as string);

  const t = getDict(lang);
  const MODS = getModules(lang);
  const M = MODS[moduleId];
  const isSurveyModule = moduleId === "survey";
  const { data: surveyStats } = useSurveyStats();
  const effectiveMenu = isSurveyModule
    ? getSurveyMenu(lang, {
        totalSurveys: surveyStats?.total_surveys,
        totalResponses: surveyStats?.total_responses,
      })
    : M.menu;
  const effectiveAccent = isSurveyModule ? SURVEY_ACCENT : M.accent;
  const effectiveGrad = isSurveyModule ? SURVEY_GRAD : M.grad;
  const effectiveGlow = isSurveyModule ? SURVEY_GLOW : M.glow;
  const { user, permissions, revision, canViewMenuItem, canAdd, canModule, isLoading: permissionsLoading, isPrivileged: userIsPrivileged } = usePermissions();
  const queryClient = useQueryClient();
  const visibleMenu = useMemo(
    () => filterMenuItems(effectiveMenu, user ? { ...user, permissions } : user),
    [effectiveMenu, user, permissions, revision],
  );

  const nav0 = moduleId === "survey"
    ? normalizeSurveyNav(initialNav ?? defaultModuleNav())
    : (initialNav ?? defaultModuleNav());

  const [activeMenu, setActiveMenu] = useState(nav0.activeMenu);
  const [surveyProfileId, setSurveyProfileId] = useState<number | null>(
    initialSurveyProfileId ?? null,
  );
  const [surveyResponseProfileId, setSurveyResponseProfileId] = useState<number | null>(
    initialSurveyResponseId ?? null,
  );
  const [surveyRespondentProfileKey, setSurveyRespondentProfileKey] = useState<string | null>(
    initialSurveyRespondentKey ?? null,
  );
  const [surveySubmitMode, setSurveySubmitMode] = useState(Boolean(initialSurveySubmit));
  const [searchQuery, setSearchQuery] = useState(nav0.searchQuery);
  const [suspectProfileId, setSuspectProfileId] = useState<number | null>(nav0.suspectProfileId);
  const [suspectOfficerProfileOpen, setSuspectOfficerProfileOpen] = useState(false);
  const [hubRecordProfileId, setHubRecordProfileId] = useState<number | null>(null);
  const [dhacdoProfileId, setDhacdoProfileId] = useState<number | null>(initialDhacdoProfileId ?? null);
  const activeDhacdoProfileId = dhacdoIdFromPath ?? dhacdoProfileId;
  const [dhacdoVictimId, setDhacdoVictimId] = useState<number | null>(initialDhacdoVictimId ?? null);
  const activeDhacdoVictimId = dhacdoVictimIdFromPath ?? dhacdoVictimId;
  const openDhacdoProfile = useCallback((id: number | null) => {
    setDhacdoProfileId(id);
    setDhacdoVictimId(null);
    router.push(id ? `/dashboard/dhacdooyin/${id}` : "/dashboard/dhacdooyin");
  }, [router]);
  const openDhacdoVictim = useCallback((id: number | null) => {
    setDhacdoVictimId(id);
    if (activeDhacdoProfileId == null) return;
    router.push(
      id ? `/dashboard/dhacdooyin/${activeDhacdoProfileId}/victim/${id}` : `/dashboard/dhacdooyin/${activeDhacdoProfileId}`,
    );
  }, [router, activeDhacdoProfileId]);
  const [userProfileId, setUserProfileId] = useState<string | null>(nav0.userProfileId);
  const [myAccountProfileOpen, setMyAccountProfileOpen] = useState(false);
  const openUsersCreateRef = useRef<(() => void) | null>(null);
  const openGroupsCreateRef = useRef<(() => void) | null>(null);
  const openQeybsCreateRef = useRef<(() => void) | null>(null);
  const openAgentsCreateRef = useRef<(() => void) | null>(null);
  const openSuspectsCreateRef = useRef<(() => void) | null>(null);
  const openHubRecordsCreateRef = useRef<(() => void) | null>(null);
  const openDhacdoUtilityCreateRef = useRef<(() => void) | null>(null);
  const openDhacdoRequirementsCreateRef = useRef<(() => void) | null>(null);
  const openDhacdoEventsCreateRef = useRef<(() => void) | null>(null);
  const openWantedCreateRef = useRef<(() => void) | null>(null);
  const openVisitorsCreateRef = useRef<(() => void) | null>(null);

  const registerUsersAdd = useCallback((fn: () => void) => { openUsersCreateRef.current = fn; }, []);
  const registerGroupsAdd = useCallback((fn: () => void) => { openGroupsCreateRef.current = fn; }, []);
  const registerQeybsAdd = useCallback((fn: () => void) => { openQeybsCreateRef.current = fn; }, []);
  const registerAgentsAdd = useCallback((fn: () => void) => { openAgentsCreateRef.current = fn; }, []);
  const registerSuspectsAdd = useCallback((fn: () => void) => { openSuspectsCreateRef.current = fn; }, []);
  const registerHubRecordsAdd = useCallback((fn: () => void) => { openHubRecordsCreateRef.current = fn; }, []);
  const registerDhacdoUtilityAdd = useCallback((fn: () => void) => { openDhacdoUtilityCreateRef.current = fn; }, []);
  const registerDhacdoRequirementsAdd = useCallback((fn: () => void) => { openDhacdoRequirementsCreateRef.current = fn; }, []);
  const registerDhacdoEventsAdd = useCallback((fn: () => void) => { openDhacdoEventsCreateRef.current = fn; }, []);
  const registerWantedAdd = useCallback((fn: () => void) => { openWantedCreateRef.current = fn; }, []);
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>(() =>
    openSubsForActiveMenu(effectiveMenu, nav0.activeMenu, nav0.openSubs),
  );
  const [navMode, setNavMode] = useState<NavMode>(nav0.navMode);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 859px)").matches;
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const prevActiveMenuRef = useRef(nav0.activeMenu);
  const prevActiveMenuForSubsRef = useRef<string | null>(null);
  const skipNavPersistRef = useRef(true);
  const navSnapRef = useRef<ModuleNavSnapshot>(nav0);
  const isAmnigaModule = moduleId === "amniga";
  const isAmnigaDataMenu = activeMenu === "dashboard";
  const isAmnigaDataView = isAmnigaModule && isAmnigaDataMenu;
  const { data: amnigaStats } = useAmnigaStatsEnabled(isAmnigaDataView);
  const { data: amnigaAnalytics } = useAmnigaAnalytics("7d", isAmnigaDataView);
  const amnigaStatusLabel = (status: string) => ({
    on_duty: t.statusOnDuty,
    on_leave: t.statusOnLeave,
    medical: t.statusMedical,
    suspended: t.statusSuspended,
    active: t.statusActive,
    watching: t.statusWatching,
    detained: t.statusDetained,
    cleared: t.statusCleared,
  }[status] ?? status);
  const MEffective = useMemo(() => {
    if (!isAmnigaDataView) return M;
    const emptyState = {
      ...M,
      kpis: [
        { icon: "shield", label: t.amnigaActivePatrols, value: 0, suffix: "", delta: "", up: true },
        { icon: "alert", label: t.amnigaIncidentsToday, value: 0, suffix: "", delta: "", up: true },
        { icon: "users", label: t.amnigaGuardsOnDuty, value: 0, suffix: "", delta: "", up: true },
        { icon: "clipboard", label: t.amnigaDailyReports, value: 0, suffix: "", delta: "", up: true },
      ],
      bars: [0, 0, 0, 0, 0, 0, 0],
      breakdown: [] as { label: string; pct: number }[],
      table: {
        cols: [t.amnigaColUser, t.amnigaColZone, t.amnigaColOs, t.amnigaColTime],
        rows: [] as [string, string, string, string, string][],
      },
    };
    if (!amnigaStats || !amnigaAnalytics) return emptyState;
    const fmtDelta = (delta?: { pct: number; up: boolean } | null) =>
      delta ? `${delta.up ? "+" : "-"}${delta.pct}%` : "";
    const bars = amnigaAnalytics.weekly_trend.map((p) => p.count);
    const breakdown = amnigaAnalytics.breakdown.map((b) => ({
      label: b.label,
      pct: b.pct,
    }));
    const rows = amnigaAnalytics.recent_activity.map((row) => ([
      row.name || "-",
      row.zone || "-",
      `${row.os_name || row.device || "-"} · ${row.client === "web" ? t.amnigaClientWeb : t.amnigaClientMobile}`,
      row.created_at ? formatLoginAgoWorkspace(row.created_at, t) : "-",
      row.color || "#9a8a6f",
    ] as [string, string, string, string, string]));
    return {
      ...emptyState,
      kpis: [
        { icon: "shield", label: t.amnigaActivePatrols, value: amnigaStats.active_patrols, suffix: "", delta: fmtDelta(amnigaStats.deltas.active_patrols), up: (amnigaStats.deltas.active_patrols?.up ?? true) },
        { icon: "alert", label: t.amnigaIncidentsToday, value: amnigaStats.incidents_today, suffix: "", delta: fmtDelta(amnigaStats.deltas.incidents_today), up: (amnigaStats.deltas.incidents_today?.up ?? true) },
        { icon: "users", label: t.amnigaGuardsOnDuty, value: amnigaStats.guards_on_duty, suffix: "", delta: fmtDelta(amnigaStats.deltas.guards_on_duty), up: (amnigaStats.deltas.guards_on_duty?.up ?? true) },
        { icon: "clipboard", label: t.amnigaDailyReports, value: amnigaStats.daily_reports, suffix: "", delta: fmtDelta(amnigaStats.deltas.daily_reports), up: (amnigaStats.deltas.daily_reports?.up ?? true) },
      ],
      bars: bars.length ? bars : [0, 0, 0, 0, 0, 0, 0],
      breakdown,
      table: {
        cols: [t.amnigaColUser, t.amnigaColZone, t.amnigaColOs, t.amnigaColTime],
        rows,
      },
    };
  }, [M, amnigaAnalytics, amnigaStats, isAmnigaDataView, t]);

  const setNavModePersisted = useCallback((mode: NavMode) => {
    setNavMode(mode);
    persistNavLayoutPreference(mode);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-nav-layout", mode);
    }
  }, []);


  // Sync profile id from URL when navigating to survey or response profile routes.
  useEffect(() => {
    if (moduleId !== "survey") return;
    if (surveyResponsePathMatch != null) {
      setSurveyResponseProfileId(surveyResponsePathMatch);
      setSurveyRespondentProfileKey(null);
      setSurveyProfileId(null);
      setSurveySubmitMode(false);
      setActiveMenu("responses");
      return;
    }
    if (surveyRespondentPathMatch != null) {
      setSurveyRespondentProfileKey(surveyRespondentPathMatch);
      setSurveyResponseProfileId(null);
      setSurveyProfileId(null);
      setSurveySubmitMode(false);
      setActiveMenu("settings");
      return;
    }
    setSurveyResponseProfileId(null);
    setSurveyRespondentProfileKey(null);
    if (surveyIdFromPath != null) {
      setSurveyProfileId(surveyIdFromPath);
      setSurveySubmitMode(isSurveySubmitPath);
      setActiveMenu("surveys");
    } else {
      setSurveyProfileId(null);
      setSurveySubmitMode(false);
    }
  }, [moduleId, surveyIdFromPath, surveyResponsePathMatch, surveyRespondentPathMatch, isSurveySubmitPath]);

  useEffect(() => {
    if (moduleId !== "amniga") return;
    if (agentIdFromPath != null) {
      setActiveMenu("forces");
      setOpenSubs((prev) => (prev.forces ? prev : { ...prev, forces: true }));
    }
  }, [moduleId, agentIdFromPath]);

  // Sync event/victim profile id from URL — lands the correct menu open on a
  // direct link to /dashboard/dhacdooyin/{id}(/victim/{id}) and survives a
  // page refresh there.
  useEffect(() => {
    if (moduleId !== "dhacdooyin") return;
    if (dhacdoIdFromPath != null) {
      setDhacdoProfileId(dhacdoIdFromPath);
      setActiveMenu("dhacdooyinka");
    }
    setDhacdoVictimId(dhacdoVictimIdFromPath);
  }, [moduleId, dhacdoIdFromPath, dhacdoVictimIdFromPath]);

  useEffect(() => {
    navSnapRef.current = {
      activeMenu,
      searchQuery,
      suspectProfileId,
      userProfileId,
      openSubs,
      navMode,
    };
  }, [activeMenu, searchQuery, suspectProfileId, userProfileId, openSubs, navMode]);

  const selectMenu = useCallback((id: string) => {
    prefetchModuleMenu(queryClient, id);
    const nextOpenSubs = openSubsForActiveMenu(effectiveMenu, id, openSubs);
    const nextSearch = id === "suspect" || id === "records" ? searchQuery : "";
    const nextSuspectProfile = id === "suspect" ? suspectProfileId : null;
    const nextHubRecordProfile = id === "records" || id === "gallery" ? hubRecordProfileId : null;
    const nextUserProfile = id === "ucusers" ? userProfileId : null;

    // Leaving survey profile URL — clear profile so Dashboard / other tabs can render.
    if (moduleId === "survey") {
      if (surveyResponsePathMatch != null || surveyRespondentPathMatch != null || surveyIdFromPath != null) {
        setSurveyResponseProfileId(null);
        setSurveyRespondentProfileKey(null);
        setSurveyProfileId(null);
        router.push("/dashboard/survey");
      } else if (id === "surveys") {
        setSurveyProfileId(null);
      }
    }

    // Leaving agent profile URL — return to Amniga list shell.
    if (moduleId === "amniga" && activeAgentProfileId != null) {
      router.push("/dashboard/amniga");
    }
    // Leaving dhacdo event profile URL — return to Dhacdooyin list shell.
    if (moduleId === "dhacdooyin" && id !== "dhacdooyinka" && activeDhacdoProfileId != null) {
      router.push("/dashboard/dhacdooyin");
    }

    setActiveMenu(id);
    setMyAccountProfileOpen(false);
    if (id !== "suspect" && id !== "records") setSearchQuery("");
    if (id !== "suspect") setSuspectProfileId(null);
    if (id !== "records" && id !== "gallery") setHubRecordProfileId(null);
    if (id !== "dhacdooyinka") { setDhacdoProfileId(null); setDhacdoVictimId(null); }
    if (id !== "ucusers") setUserProfileId(null);
    setOpenSubs(nextOpenSubs);
    prevActiveMenuRef.current = id;

    const snap: ModuleNavSnapshot = {
      activeMenu: id,
      searchQuery: nextSearch,
      suspectProfileId: nextSuspectProfile,
      userProfileId: nextUserProfile,
      openSubs: nextOpenSubs,
      navMode,
    };
    navSnapRef.current = snap;
    persistModuleNav(moduleId, snap);
  }, [activeAgentProfileId, effectiveMenu, moduleId, navMode, openSubs, queryClient, router, searchQuery, suspectProfileId, surveyIdFromPath, surveyResponsePathMatch, surveyRespondentPathMatch, userProfileId]);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 859px)");
    const apply = () => {
      const m = mq.matches;
      setIsMobile(m);
      if (m) setDrawerOpen(false);
    };
    apply();
    // Safari < 14 uses addListener
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < 860 || window.matchMedia("(max-width: 859px)").matches;
      setIsMobile(m);
      if (m) setDrawerOpen(false);
    };
    window.addEventListener("resize", check);
    window.visualViewport?.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      window.visualViewport?.removeEventListener("resize", check);
    };
  }, []);

  // Restore nav from SSR cookie + localStorage (refresh must keep active page).
  useLayoutEffect(() => {
    let restored = mergeModuleNav(
      defaultModuleNav(),
      initialNav ?? defaultModuleNav(),
      readModuleNavFromDocumentCookie(moduleId),
      readModuleNavFromStorage(moduleId),
      { navMode: readNavLayoutPreference() },
    );
    if (moduleId === "survey") restored = normalizeSurveyNav(restored);

    setNavMode(restored.navMode);
    setActiveMenu(restored.activeMenu);
    setSearchQuery(restored.searchQuery);
    setSuspectProfileId(restored.suspectProfileId);
    setUserProfileId(restored.userProfileId);
    setOpenSubs(openSubsForActiveMenu(effectiveMenu, restored.activeMenu, restored.openSubs));
    prevActiveMenuRef.current = restored.activeMenu;
    prevActiveMenuForSubsRef.current = restored.activeMenu;
    navSnapRef.current = restored;
    persistModuleNav(moduleId, restored);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-nav-layout", restored.navMode);
    }
    skipNavPersistRef.current = false;
  }, [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id) return;
    if (consumeOpenMyProfile()) setMyAccountProfileOpen(true);
  }, [user?.id, moduleId]);

  // Whole module is off-limits — bounce before any of its chrome/data renders.
  // revision===0 means permissions haven't been seeded yet (not "user genuinely has none") —
  // a truly empty permission set (e.g. a group revoked entirely) must still redirect.
  useEffect(() => {
    if (permissionsLoading || !user) return;
    if (!userIsPrivileged && revision === 0) return;
    if (!canModule(moduleId)) {
      router.replace(`/dashboard/forbidden?module=${moduleId}`);
    }
  }, [permissionsLoading, user, userIsPrivileged, revision, canModule, moduleId, router]);

  useEffect(() => {
    if (permissionsLoading || !user) return;
    if (!userIsPrivileged && revision === 0) return;

    const validMenuIds = new Set<string>(
      visibleMenu.flatMap((item) => [item.id, ...(item.subs?.map((s) => s.id) ?? [])]),
    );
    if (validMenuIds.has(activeMenu)) return;

    const allMenuIds = new Set<string>(
      effectiveMenu.flatMap((item) => [item.id, ...(item.subs?.map((s) => s.id) ?? [])]),
    );
    if (allMenuIds.has(activeMenu) && !canViewMenuItem(activeMenu)) {
      router.replace(`/dashboard/forbidden?module=${moduleId}`);
      return;
    }
    if (!allMenuIds.has(activeMenu) && visibleMenu.length > 0) {
      const dashboard = visibleMenu.find((item) => item.id === "dashboard");
      setActiveMenu(dashboard?.id ?? visibleMenu[0].id);
    }
  }, [visibleMenu, activeMenu, revision, user, permissionsLoading, permissions, userIsPrivileged, canViewMenuItem, effectiveMenu, moduleId, router]);

  // Auto-open parent only when navigating to a sub-item — not when permissions/menu re-render.
  useEffect(() => {
    if (permissionsLoading || !user || visibleMenu.length === 0) return;
    if (prevActiveMenuForSubsRef.current === activeMenu) return;
    prevActiveMenuForSubsRef.current = activeMenu;
    setOpenSubs((prev) => openSubsForActiveMenu(visibleMenu, activeMenu, prev));
  }, [activeMenu, visibleMenu, permissionsLoading, user]);

  useEffect(() => {
    const prev = prevActiveMenuRef.current;
    if (prev === activeMenu) return;
    if (activeMenu !== "suspect") {
      setSuspectProfileId(null);
      setSuspectOfficerProfileOpen(false);
      setSearchQuery("");
    }
    if (activeMenu !== "records" && activeMenu !== "gallery") {
      setHubRecordProfileId(null);
    }
    if (activeMenu !== "dhacdooyinka") {
      setDhacdoProfileId(null);
      setDhacdoVictimId(null);
    }
    if (activeMenu !== "ucusers") {
      setUserProfileId(null);
    }
    prevActiveMenuRef.current = activeMenu;
  }, [activeMenu, moduleId]);

  useEffect(() => {
    if (moduleId === "hub") {
      if (activeMenu === "new" || activeMenu === "registry") {
        setActiveMenu("records");
      } else if (["collection", "verification", "drives", "inventory", "handed", "registered"].includes(activeMenu)) {
        setActiveMenu(activeMenu === "handed" || activeMenu === "registered" ? "records" : "dashboard");
      }
    }
  }, [moduleId, activeMenu]);

  useEffect(() => {
    if (moduleId !== "usercontrol" || permissionsLoading || !user) return;
    if (!userIsPrivileged && revision === 0) return;
    if (!canViewMenuItem(activeMenu)) router.replace(`/dashboard/forbidden?module=${moduleId}`);
  }, [moduleId, permissionsLoading, user, userIsPrivileged, permissions, revision, activeMenu, canViewMenuItem, router]);

  useEffect(() => {
    if (skipNavPersistRef.current) return;
    persistModuleNav(moduleId, {
      activeMenu,
      searchQuery,
      suspectProfileId,
      userProfileId,
      openSubs,
      navMode,
    });
  }, [moduleId, activeMenu, searchQuery, suspectProfileId, userProfileId, openSubs, navMode]);

  useEffect(() => {
    document.body.dataset.auditModule = moduleId;
    return () => {
      delete document.body.dataset.auditModule;
    };
  }, [moduleId]);

  const kpiVals = useKpiCounter(MEffective.kpis.map(k => k.value));
  const toggleSub = useCallback((id: string) => {
    setOpenSubs((p) => ({ ...p, [id]: !p[id] }));
  }, []);
  const closeSub = useCallback((id: string) => {
    setOpenSubs((p) => (p[id] ? { ...p, [id]: false } : p));
  }, []);

  const openMyProfile = useCallback(() => {
    if (!user?.id) return;
    setMyAccountProfileOpen(true);
  }, [user?.id]);

  const closeMyProfile = useCallback(() => {
    setMyAccountProfileOpen(false);
  }, []);

  const navVertical   = navMode === "vertical"   && !isMobile;
  const navHorizontal = navMode === "horizontal" && !isMobile;

  let crumb = visibleMenu[0]?.label ?? effectiveMenu[0].label;
  visibleMenu.forEach(item => {
    if (item.id === activeMenu) crumb = item.label;
    (item.subs || []).forEach(s => { if (s.id === activeMenu) crumb = s.label; });
  });

  useEffect(() => {
    const pageId = myAccountProfileOpen && user?.id ? `account/profile/${user.id}`
      : userProfileId ? `ucusers/profile/${userProfileId}`
      : suspectProfileId ? `suspect/profile/${suspectProfileId}`
      : activeAgentProfileId != null ? `ciidan/profile/${activeAgentProfileId}`
      : activeMenu;
    logPageVisit(moduleId, pageId, crumb);
  }, [moduleId, activeMenu, crumb, userProfileId, suspectProfileId, activeAgentProfileId, myAccountProfileOpen, user?.id]);

  const maxBar = Math.max(...MEffective.bars);
  const dayLabels = ["M","T","W","T","F","S","S"];

  const isAmnigaDashboardView = moduleId === "amniga" && activeMenu === "dashboard";
  const isSuspectView = moduleId === "amniga" && activeMenu === "suspect";
  const isSuspectProfile = isSuspectView && suspectProfileId !== null;
  const isSuspectOfficerUserProfile = isSuspectProfile && suspectOfficerProfileOpen;
  const isDailyReportView = moduleId === "amniga" && activeMenu === "dailyreport";
  const isFaceMatchView = moduleId === "amniga" && activeMenu === "facematch";
  const isTrackMapView = moduleId === "amniga" && activeMenu === "trackmap";
  const isHubDashboardView = moduleId === "hub" && activeMenu === "dashboard";
  const isHubRecordsView = moduleId === "hub" && activeMenu === "records";
  const isHubGalleryView = moduleId === "hub" && activeMenu === "gallery";
  const isHubAnalyticsView = moduleId === "hub" && activeMenu === "analytics";
  const isHubRecordsProfile = isHubRecordsView && hubRecordProfileId !== null;
  const isHubGalleryProfile = isHubGalleryView && hubRecordProfileId !== null;
  const isAgentProfileView = moduleId === "amniga" && activeAgentProfileId != null;
  const isForcesView = moduleId === "amniga" && activeMenu === "forces" && !isAgentProfileView;
  const isPersonnelDashView = moduleId === "amniga" && activeMenu === "personneldash";
  const isAttendanceView = moduleId === "amniga" && activeMenu === "attendance";
  const isDistrictMgmtView = moduleId === "amniga" && activeMenu === "districtmgmt";
  const isPersonnelReportsView = moduleId === "amniga" && activeMenu === "personnelreports";
  const isAgentImportView = moduleId === "amniga" && activeMenu === "agentimport";
  const isAppUsersView = moduleId === "amniga" && activeMenu === "appusers";
  const isAppReleaseView = moduleId === "amniga" && activeMenu === "apprelease";
  const isUserReportsView = moduleId === "amniga" && activeMenu === "userreports";
  const isDistrictTasksView = moduleId === "amniga" && activeMenu === "districttasks";
  const isCishReportView = isUserReportsView || isDistrictTasksView || isAppUsersView;
  const isUsersView = moduleId === "usercontrol" && activeMenu === "ucusers";
  const isGroupsView = moduleId === "usercontrol" && activeMenu === "ucgroups";
  const isQeybahaView = moduleId === "usercontrol" && activeMenu === "ucqeybaha";
  const isPermissionsView = moduleId === "usercontrol" && activeMenu === "ucpermissions";
  const isAgentsView = moduleId === "usercontrol" && activeMenu === "agents";
  const isAuditView = moduleId === "usercontrol" && activeMenu === "audittrails";
  const isErrorLogsView = moduleId === "usercontrol" && activeMenu === "errorlogs";
  const isTrafficView = moduleId === "usercontrol" && activeMenu === "apitraffic";
  const isUserControlDashboardView = moduleId === "usercontrol" && activeMenu === "dashboard";
  const isDhacdoDashboardView = moduleId === "dhacdooyin" && activeMenu === "dashboard";
  const isDhacdoQaybahaView = moduleId === "dhacdooyin" && activeMenu === "qaybaha";
  const isDhacdoNoocaView = moduleId === "dhacdooyin" && activeMenu === "noocaDhacdo";
  const isDhacdoEventsView = moduleId === "dhacdooyin" && activeMenu === "dhacdooyinka";
  const isDhacdoEventsProfile = isDhacdoEventsView && activeDhacdoProfileId !== null;
  const isBaarisCitizensView = moduleId === "baaris" && activeMenu === "citizens";
  const isBaarisWantedView = moduleId === "baaris" && activeMenu === "wanted";
  const isBaarisDashboardView = moduleId === "baaris" && activeMenu === "dashboard";
  const isVisitorsDashboardView = moduleId === "visitors" && activeMenu === "dashboard";
  const isVisitorsListView = moduleId === "visitors" && activeMenu === "visitors";
  const activeSurveyProfileId = surveyIdFromPath ?? surveyProfileId;
  const activeSurveyResponseId = surveyResponsePathMatch ?? surveyResponseProfileId;
  const activeSurveyRespondentKey = surveyRespondentPathMatch ?? surveyRespondentProfileKey;
  const isSurveySubmitView = isSurveyModule && activeMenu === "surveys" && activeSurveyProfileId !== null && (isSurveySubmitPath || surveySubmitMode);
  const isSurveyListView = isSurveyModule && activeMenu === "surveys" && activeSurveyProfileId === null;
  const isSurveyProfileView = isSurveyModule && activeMenu === "surveys" && activeSurveyProfileId !== null && !isSurveySubmitView;
  const isSurveyResponseProfileView = isSurveyModule && activeSurveyResponseId !== null;
  const isSurveyRespondentProfileView = isSurveyModule && activeSurveyRespondentKey !== null;
  const isSurveyResponsesView = isSurveyModule && activeMenu === "responses" && !isSurveyResponseProfileView;
  const isSurveyOwnersView = isSurveyModule && activeMenu === "owners" && !isSurveyResponseProfileView;
  const isSurveyAnalyticsView = isSurveyModule && activeMenu === "surveyanalytics";
  const isSurveySettingsView = isSurveyModule && activeMenu === "settings" && !isSurveyRespondentProfileView;
  const isSurveyDashboardView = isSurveyModule && activeMenu === "dashboard";
  const isHubCompactView = isHubDashboardView || isHubGalleryView || isHubAnalyticsView
    || isHubRecordsProfile
    || isHubGalleryProfile
    || (isHubRecordsView && !isHubRecordsProfile);
  const isDhacdoCompactView = isDhacdoDashboardView || isDhacdoEventsProfile;
  const isAmnigaCompactView = isDailyReportView || isFaceMatchView || isTrackMapView || isAgentProfileView || isAmnigaDashboardView;
  const isBaarisCompactView = isBaarisDashboardView;
  const isVisitorsCompactView = isVisitorsDashboardView;
  const isUserControlCompactView = isUserControlDashboardView;
  const showSurveyPageHeader = isSurveyModule && !isSurveySubmitView && !isSurveyProfileView && !isSurveyResponseProfileView && !isSurveyRespondentProfileView && !isSurveyDashboardView && !isSurveyAnalyticsView && !isSurveyListView && !isSurveyResponsesView && !isSurveyOwnersView && !isSurveySettingsView;
  const compactModuleChrome = (isSurveyModule && !showSurveyPageHeader) || isHubCompactView || isDhacdoCompactView || isAmnigaCompactView || isBaarisCompactView || isVisitorsCompactView || isUserControlCompactView;
  const surveyPageSubtitle =
    isSurveyDashboardView ? M.tagline
    : isSurveyListView ? "Create, publish, and manage field surveys"
    : isSurveyResponsesView ? "Browse and review all submissions"
    : isSurveyOwnersView ? "Browse answers to the owner-name question"
    : isSurveyAnalyticsView ? "Deep insights — trends, geography, and field activity"
    : isSurveySettingsView ? "Track submitters on the map by location"
    : M.tagline;
  const isUserProfile = isUsersView && userProfileId !== null;
  const isMyAccountProfile = myAccountProfileOpen && !!user?.id;
  const isUCView = isUsersView || isGroupsView || isQeybahaView || isPermissionsView || isAgentsView || isAuditView || isErrorLogsView || isTrafficView;

  // Convenience object for passing to <MenuItems /> everywhere.
  const canShowAdd = !isMyAccountProfile && !isUserProfile && !isSuspectProfile && !isHubRecordsProfile && !isHubGalleryProfile && !isDhacdoEventsProfile && !isAgentProfileView && (
    isUsersView ? canAdd("ucusers")
      : isGroupsView ? canAdd("ucgroups")
      : isQeybahaView ? canAdd("ucqeybaha")
      : isAgentsView ? canAdd("agents")
      : isSuspectView ? canAdd("suspect")
      : isHubRecordsView ? canAdd("records")
      : isHubDashboardView ? canAdd("records")
      : isDhacdoQaybahaView ? true
      : isDhacdoNoocaView ? true
      : isVisitorsListView ? canAdd("visitors")
      : isBaarisWantedView ? canAdd("wanted") || canAdd("citizens") || userIsPrivileged
      : false
  );

  const menuProps: Omit<MenuItemsProps, "horizontal"> = {
    menu: visibleMenu, accent: effectiveAccent, C, activeMenu, openSubs, isDark,
    setActiveMenu: selectMenu, toggleSub, closeSub, setDrawerOpen, setSuspectProfileId,
  };

  /* ─── sidebar bottom controls — single-line prefs card ─── */
  const SidebarBottom = () => {
    const sep = isDark ? hexA(M.accent, 0.18) : C.tableSep;
    return (
      <div style={{ position:"relative", zIndex:1, padding:"6px 12px 20px", marginTop:"4px" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "14px",
            padding: "8px 10px",
            background: isDark
              ? `linear-gradient(165deg, ${hexA(M.accent, 0.11)} 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.1) 100%)`
              : "linear-gradient(165deg, #FFFFFF 0%, #FAFAF9 100%)",
            border: `1px solid ${isDark ? hexA(M.accent, 0.26) : "#E5E7EB"}`,
            boxShadow: isDark
              ? `inset 0 1px 0 rgba(248,228,180,0.07), 0 8px 22px -12px rgba(0,0,0,0.5)`
              : `0 1px 2px rgba(0,0,0,0.04)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: "2px",
              background: `linear-gradient(90deg, transparent, ${M.accent}, transparent)`,
              opacity: isDark ? 0.8 : 0.55,
              pointerEvents: "none",
            }}
          />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"7px", minWidth:0 }}>
            <LangToggle C={C} inline />
            <div style={{ width:"1px", height:"24px", background:sep, flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0, display:"flex", justifyContent:"center" }}>
              <ThemeToggleBtn C={C} inline />
            </div>
            <div style={{ width:"1px", height:"24px", background:sep, flexShrink:0 }} />
            <NavModeToggle navMode={navMode} setNavMode={setNavModePersisted} C={C} inline />
          </div>
        </div>
      </div>
    );
  };

  /* sidebar px width */
  const SIDEBAR_W = 268;

  const SidebarEmblem = ({ size = 300 }: { size?: number }) => (
    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:0 }}>
      <div style={{ position:"absolute", width:"200px", height:"min(420px,70%)", background:C.beamGrad, animation:"is-beam 6.5s ease-in-out infinite" }} />
      <div style={{ width:`${size}px`, height:`${size}px`, flexShrink:0, WebkitMaskImage:"url('/emblem.png')", WebkitMaskSize:"contain", WebkitMaskRepeat:"no-repeat", WebkitMaskPosition:"center", maskImage:"url('/emblem.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center", background:C.emblemGrad, opacity: isDark ? 0.16 : 0.14, mixBlendMode:C.emblemBlend, animation:"is-drift 9s ease-in-out infinite" }} />
    </div>
  );

  return (
    <div className="lmsbr-shell-root" style={{ position:"relative", minHeight:"100vh", overflowX:"hidden" }}>

      {/* ── Emblem: main content watermark ── */}
      <div className="lmsbr-content-watermark" style={{
        position:"fixed",
        left:  navVertical ? `${SIDEBAR_W}px` : 0,
        top:   navHorizontal ? "62px" : (isMobile ? "58px" : 0),
        width: navVertical ? `calc(100vw - ${SIDEBAR_W}px)` : "100vw",
        height: (navHorizontal || isMobile) ? `calc(100vh - ${navHorizontal ? 62 : 58}px)` : "100vh",
        pointerEvents:"none", zIndex:100,
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"left .5s cubic-bezier(.4,0,.2,1),width .5s cubic-bezier(.4,0,.2,1)",
      }}>
        <div style={{ width:"min(560px,50vw)", height:"min(560px,50vw)", WebkitMaskImage:"url('/emblem.png')", WebkitMaskSize:"contain", WebkitMaskRepeat:"no-repeat", WebkitMaskPosition:"center", maskImage:"url('/emblem.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center", background:C.emblemGrad, opacity:C.emblemOp, mixBlendMode:C.emblemBlend, animation:"is-drift 14s ease-in-out infinite" }} />
      </div>

      {/* ── VERTICAL SIDEBAR ── */}
      {navVertical && (
        <aside className="lmsbr-desktop-sidebar" style={{ ...sidebarSurface, position:"fixed", left:0, top:0, height:"100vh", width:"268px", display:"flex", flexDirection:"column", overflow:"hidden", borderRight:`1px solid ${C.sidebarBdr}`, boxShadow:C.sidebarShadow, zIndex:50, transition:"background .4s,border-color .4s,background-image .4s" }}>
          {/* Top glow — dark mode only */}
          {isDark && <div style={{ position:"absolute", top:"-6%", left:"50%", width:"340px", height:"300px", transform:"translateX(-50%)", pointerEvents:"none", zIndex:0, background:C.topGlowGrad, animation:"is-glow 7s ease-in-out infinite" }} />}

          {/* Sidebar header */}
          <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center", gap:"12px", padding:"18px", borderBottom:`1px solid ${C.sidebarBdr}` }}>
            <button onClick={() => router.push("/dashboard")} title={t.apps}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"42px", height:"42px", flexShrink:0, borderRadius:"12px", border:`1px solid ${C.btnBdr}`, background:C.btnBg, color:"#c69049", cursor:"pointer", transition:".25s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background=isDark?"rgba(198,144,73,0.12)":"#F3F4F6"; (e.currentTarget as HTMLButtonElement).style.transform="rotate(90deg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background=C.btnBg; (e.currentTarget as HTMLButtonElement).style.transform=""; }}
            ><Icon name="grid" size={19} sw={1.9} /></button>
            <div style={{ display:"flex", alignItems:"center", gap:"11px", minWidth:0 }}>
              <div style={{ width:"38px", height:"38px", flexShrink:0, borderRadius:"11px", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", background:effectiveGrad, boxShadow:`0 8px 18px -8px ${effectiveGlow}` }}>
                <Icon name={M.icon} size={21} sw={1.8} />
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"16px", color:C.txtPrimary, letterSpacing:".04em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{M.name}</div>
                <div style={{ fontSize:"11px", color:C.txtMuted, letterSpacing:".04em" }}>{t.module}</div>
              </div>
            </div>
          </div>

          {/* Middle: emblem centered in space between header and footer */}
          <div style={{ position:"relative", zIndex:1, flex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
            <SidebarEmblem />
            <div style={{ position:"relative", zIndex:1, flex:1, overflowY:"auto", padding:"14px 12px", display:"flex", flexDirection:"column", gap:"3px" }}>
              <MenuItems {...menuProps} />
            </div>
          </div>
          <SidebarBottom />
        </aside>
      )}

      {/* ── HORIZONTAL TOP NAV ── */}
      {navHorizontal && (
        <nav className="lmsbr-desktop-hnav" style={{ position:"fixed", left:0, top:0, width:"100%", zIndex:50, background:C.navBg, borderBottom:`1px solid ${C.navBdr}`, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", boxShadow: isDark ? "none" : C.headerShadow, transition:"background .4s" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"14px", padding:"0 24px", height:"62px" }}>
            <button onClick={() => router.push("/dashboard")} title={t.apps}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"40px", height:"40px", flexShrink:0, borderRadius:"11px", border:`1px solid ${C.btnBdr}`, background:C.btnBg, color:"#c69049", cursor:"pointer", transition:".25s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform="rotate(90deg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform=""; }}
            ><Icon name="grid" size={19} sw={1.9} /></button>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", paddingRight:"8px", borderRight:`1px solid ${C.navBdr}` }}>
              <div style={{ width:"34px", height:"34px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", background:effectiveGrad }}>
                <Icon name={M.icon} size={18} sw={1.8} />
              </div>
              <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"16px", color:C.txtPrimary, letterSpacing:".04em" }}>{M.name}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"3px", flex:1 }}><MenuItems {...menuProps} horizontal /></div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <LangToggle C={C} />
              <ThemeToggleBtn C={C} />
              <NavModeToggle navMode={navMode} setNavMode={setNavModePersisted} C={C} />
              <HeaderProfileMenu
                C={C}
                accent={M.accent}
                isDark={isDark}
                onLogout={logout}
                onProfileClick={openMyProfile}
                profileLabel={t.myProfile}
                signOutLabel={t.signOut}
                signOutConfirmTitle={t.confirmSignOut}
                signOutConfirmMessage={t.confirmSignOutMsg}
                cancelLabel={t.cancelAction}
                compact
              />
            </div>
          </div>
        </nav>
      )}

      {/* ── MOBILE BAR (always mounted; CSS shows ≤859px) ── */}
      <>
          <nav className="lmsbr-mobile-topbar" style={{ position:"fixed", left:0, top:0, width:"100%", height:"58px", zIndex:55, alignItems:"center", justifyContent:"space-between", padding:"0 16px", background:C.navBg, borderBottom:`1px solid ${C.navBdr}`, backdropFilter:"blur(12px)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", minWidth:0 }}>
              <button type="button" onClick={() => router.push("/dashboard")} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"36px", height:"36px", borderRadius:"9px", border:`1px solid ${C.btnBdr}`, background:C.btnBg, color:"#c69049", cursor:"pointer", flexShrink:0 }}><Icon name="grid" size={19} sw={1.9} /></button>
              <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"15px", color:C.txtPrimary, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{M.name}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
              <ThemeToggleBtn C={C} />
              <button type="button" aria-label="Menu" onClick={() => setDrawerOpen(v => !v)} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"38px", height:"38px", borderRadius:"9px", border:`1px solid ${C.btnBdr}`, background:C.btnBg, color:"#c69049", cursor:"pointer" }}>
                <Icon name="menu" size={20} sw={1.9} />
              </button>
            </div>
          </nav>
          <div className="lmsbr-mobile-overlay" onClick={() => setDrawerOpen(false)} style={{ position:"fixed", inset:0, zIndex:58, background:C.drawerOverlay, transition:".35s", opacity: drawerOpen?1:0, pointerEvents: drawerOpen?"auto":"none" }} />
          <aside className="lmsbr-mobile-drawer" style={{ ...sidebarSurface, position:"fixed", top:0, left:0, height:"100vh", width:"min(264px,86vw)", zIndex:59, overflow:"hidden", borderRight:`1px solid ${C.sidebarBdr}`, transition:"transform .4s cubic-bezier(.4,0,.2,1), background .4s", transform: drawerOpen?"translateX(0)":"translateX(-105%)", flexDirection:"column" }}>
            <div style={{ position:"relative", zIndex:1, flex:1, minHeight:0, marginTop:"58px", display:"flex", flexDirection:"column" }}>
              <SidebarEmblem size={220} />
              <div style={{ position:"relative", zIndex:1, flex:1, overflowY:"auto", padding:"12px 12px 18px", display:"flex", flexDirection:"column", gap:"3px" }}>
                <MenuItems {...menuProps} />
              </div>
              <SidebarBottom />
            </div>
          </aside>
      </>

      {/* ── MAIN CONTENT ── */}
      <div className="lmsbr-main-shell" style={{ position:"relative", zIndex:1, transition:"margin .5s cubic-bezier(.4,0,.2,1),padding .5s", marginLeft: isMobile?0:navVertical?"268px":0, paddingTop: isMobile?"58px":navHorizontal?"62px":0, minWidth:0, maxWidth:"100%" }}>

        {/* Sticky sub-header */}
        <header style={{ position:"sticky", top:0, zIndex:30, background:C.headerBg, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:`1px solid ${C.headerBdr}`, boxShadow: C.headerShadow, transition:"background .4s,box-shadow .4s" }}>
          {!isDark && (
            <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", background:`linear-gradient(90deg,transparent,${hexA(M.accent,0.55)} 28%,${M.accent} 50%,${hexA(M.accent,0.55)} 72%,transparent)`, pointerEvents:"none" }} />
          )}
          <div className="lmsbr-workspace-header-inner" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", padding:"0 26px", height: compactModuleChrome ? "48px" : "62px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13.5px", color:C.txtMuted, minWidth:0 }}>
            <span
              style={{
                display:"inline-flex",
                alignItems:"center",
                gap:"7px",
                padding:"5px 10px",
                borderRadius:"8px",
                background: isDark ? hexA(effectiveAccent, 0.1) : hexA(effectiveAccent, 0.08),
                border: `1px solid ${hexA(effectiveAccent, isDark ? 0.22 : 0.18)}`,
                color: isSurveyModule ? effectiveAccent : isDark ? effectiveAccent : "#b45309",
                fontWeight: 600,
                fontSize:"12px",
                letterSpacing:".04em",
                whiteSpace:"nowrap",
              }}
            >
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", background: effectiveAccent, boxShadow: isDark ? `0 0 8px ${effectiveGlow}` : "none" }} />
              {M.name}
            </span>
            <span style={{ display:"flex", color:C.footerTxt }}><Icon name="chevron" size={14} sw={2} /></span>
            <span style={{ color:C.txtPrimary, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{isMyAccountProfile ? t.myProfile : crumb}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div className="lmsbr-header-search" style={{ display:"flex", alignItems:"center", gap:"9px", padding:"8px 14px", borderRadius:"11px", background:C.inputBg, border:`1px solid ${C.inputBdr}`, minWidth:"220px", transition:"border-color .2s, box-shadow .2s", visibility: (isMyAccountProfile || isSuspectProfile || isHubRecordsProfile || isHubGalleryProfile || isDhacdoEventsProfile || isDhacdoDashboardView || isHubAnalyticsView || isDailyReportView || isFaceMatchView || isTrackMapView || isAgentProfileView || isForcesView || isCishReportView || isUCView || isUserControlDashboardView || isUserProfile || isSurveyModule) ? "hidden" : "visible" }}
              onFocusCapture={e => { if (!isDark) (e.currentTarget as HTMLDivElement).style.borderColor = C.inputFocusBdr; }}
              onBlurCapture={e => { if (!isDark) (e.currentTarget as HTMLDivElement).style.borderColor = C.inputBdr; }}
            >
              <span style={{ display:"flex", color:C.txtMuted }}><Icon name="search" size={17} sw={1.8} /></span>
              <input placeholder={isSuspectView ? t.searchSuspects : isHubRecordsView || isHubGalleryView ? t.searchHubRecords : isForcesView ? t.searchForces : isUsersView ? t.searchUsers : t.searchPh} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ border:"none", outline:"none", background:"transparent", color:C.txtPrimary, fontFamily:"var(--font-outfit)", fontSize:"14px", flex:1 }} />
            </div>
            <button style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"40px", height:"40px", borderRadius:"11px", border:`1px solid ${C.inputBdr}`, background: isDark ? C.btnBg : C.inputBg, color:"#c69049", cursor:"pointer", position:"relative", boxShadow: isDark ? "none" : "0 1px 2px rgba(26,54,93,0.04)", transition:"transform .2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform="translateY(-1px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform=""; }}
            >
              <Icon name="bell" size={19} sw={1.8} />
              <span style={{ position:"absolute", top:"9px", right:"10px", width:"7px", height:"7px", borderRadius:"50%", background:"#e0655a", border:`1.5px solid ${C.notifBorder}` }} />
            </button>
            <HeaderProfileMenu
              C={C}
              accent={M.accent}
              isDark={isDark}
              onLogout={logout}
              onProfileClick={openMyProfile}
              profileLabel={t.myProfile}
              signOutLabel={t.signOut}
              signOutConfirmTitle={t.confirmSignOut}
              signOutConfirmMessage={t.confirmSignOutMsg}
              cancelLabel={t.cancelAction}
            />
          </div>
          </div>
        </header>

        <div className="lmsbr-workspace-page" style={{
          padding: compactModuleChrome ? "4px 26px 0" : "28px 26px 48px",
          background: C.pageBg,
          minHeight: compactModuleChrome
            ? "calc(100vh - 48px)"
            : isSurveyModule
              ? undefined
              : "calc(100vh - 62px)",
        }}>
          {(!isSurveyModule || showSurveyPageHeader) && !isHubCompactView && !isDhacdoCompactView && !isAmnigaCompactView && !isBaarisCompactView && !isVisitorsCompactView && !isUserControlCompactView && (
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:"18px", flexWrap:"wrap", animation:"is-fadeUp .5s ease both" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:effectiveAccent, boxShadow: isDark ? `0 0 12px ${effectiveGlow}` : `0 0 0 3px ${hexA(effectiveAccent,0.15)}` }} />
                <span style={{ fontSize:"11.5px", letterSpacing:".18em", textTransform:"uppercase", color: isDark ? effectiveAccent : "#c69049", fontWeight:600 }}>{M.name}</span>
              </div>
              <h1 style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"clamp(24px,3.2vw,34px)", color:C.txtPrimary, margin:"10px 0 0", letterSpacing:".01em" }}>
                {isMyAccountProfile ? t.myProfile : isSuspectOfficerUserProfile ? t.userProfile : isSuspectProfile ? t.suspectProfile : isHubRecordsProfile ? t.hubRecordsTitle : isUserProfile ? t.userProfile : isSuspectView ? t.suspectListTitle : isHubRecordsView ? t.hubRecordsTitle : isForcesView ? t.forcesTitle
                  : isTrackMapView ? t.trackMapTitle
                  : isUserReportsView ? t.userReportsTitle : isDistrictTasksView ? t.districtTasksTitle
                  : isAppUsersView ? t.appUsersTitle
                  : isAppReleaseView ? t.appReleaseTitle
                  : isUsersView ? t.usersTitle : isGroupsView ? t.groupsTitle : isQeybahaView ? t.ucQeybsTitle : isPermissionsView ? t.permissionsTitle : isAgentsView ? t.agentsTitle
                  : isAuditView ? t.auditTitle : isErrorLogsView ? t.errorsTitle : isTrafficView ? t.trafficTitle
                  : isDhacdoQaybahaView ? t.dhacdoQaybahaTitle : isDhacdoNoocaView ? t.dhacdoNoocaTitle : isDhacdoEventsView ? t.dhacdoEventsTitle
                  : isSurveyModule ? crumb
                  : moduleId === "usercontrol" ? t.ucTitle : crumb}
              </h1>
              <p style={{ fontSize:"14px", color:C.txtMuted, margin:"6px 0 0", lineHeight:1.5 }}>
                {isMyAccountProfile ? t.userProfileSub : isSuspectOfficerUserProfile ? t.userProfileSub : isSuspectProfile ? t.suspectProfileSub : isHubRecordsProfile ? t.hubRecordsSub : isUserProfile ? t.userProfileSub : isSuspectView ? t.suspectListSub : isHubRecordsView ? t.hubRecordsSub : isForcesView ? t.forcesSub
                  : isTrackMapView ? t.trackMapSub
                  : isUserReportsView ? t.userReportsSub : isDistrictTasksView ? t.districtTasksSub
                  : isAppUsersView ? t.appUsersSub
                  : isAppReleaseView ? t.appReleaseSub
                  : isUsersView ? t.usersSub : isGroupsView ? t.groupsSub : isQeybahaView ? t.ucQeybsSub : isPermissionsView ? t.permissionsSub : isAgentsView ? t.agentsSub
                  : isAuditView ? t.auditSub : isErrorLogsView ? t.errorsSub : isTrafficView ? t.trafficSub
                  : isDhacdoQaybahaView ? t.dhacdoQaybahaSub : isDhacdoNoocaView ? t.dhacdoNoocaSub : isDhacdoEventsView ? t.dhacdoEventsSub
                  : isSurveyModule ? surveyPageSubtitle
                  : moduleId === "usercontrol" ? t.ucSub : M.tagline}
              </p>
            </div>
            <button
              onClick={() => {
                if (isUsersView && !isUserProfile) openUsersCreateRef.current?.();
                else if (isGroupsView) openGroupsCreateRef.current?.();
                else if (isQeybahaView) openQeybsCreateRef.current?.();
                else if (isAgentsView) openAgentsCreateRef.current?.();
                else if (isSuspectView) openSuspectsCreateRef.current?.();
                else if (isHubRecordsView || isHubDashboardView) openHubRecordsCreateRef.current?.();
                else if (isDhacdoQaybahaView) openDhacdoUtilityCreateRef.current?.();
                else if (isDhacdoNoocaView) openDhacdoRequirementsCreateRef.current?.();
                else if (isDhacdoEventsView) openDhacdoEventsCreateRef.current?.();
                else if (isBaarisWantedView) openWantedCreateRef.current?.();
                else if (isVisitorsListView) openVisitorsCreateRef.current?.();
              }}
              style={{ display: canShowAdd ? "flex" : "none", alignItems:"center", gap:"9px", padding:"11px 18px", borderRadius:"10px", border: isDark ? `1px solid ${hexA(effectiveAccent,0.4)}` : "none", background:effectiveGrad, color:"#fff", fontFamily:"var(--font-outfit)", fontWeight:600, fontSize:"14px", cursor:"pointer", boxShadow: isDark ? `0 12px 28px -12px ${effectiveGlow}` : `0 4px 14px -4px ${hexA(effectiveAccent,0.45)}`, transition:".3s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform=""; }}
            >
              <span style={{ display:"flex" }}><Icon name="plus" size={17} sw={2} /></span>
              {isSuspectView ? t.addSuspect : isHubRecordsView || isHubDashboardView ? t.hubAddRecord : isForcesView ? t.addForce : isUsersView ? t.addUser : isGroupsView ? t.addGroup : isQeybahaView ? t.ucQeybAdd : isAgentsView ? t.addAgent : isDhacdoQaybahaView ? t.dhacdoAddQaybaha : isDhacdoNoocaView ? t.dhacdoAddNooca : isDhacdoEventsView ? t.dhacdoAddEvent : isBaarisWantedView ? (lang === "so" ? "Ku dar Wanted" : "Add Wanted") : isVisitorsListView ? (lang === "so" ? "Booqde Cusub" : "New visitor") : M.action}
            </button>
          </div>
          )}

          {isMyAccountProfile && user ? (
            <UserProfilePage
              userId={user.id}
              onBack={closeMyProfile}
              C={C}
              accent={M.accent}
              isDark={isDark}
              selfView
            />
          ) : isHubDashboardView ? (
            <HubkadhigisDashboardPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              moduleName={M.name}
              moduleTagline={M.tagline}
              onViewAllRecords={() => setActiveMenu("records")}
              onOpenRecord={(id) => {
                setActiveMenu("records");
                setHubRecordProfileId(id);
              }}
              registerAddAction={registerHubRecordsAdd}
            />
          ) : isHubGalleryView ? (
            <HubkadhigisGalleryPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              search={searchQuery}
              moduleName={M.name}
              profileId={hubRecordProfileId}
              setProfileId={setHubRecordProfileId}
            />
          ) : isHubAnalyticsView ? (
            <HubkadhigisAnalyticsPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              moduleName={M.name}
            />
          ) : isHubRecordsView ? (
            <HubkadhigisListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              search={searchQuery}
              profileId={hubRecordProfileId}
              setProfileId={setHubRecordProfileId}
              registerAddAction={registerHubRecordsAdd}
              moduleName={M.name}
              moduleTagline={t.hubRecordsSub}
            />
          ) : isAmnigaDashboardView ? (
            <AmnigaDashboardPage
              C={C}
              accent={effectiveAccent}
              isDark={isDark}
              moduleName={M.name}
              moduleTagline={M.tagline}
            />
          ) : isSuspectView ? (
            <SuspectsListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              search={searchQuery}
              profileId={suspectProfileId}
              setProfileId={setSuspectProfileId}
              persistKey={`lmsbr-suspects-${moduleId}`}
              registerAddAction={registerSuspectsAdd}
              onViewingUserProfile={setSuspectOfficerProfileOpen}
            />
          ) : isDailyReportView ? (
            <AmnigaDailyReportPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              moduleName={M.name}
              onOpenSuspect={(id) => {
                setActiveMenu("suspect");
                setSuspectProfileId(id);
              }}
            />
          ) : isFaceMatchView ? (
            <AmnigaFaceMatchPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              moduleName={M.name}
              onOpenSuspect={(id) => {
                setActiveMenu("suspect");
                setSuspectProfileId(id);
                setOpenSubs((prev) => ({ ...prev, suspects: true }));
              }}
            />
          ) : isTrackMapView ? (
            <AmnigaTrackMapPage
              C={C}
              accent={M.accent}
              isDark={isDark}
            />
          ) : isAgentProfileView ? (
            <AgentProfilePage
              agentId={String(activeAgentProfileId)}
              onBack={() => router.push("/dashboard/amniga")}
              onOpenSuspect={(id) => {
                setActiveMenu("suspect");
                setSuspectProfileId(id);
                setOpenSubs((prev) => ({ ...prev, suspects: true }));
                router.replace("/dashboard/amniga");
              }}
              C={C}
              accent={M.accent}
              isDark={isDark}
            />
          ) : isAppUsersView ? (
            <AmnigaAppUsersPage C={C} accent={M.accent} isDark={isDark} />
          ) : isAppReleaseView ? (
            <AmnigaAppReleasePage C={C} accent={M.accent} isDark={isDark} />
          ) : isUserReportsView ? (
            <AmnigaUserReportsPage C={C} accent={M.accent} isDark={isDark} />
          ) : isDistrictTasksView ? (
            <AmnigaDistrictTasksPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              onOpenSuspect={(id) => {
                setActiveMenu("suspect");
                setSuspectProfileId(id);
              }}
            />
          ) : isForcesView ? (
            <AgentsListPage
              C={C}
              accent={M.accent}
              variant="ciidan"
            />
          ) : isPersonnelDashView ? (
            <PersonnelDashboardPage C={C} accent={effectiveAccent} />
          ) : isAttendanceView ? (
            <AttendanceSessionPage C={C} accent={effectiveAccent} />
          ) : isDistrictMgmtView ? (
            <DistrictManagementPage C={C} accent={effectiveAccent} />
          ) : isPersonnelReportsView ? (
            <PersonnelReportsPage C={C} accent={effectiveAccent} />
          ) : isAgentImportView ? (
            <AgentImportWizardPage C={C} accent={effectiveAccent} />
          ) : isUsersView ? (
            <UsersListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              persistKey={`lmsbr-users-${moduleId}`}
              profileId={userProfileId}
              setProfileId={setUserProfileId}
              registerAddAction={registerUsersAdd}
            />
          ) : isGroupsView ? (
            <GroupsListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              registerAddAction={registerGroupsAdd}
            />
          ) : isQeybahaView ? (
            <QeybahaListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              registerAddAction={registerQeybsAdd}
            />
          ) : isPermissionsView ? (
            <PermissionsListPage C={C} accent={M.accent} />
          ) : isAgentsView ? (
            <AgentsListPage
              C={C}
              accent={M.accent}
              registerAddAction={registerAgentsAdd}
            />
          ) : isAuditView ? (
            <AuditTrailsPage C={C} accent={M.accent} />
          ) : isErrorLogsView ? (
            <ErrorLogsPage C={C} accent={M.accent} />
          ) : isTrafficView ? (
            <APITrafficPage C={C} accent={M.accent} />
          ) : isDhacdoDashboardView ? (
            <DhacdooyinkaDashboardPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              moduleName={M.name}
              moduleTagline={M.tagline}
              onViewAllEvents={() => setActiveMenu("dhacdooyinka")}
              onOpenEvent={(id) => {
                setActiveMenu("dhacdooyinka");
                openDhacdoProfile(id);
              }}
            />
          ) : isDhacdoQaybahaView ? (
            <DhacdooyinkaUtilityListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              registerAddAction={registerDhacdoUtilityAdd}
            />
          ) : isDhacdoNoocaView ? (
            <DhacdooyinkaRequirementsListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              registerAddAction={registerDhacdoRequirementsAdd}
            />
          ) : isDhacdoEventsView ? (
            <DhacdooyinkaListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              search={searchQuery}
              profileId={activeDhacdoProfileId}
              setProfileId={openDhacdoProfile}
              victimId={activeDhacdoVictimId}
              setVictimId={openDhacdoVictim}
              registerAddAction={registerDhacdoEventsAdd}
            />
          ) : isVisitorsDashboardView ? (
            <VisitorsDashboardPage
              accent={effectiveAccent}
              isDark={isDark}
              C={C}
              moduleName={M.name}
              moduleTagline={M.tagline}
              onViewAll={() => setActiveMenu("visitors")}
            />
          ) : isVisitorsListView ? (
            <VisitorsListPage
              accent={effectiveAccent}
              isDark={isDark}
              C={C}
              searchQuery={searchQuery}
              openCreateRef={openVisitorsCreateRef}
            />
          ) : isBaarisDashboardView ? (
            <BaarisDashboardPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              moduleName={M.name}
              moduleTagline={M.tagline}
            />
          ) : isUserControlDashboardView ? (
            <UserControlDashboardPage
              C={C}
              accent={effectiveAccent}
              isDark={isDark}
              moduleName={M.name}
              moduleTagline={M.tagline}
              onNavigate={(menuId) => selectMenu(menuId)}
            />
          ) : isBaarisCitizensView ? (
            <BaarisCitizensListPage C={C} accent={M.accent} isDark={isDark} search={searchQuery} />
          ) : isBaarisWantedView ? (
            <BaarisWantedListPage
              C={C}
              accent={M.accent}
              isDark={isDark}
              registerAddAction={registerWantedAdd}
            />
          ) : isSurveyModule ? (
            <SurveyPageShell C={C} accent={effectiveAccent} isDark={isDark}>
              {isSurveySubmitView ? (
                <SurveySubmitPage
                  key={`submit-${activeSurveyProfileId}`}
                  surveyId={activeSurveyProfileId!}
                  onBack={() => {
                    setSurveySubmitMode(false);
                    router.push(`/dashboard/survey/${activeSurveyProfileId}`);
                  }}
                  onSuccess={() => {
                    setSurveySubmitMode(false);
                    router.push(`/dashboard/survey/${activeSurveyProfileId}`);
                  }}
                />
              ) : isSurveyProfileView ? (
                <SurveyProfilePage
                  key={activeSurveyProfileId}
                  surveyId={activeSurveyProfileId!}
                  C={C}
                  accent={effectiveAccent}
                  isDark={isDark}
                  onBack={() => {
                    setSurveyProfileId(null);
                    router.push("/dashboard/survey");
                  }}
                />
              ) : isSurveyListView ? (
                <SurveysListPage C={C} accent={effectiveAccent} isDark={isDark} />
              ) : isSurveyResponseProfileView ? (
                <SurveyResponseProfilePage
                  key={activeSurveyResponseId}
                  responseId={activeSurveyResponseId!}
                  C={C}
                  accent={effectiveAccent}
                  isDark={isDark}
                  onBack={() => {
                    setSurveyResponseProfileId(null);
                    setActiveMenu(activeMenu === "owners" ? "owners" : "responses");
                    router.push("/dashboard/survey");
                  }}
                />
              ) : isSurveyResponsesView ? (
                <SurveyResponsesPage C={C} accent={effectiveAccent} isDark={isDark} />
              ) : isSurveyOwnersView ? (
                <SurveyOwnersPage C={C} accent={effectiveAccent} isDark={isDark} />
              ) : isSurveyAnalyticsView ? (
                <SurveyAnalyticsPage C={C} accent={effectiveAccent} isDark={isDark} />
              ) : isSurveyRespondentProfileView ? (
                <SurveyRespondentProfilePage
                  key={activeSurveyRespondentKey}
                  respondentKey={activeSurveyRespondentKey!}
                  C={C}
                  accent={effectiveAccent}
                  isDark={isDark}
                  onBack={() => {
                    setSurveyRespondentProfileKey(null);
                    setActiveMenu("settings");
                    router.push("/dashboard/survey");
                  }}
                />
              ) : isSurveySettingsView ? (
                <SurveySettingsPage C={C} accent={effectiveAccent} isDark={isDark} />
              )
                : <SurveyDashboardPage C={C} accent={effectiveAccent} isDark={isDark} />}
            </SurveyPageShell>
          ) : !isSurveyModule && moduleId !== "hub" && moduleId !== "dhacdooyin" && !isAmnigaDashboardView && !isUserControlDashboardView ? (
          <>
          {/* KPI cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:"16px", marginTop:"28px" }}>
            {MEffective.kpis.map((k, i) => (
              <div key={i} style={{ position:"relative", overflow:"hidden", padding:"22px 20px", borderRadius:"14px", background:C.cardBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.cardShadow, animation:`is-fadeUp .5s ease both`, animationDelay:`${0.05+i*0.07}s`, transition:"border-color .25s,box-shadow .25s,transform .25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor=isDark?C.cardBdrHov:"#D1D5DB"; (e.currentTarget as HTMLDivElement).style.boxShadow=isDark?C.cardShadow:`0 1px 2px rgba(0,0,0,0.04),0 8px 20px rgba(0,0,0,0.06)`; (e.currentTarget as HTMLDivElement).style.transform="translateY(-3px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor=C.cardBdr; (e.currentTarget as HTMLDivElement).style.boxShadow=C.cardShadow; (e.currentTarget as HTMLDivElement).style.transform=""; }}
              >
                {!isDark && <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:`linear-gradient(90deg,${MEffective.accent},${hexA(MEffective.accent,0.4)})`, borderRadius:"14px 14px 0 0" }} />}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ width:"46px", height:"46px", borderRadius:"13px", display:"flex", alignItems:"center", justifyContent:"center", background:hexA(MEffective.accent,0.14), color:MEffective.accent, border:`1px solid ${hexA(MEffective.accent,0.25)}` }}>
                    <Icon name={k.icon} size={22} sw={1.8} />
                  </div>
                  <span style={{ fontSize:"12.5px", fontWeight:600, padding:"3px 9px", borderRadius:"20px", background:k.up?(isDark?"rgba(70,192,138,0.14)":"rgba(5,150,105,0.12)"):(isDark?"rgba(224,101,90,0.14)":"rgba(220,38,38,0.1)"), color:k.up?(isDark?"#46c08a":"#059669"):(isDark?"#e0655a":"#dc2626"), border:`1px solid ${k.up?(isDark?"rgba(70,192,138,0.25)":"rgba(5,150,105,0.28)"):(isDark?"rgba(224,101,90,0.25)":"rgba(220,38,38,0.24)")}` }}>{k.delta}</span>
                </div>
                <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:"34px", color:C.txtPrimary, marginTop:"18px", lineHeight:1 }}>{kpiVals[i].toLocaleString()}{k.suffix}</div>
                <div style={{ fontSize:"13px", color:C.txtMuted, marginTop:"8px", letterSpacing:".02em" }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Chart + breakdown */}
          <div className="lmsbr-stack-2" style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:"16px", marginTop:"16px" }}>
            <div style={{ padding:"24px", borderRadius:"14px", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px" }}>
                <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"17px", color:C.txtPrimary }}>{t.activity}</div>
                <div style={{ fontSize:"12px", color:C.txtMuted, letterSpacing:".06em", textTransform:"uppercase" }}>{t.thisWeek}</div>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:"10px", height:"180px" }}>
                {MEffective.bars.map((v, i) => (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", height:"100%", justifyContent:"flex-end" }}>
                    <div style={{ width:"100%", borderRadius:"7px 7px 3px 3px", transformOrigin:"bottom", height:`${Math.round((v/maxBar)*100)}%`, background:`linear-gradient(180deg,${MEffective.accent},${hexA(MEffective.accent,isDark?0.25:0.55)})`, boxShadow:isDark?`0 0 14px ${hexA(MEffective.accent,0.3)}`:`0 2px 8px -2px ${hexA(MEffective.accent,0.35)}`, animation:`is-grow .8s cubic-bezier(.2,.7,.2,1) both`, animationDelay:`${0.1+i*0.06}s` }} />
                    <span style={{ fontSize:"11px", color:C.txtMuted }}>{dayLabels[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:"24px", borderRadius:"14px", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow }}>
              <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"17px", color:C.txtPrimary, marginBottom:"22px" }}>{t.breakdown}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
                {MEffective.breakdown.map((bd, i) => (
                  <div key={i}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"13.5px", marginBottom:"8px" }}>
                      <span style={{ color:C.txtSecondary }}>{bd.label}</span>
                      <span style={{ color:MEffective.accent, fontWeight:600 }}>{bd.pct}%</span>
                    </div>
                    <div style={{ height:"8px", borderRadius:"6px", background:C.barTrack, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:"6px", width:`${bd.pct}%`, background:`linear-gradient(90deg,${hexA(MEffective.accent,0.6)},${MEffective.accent})`, transition:"width 1s cubic-bezier(.2,.7,.2,1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ marginTop:"16px", borderRadius:"14px", overflow:"hidden", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:`1px solid ${C.tableSep}` }}>
              <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"17px", color:C.txtPrimary }}>{t.recent}</div>
              <button style={{ display:"flex", alignItems:"center", gap:"7px", fontFamily:"var(--font-outfit)", fontSize:"13px", color:C.txtAccentHd, background:"transparent", border:"none", cursor:"pointer" }}>
                {t.viewAll}<span style={{ display:"flex" }}><Icon name="arrow" size={14} sw={2.1} /></span>
              </button>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"520px" }}>
                <thead>
                  <tr>
                    {MEffective.table.cols.map((col,i) => (
                      <th key={i} style={{ textAlign:"left", padding:"13px 24px", fontSize:"11.5px", fontWeight:500, letterSpacing:".08em", textTransform:"uppercase", color:C.txtMuted, background:C.tableHead, fontFamily:"var(--font-outfit)" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEffective.table.rows.map((row, i) => (
                    <tr key={i} style={{ borderTop:`1px solid ${C.tableSep}`, transition:".2s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background=C.tableHov; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background="transparent"; }}
                    >
                      <td style={{ padding:"15px 24px", fontSize:"14px", color:C.txtPrimary, fontWeight:500, fontFamily:"var(--font-outfit)" }}>{row[0]}</td>
                      <td style={{ padding:"15px 24px", fontSize:"14px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>{row[1]}</td>
                      <td style={{ padding:"15px 24px", fontSize:"14px", color:C.txtSecondary, fontFamily:"var(--font-outfit)" }}>{row[2]}</td>
                      <td style={{ padding:"15px 24px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:"6px", fontSize:"12.5px", fontWeight:500, padding:"5px 12px", borderRadius:"20px", background:hexA(row[4],0.14), color:row[4], border:`1px solid ${hexA(row[4],0.28)}`, fontFamily:"var(--font-outfit)" }}>{row[3]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
