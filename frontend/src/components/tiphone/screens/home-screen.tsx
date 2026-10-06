"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanLine, Search, Trash2, Phone, User } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { StoredAuth, SuspectListRow } from "@/lib/tiphone/types";
import { canStartBroadcast, canUseIsgaarsiin, looksLikePhoneQuery, digitsOnly } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { HomeAppBar } from "../app-bar";
import { BottomNav } from "../bottom-nav";
import { PersonCard } from "../person-card";
import { TipToast } from "../toast";
import { GoldButton } from "../gold-button";
import { PersonSearchShimmer } from "../shimmer";
import { WalkieCallOverlay } from "../walkie-call-overlay";
import { NearbyAgentsSheet } from "../nearby-agents-sheet";
import { FaceMatchSheet } from "../face-match-sheet";
import { BroadcastOverlay } from "../broadcast-overlay";
import { listNearbyAgents, LocationError, type NearbyAgentRow } from "@/lib/tiphone/nearest-agent";
import type { CountyRow, ManagedUserRow } from "@/lib/tiphone/types";
import { PttApi, type BroadcastStartPayload } from "@/lib/tiphone/ptt-api";

const RECENT_KEY = "tiphone_recent_searches";

type Recent = { q: string; type: "name" | "phone"; at: number };

function wantedWebAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([180, 90, 260]);
  }
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
  } catch {
    // Browsers may block sound even after a search gesture; vibration still works when supported.
  }
}

function loadRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(item: Recent) {
  const prev = loadRecent().filter((r) => r.q !== item.q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...prev].slice(0, 12)));
}

export function HomeScreen({
  auth,
  onOpenDrawer,
  onTab,
  onOpenProfile,
  onRegister,
  onExistingCase,
  onNotices,
}: {
  auth: StoredAuth;
  onOpenDrawer: () => void;
  onTab: (t: "home" | "suspects" | "responses") => void;
  onOpenProfile: (s: SuspectListRow) => void;
  onRegister: (phone?: string) => void;
  onExistingCase: (s: SuspectListRow) => void;
  onNotices: () => void;
}) {
  const { colors } = useTipTheme();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<SuspectListRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [recent, setRecent] = useState<Recent[]>([]);
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);
  const [foundOpen, setFoundOpen] = useState(false);
  const [walkiePeer, setWalkiePeer] = useState<ManagedUserRow | null>(null);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyAgents, setNearbyAgents] = useState<NearbyAgentRow[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [counties, setCounties] = useState<CountyRow[]>([]);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastSession, setBroadcastSession] = useState<BroadcastStartPayload | null>(null);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const canBroadcast = canStartBroadcast(auth.roles, auth.permissions);

  useEffect(() => {
    setRecent(loadRecent());
    TipApi.fetchNotices()
      .then((rows) => {
        setUnreadNotices(
          rows.filter((row) => String(row.status ?? "0") === "0" || row.status == null).length,
        );
      })
      .catch(() => {});
    TipApi.fetchCounties().then(setCounties).catch(() => {});
  }, []);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      setLoading(true);
      setMatches(null);
      setMessage("");
      try {
        if (looksLikePhoneQuery(q)) {
          const phone = digitsOnly(q);
          saveRecent({ q: phone, type: "phone", at: Date.now() });
          setRecent(loadRecent());
          const [res, wanted] = await Promise.all([
            TipApi.lookupByPhone(phone),
            TipApi.fetchWantedList({ search: phone, pageSize: 5 }),
          ]);
          const wantedHits = wanted.filter(
            (w) => digitsOnly(w.tnumber || "") === phone || (w.tnumber || "").includes(phone),
          );
          const merged = [...wantedHits, ...res.matches];
          if (merged.some((row) => row.source === "wanted")) wantedWebAlert();
          setMatches(merged);
          setMessage(
            merged.length
              ? res.message || so.foundTitle
              : so.notFoundTitle,
          );
          if (merged.length) setFoundOpen(true);
          else if (!res.found) {
            setToast({
              kind: "info",
              title: so.notFoundTitle,
              message: "Ma jiro tuhmane. Waad diiwaangelin kartaa.",
            });
          }
        } else {
          saveRecent({ q, type: "name", at: Date.now() });
          setRecent(loadRecent());
          const [res, wanted] = await Promise.all([
            TipApi.fetchSuspectList({
              userId: auth.user.id,
              searchQuery: q,
              page: 1,
            }),
            TipApi.fetchWantedList({ search: q, pageSize: 10 }),
          ]);
          const merged = [...wanted, ...res.rows];
          if (merged.some((row) => row.source === "wanted")) wantedWebAlert();
          setMatches(merged);
          setMessage(merged.length ? `${merged.length} natiijo` : so.suspectsEmpty);
          if (merged.length === 1) setFoundOpen(true);
        }
      } catch {
        setToast({ kind: "error", title: so.errorGeneric });
      } finally {
        setLoading(false);
      }
    },
    [auth.user.id],
  );

  const primary = matches?.[0];

  const loadNearbyAgents = useCallback(async () => {
    setNearbyLoading(true);
    try {
      const agents = await listNearbyAgents(Number(auth.user.id));
      setNearbyAgents(agents);
      if (agents.length === 0) {
        setToast({ kind: "info", title: so.pttNoAgent, message: so.isgaarsiinEmptySub });
      }
    } catch (err) {
      setNearbyOpen(false);
      if (err instanceof LocationError) {
        if (err.code === "denied") {
          setToast({
            kind: "error",
            title: so.pttLocationDenied,
            message: so.pttLocationDeniedMsg,
          });
        } else if (err.code === "insecure") {
          setToast({
            kind: "error",
            title: so.pttLocationInsecure,
            message: so.pttLocationInsecureMsg,
          });
        } else if (err.code === "timeout") {
          setToast({
            kind: "error",
            title: so.pttLocationTimeout,
            message: so.pttLocationTimeoutMsg,
          });
        } else {
          setToast({
            kind: "error",
            title: so.pttNoLocation,
            message: so.pttLocationDeniedMsg,
          });
        }
        return;
      }
      setToast({ kind: "error", title: so.pttFailed });
    } finally {
      setNearbyLoading(false);
    }
  }, [auth.user.id]);

  const openNearbySheet = useCallback(() => {
    if (walkiePeer) return;
    setNearbyOpen(true);
    setNearbyAgents([]);
    void loadNearbyAgents();
  }, [loadNearbyAgents, walkiePeer]);

  const onTalkAgent = useCallback((agent: NearbyAgentRow) => {
    setNearbyOpen(false);
    setWalkiePeer(agent);
  }, []);

  const onBroadcast = useCallback(async (countyId: number) => {
    setBroadcastBusy(true);
    try {
      const started = await PttApi.broadcastStart(countyId);
      setNearbyOpen(false);
      setBroadcastSession(started);
    } catch (err) {
      setToast({
        kind: "error",
        title: "Broadcast way fashilantay",
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBroadcastBusy(false);
    }
  }, []);

  return (
    <div className="flex min-h-dvh flex-col pb-24">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
      <HomeAppBar
        onMenu={onOpenDrawer}
        showPhone={canUseIsgaarsiin(auth.roles, auth.permissions)}
        unreadNotices={unreadNotices}
        onAlerts={onNotices}
        onPhone={openNearbySheet}
      />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-5">
        <h2 className="mb-2 text-[28px] font-bold leading-tight tracking-tight">
          Find anyone, <span style={{ color: colors.gold }}>safely</span>.
        </h2>
        <p className="mb-5 text-sm" style={{ color: colors.inkMut }}>
          {so.searchHint}
        </p>

        <div
          className="mb-6 flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          style={{
            background: rgba(colors.surfRgb, 0.92),
            borderColor: focused ? rgba(colors.goldRgb, 0.45) : rgba(colors.lineRgb, 0.12),
          }}
        >
          <Search size={20} style={{ color: focused ? colors.gold : colors.inkMut }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch(query);
            }}
            placeholder={so.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none"
            style={{ color: colors.ink0 }}
          />
          <button
            type="button"
            onClick={() => setFaceOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})`,
              color: colors.onGold,
            }}
            aria-label="Scan"
          >
            <ScanLine size={18} />
          </button>
        </div>

        {loading ? (
          <PersonSearchShimmer count={5} />
        ) : matches ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.ink3 }}>
              {message}
            </p>
            {matches.length === 0 ? (
              <div
                className="space-y-3 rounded-2xl border p-5 text-center"
                style={{ borderColor: rgba(colors.lineRgb, 0.1) }}
              >
                <p style={{ color: colors.inkMut }}>{so.notFoundTitle}</p>
                <GoldButton
                  onClick={() =>
                    onRegister(looksLikePhoneQuery(query) ? digitsOnly(query) : undefined)
                  }
                >
                  {so.registerNew}
                </GoldButton>
              </div>
            ) : (
              matches.map((m) => (
                <PersonCard key={m.id} person={m} onClick={() => onOpenProfile(m)} />
              ))
            )}
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.ink3 }}>
                {so.recentSearches}
              </p>
              {recent.length ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs"
                  style={{ color: colors.inkMut }}
                  onClick={() => {
                    localStorage.removeItem(RECENT_KEY);
                    setRecent([]);
                  }}
                >
                  <Trash2 size={12} /> {so.clear}
                </button>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: colors.ink3 }}>
                {so.homeRecentEmpty}
              </p>
            ) : (
              <div className="space-y-2">
                {recent.map((r) => (
                  <button
                    key={`${r.q}-${r.at}`}
                    type="button"
                    onClick={() => {
                      setQuery(r.q);
                      runSearch(r.q);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                    style={{ background: rgba(colors.surfRgb, 0.5) }}
                  >
                    {r.type === "phone" ? (
                      <Phone size={14} style={{ color: colors.gold }} />
                    ) : (
                      <User size={14} style={{ color: colors.gold }} />
                    )}
                    <span className="text-sm">{r.q}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {foundOpen && primary ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-3xl border p-5 shadow-2xl"
            style={{
              background: colors.bg1,
              borderColor: rgba(colors.goldRgb, 0.25),
            }}
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
              {so.foundTitle}
            </p>
            <PersonCard person={primary} />
            <div className="mt-4 grid gap-2">
              <GoldButton
                onClick={() => {
                  setFoundOpen(false);
                  onOpenProfile(primary);
                }}
              >
                {so.viewProfile}
              </GoldButton>
              {primary.source !== "wanted" && primary.source !== "baaris" ? (
                <button
                  type="button"
                  onClick={() => {
                    setFoundOpen(false);
                    onExistingCase(primary);
                  }}
                  className="rounded-2xl border py-3 text-sm font-semibold"
                  style={{ borderColor: rgba(colors.lineRgb, 0.15), color: colors.ink0 }}
                >
                  {so.addCase}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setFoundOpen(false)}
                className="py-2 text-sm"
                style={{ color: colors.inkMut }}
              >
                {so.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nearbyOpen ? (
        <NearbyAgentsSheet
          agents={nearbyAgents}
          loading={nearbyLoading}
          canBroadcast={canBroadcast}
          counties={counties}
          broadcastBusy={broadcastBusy}
          onRefresh={() => void loadNearbyAgents()}
          onTalk={onTalkAgent}
          onBroadcast={(countyId) => void onBroadcast(countyId)}
          onClose={() => setNearbyOpen(false)}
        />
      ) : null}

      {walkiePeer ? (
        <WalkieCallOverlay peer={walkiePeer} onClose={() => setWalkiePeer(null)} />
      ) : null}

      {broadcastSession ? (
        <BroadcastOverlay
          session={broadcastSession}
          asHost
          onClose={() => setBroadcastSession(null)}
        />
      ) : null}

      <FaceMatchSheet
        open={faceOpen}
        onClose={() => setFaceOpen(false)}
        onOpenProfile={(row) => {
          setFaceOpen(false);
          onOpenProfile(row);
        }}
      />

      <BottomNav active="home" onSelect={onTab} />
    </div>
  );
}
