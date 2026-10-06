import type { ModuleId, MenuItem } from "@/lib/lmsbr/data";

export type NavMode = "vertical" | "horizontal";

export interface ModuleNavSnapshot {
  activeMenu: string;
  searchQuery: string;
  suspectProfileId: number | null;
  userProfileId: string | null;
  openSubs: Record<string, boolean>;
  navMode: NavMode;
}

/** Default tab when opening a module from the launcher (always Bogga Hore / Dashboard). */
export function defaultModuleNav(_moduleId?: ModuleId): ModuleNavSnapshot {
  return {
    activeMenu: "dashboard",
    searchQuery: "",
    suspectProfileId: null,
    userProfileId: null,
    openSubs: {},
    navMode: "vertical",
  };
}

const COOKIE_PREFIX = "lmsbr_nav_";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Global sidebar layout — simple cookie + localStorage (survives refresh & SSR). */
export const NAV_LAYOUT_STORAGE_KEY = "lmsbr-navMode";
export const NAV_LAYOUT_COOKIE = "lmsbr_nav_layout";

export function readNavLayoutFromCookieStore(
  cookieStore: { get: (name: string) => { value: string } | undefined },
  fallback?: NavMode,
): NavMode {
  const v = cookieStore.get(NAV_LAYOUT_COOKIE)?.value;
  if (v === "horizontal" || v === "vertical") return v;
  if (fallback === "horizontal") return "horizontal";
  return "vertical";
}

/** Client: authoritative layout preference (localStorage → layout cookie → module cookie). */
export function readNavLayoutPreference(moduleNavMode?: NavMode): NavMode {
  if (typeof window === "undefined") return moduleNavMode ?? "vertical";

  const ls = localStorage.getItem(NAV_LAYOUT_STORAGE_KEY);
  if (ls === "horizontal" || ls === "vertical") return ls;

  const layoutHit = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NAV_LAYOUT_COOKIE}=`));
  if (layoutHit) {
    const v = decodeURIComponent(layoutHit.slice(NAV_LAYOUT_COOKIE.length + 1));
    if (v === "horizontal" || v === "vertical") return v;
  }

  if (moduleNavMode === "horizontal") return "horizontal";
  return "vertical";
}

/** Sync write — called immediately when the user toggles layout. */
export function persistNavLayoutPreference(navMode: NavMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAV_LAYOUT_STORAGE_KEY, navMode);
  document.cookie = `${NAV_LAYOUT_COOKIE}=${navMode}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function moduleNavCookieName(moduleId: ModuleId): string {
  return `${COOKIE_PREFIX}${moduleId}`;
}

function pickActiveMenu(...candidates: (string | undefined)[]): string {
  const nonDashboard = candidates.find((m) => m && m !== "dashboard");
  return nonDashboard ?? candidates.find(Boolean) ?? "dashboard";
}

/** Merge nav snapshots — later sources win; keep deepest activeMenu (not dashboard). */
export function mergeModuleNav(...sources: Partial<ModuleNavSnapshot>[]): ModuleNavSnapshot {
  const base = defaultModuleNav();
  let merged: ModuleNavSnapshot = { ...base };
  const menuCandidates: string[] = [];

  for (const src of sources) {
    if (!src) continue;
    if (src.activeMenu) menuCandidates.push(src.activeMenu);
    merged = {
      ...merged,
      ...src,
      openSubs: { ...merged.openSubs, ...(src.openSubs ?? {}) },
    };
  }

  merged.activeMenu = pickActiveMenu(...menuCandidates.reverse());
  return merged;
}

export function parseModuleNavCookie(raw: string | undefined): ModuleNavSnapshot {
  if (!raw) return defaultModuleNav();
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ModuleNavSnapshot>;
    return mergeModuleNav(defaultModuleNav(), parsed);
  } catch {
    return defaultModuleNav();
  }
}

/** Client: read nav cookie set by persistModuleNav. */
export function readModuleNavFromDocumentCookie(moduleId: ModuleId): ModuleNavSnapshot {
  if (typeof document === "undefined") return defaultModuleNav();
  const prefix = `${moduleNavCookieName(moduleId)}=`;
  const hit = document.cookie.split(";").find((c) => c.trim().startsWith(prefix));
  const snap = hit
    ? parseModuleNavCookie(hit.trim().slice(prefix.length))
    : defaultModuleNav();
  return { ...snap, navMode: readNavLayoutPreference(snap.navMode) };
}

/** Server: read nav snapshot from cookies (matches client on refresh — no sidebar flash). */
export function readModuleNavFromCookies(
  moduleId: ModuleId,
  cookieStore: { get: (name: string) => { value: string } | undefined },
): ModuleNavSnapshot {
  const snap = parseModuleNavCookie(cookieStore.get(moduleNavCookieName(moduleId))?.value);
  return { ...snap, navMode: readNavLayoutFromCookieStore(cookieStore, snap.navMode) };
}

function legacyKeys(moduleId: ModuleId) {
  return {
    navMode: NAV_LAYOUT_STORAGE_KEY,
    activeMenu: `lmsbr-module-${moduleId}-activeMenu`,
    search: `lmsbr-module-${moduleId}-searchQuery`,
    suspectProfile: `lmsbr-module-${moduleId}-suspectProfileId`,
    userProfile: `lmsbr-module-${moduleId}-userProfileId`,
    openSubs: `lmsbr-module-${moduleId}-openSubs`,
  };
}

/** Client fallback when cookie not yet set (migrates legacy localStorage keys). */
export function readModuleNavFromStorage(moduleId: ModuleId): ModuleNavSnapshot {
  if (typeof window === "undefined") return defaultModuleNav();
  const keys = legacyKeys(moduleId);
  const snap = defaultModuleNav();

  const menu = localStorage.getItem(keys.activeMenu);
  if (menu) snap.activeMenu = menu;

  const search = localStorage.getItem(keys.search);
  if (search) snap.searchQuery = search;

  const suspect = localStorage.getItem(keys.suspectProfile);
  if (suspect) {
    const n = Number(suspect);
    if (Number.isFinite(n) && n > 0) snap.suspectProfileId = n;
  }

  const user = localStorage.getItem(keys.userProfile);
  if (user) snap.userProfileId = user;

  try {
    const rawSubs = localStorage.getItem(keys.openSubs);
    if (rawSubs) {
      const parsed = JSON.parse(rawSubs) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "boolean") snap.openSubs[k] = v;
      }
    }
  } catch {
    /* ignore */
  }

  snap.navMode = readNavLayoutPreference();
  return snap;
}

/** Nav snapshot for opening the signed-in user's LMSBR profile (User Control → Users). */
export const MY_PROFILE_SESSION_KEY = "lmsbr-open-my-profile";

/** Signal the next module workspace to open the signed-in user's profile overlay. */
export function signalOpenMyProfile() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MY_PROFILE_SESSION_KEY, "1");
}

/** Read and clear the one-shot profile-open signal (launcher → module handoff). */
export function consumeOpenMyProfile(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(MY_PROFILE_SESSION_KEY) !== "1") return false;
  sessionStorage.removeItem(MY_PROFILE_SESSION_KEY);
  return true;
}

export function openSubsForActiveMenu(menu: MenuItem[], activeMenu: string, openSubs: Record<string, boolean>) {
  let changed = false;
  const out = { ...openSubs };
  for (const item of menu) {
    if (item.subs?.some((s) => s.id === activeMenu) && !out[item.id]) {
      out[item.id] = true;
      changed = true;
    }
  }
  return changed ? out : openSubs;
}

/** Dual-write: localStorage (legacy keys) + cookie (SSR restore). */
export function persistModuleNav(moduleId: ModuleId, snap: ModuleNavSnapshot) {
  if (typeof window === "undefined") return;
  const keys = legacyKeys(moduleId);

  persistNavLayoutPreference(snap.navMode);
  localStorage.setItem(keys.activeMenu, snap.activeMenu);
  localStorage.setItem(keys.search, snap.searchQuery);

  if (snap.suspectProfileId === null) localStorage.removeItem(keys.suspectProfile);
  else localStorage.setItem(keys.suspectProfile, String(snap.suspectProfileId));

  if (snap.userProfileId === null) localStorage.removeItem(keys.userProfile);
  else localStorage.setItem(keys.userProfile, snap.userProfileId);

  localStorage.setItem(keys.openSubs, JSON.stringify(snap.openSubs));

  const payload = encodeURIComponent(JSON.stringify(snap));
  document.cookie = `${moduleNavCookieName(moduleId)}=${payload}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
