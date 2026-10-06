"use client";

import { Phone, Radio, RefreshCw, X } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import { formatDistanceLabel, type NearbyAgentRow } from "@/lib/tiphone/nearest-agent";
import { rgba } from "@/lib/tiphone/theme";
import type { CountyRow } from "@/lib/tiphone/types";
import { useTipTheme } from "./theme-provider";

type NearbyAgentsSheetProps = {
  agents: NearbyAgentRow[];
  loading: boolean;
  canBroadcast?: boolean;
  counties?: CountyRow[];
  broadcastBusy?: boolean;
  onRefresh: () => void;
  onTalk: (agent: NearbyAgentRow) => void;
  onBroadcast?: (countyId: number) => void;
  onClose: () => void;
};

export function NearbyAgentsSheet({
  agents,
  loading,
  canBroadcast,
  counties = [],
  broadcastBusy,
  onRefresh,
  onTalk,
  onBroadcast,
  onClose,
}: NearbyAgentsSheetProps) {
  const { colors } = useTipTheme();

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border shadow-2xl sm:rounded-3xl"
        style={{
          background: colors.bg1,
          borderColor: rgba(colors.goldRgb, 0.28),
        }}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3.5" style={{ borderColor: rgba(colors.lineRgb, 0.1) }}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
              Isgaarsiinta Degmo
            </p>
            <h3 className="truncate text-lg font-bold" style={{ color: colors.ink0 }}>
              {so.isgaarsiinNearbyTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{
              borderColor: rgba(colors.lineRgb, 0.12),
              color: colors.gold,
              opacity: loading ? 0.5 : 1,
            }}
            aria-label={so.isgaarsiinRefresh}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{ borderColor: rgba(colors.lineRgb, 0.12), color: colors.ink1 }}
            aria-label={so.cancel}
          >
            <X size={18} />
          </button>
        </div>

        <p className="px-4 pt-3 text-xs leading-relaxed" style={{ color: colors.inkMut }}>
          {so.isgaarsiinHintProximity} BLE background Nearby lama taageero browser-ka.
        </p>

        {canBroadcast ? (
          <div className="px-4 pt-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
              Broadcast LiveKit
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {counties.slice(0, 12).map((county) => (
                <button
                  key={county.id}
                  type="button"
                  disabled={broadcastBusy}
                  onClick={() => onBroadcast?.(county.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={{
                    borderColor: rgba(colors.goldRgb, 0.35),
                    background: rgba(colors.goldRgb, 0.12),
                    color: colors.gold,
                  }}
                >
                  <Radio size={12} /> {county.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading && agents.length === 0 ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[72px] animate-pulse rounded-2xl"
                  style={{ background: rgba(colors.surfRgb, 0.55) }}
                />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="py-10 text-center">
              <p className="mb-1 font-semibold" style={{ color: colors.ink0 }}>
                {so.pttNoAgent}
              </p>
              <p className="text-sm" style={{ color: colors.inkMut }}>
                {so.isgaarsiinEmptySub}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pb-2">
              {agents.map((agent) => {
                const dist = formatDistanceLabel(agent.distanceKm);
                const canTalk = agent.is_active;
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-2xl border px-3.5 py-3"
                    style={{
                      background: rgba(colors.surfnavRgb, 0.72),
                      borderColor: agent.isClosest
                        ? rgba(colors.goldRgb, 0.45)
                        : rgba(colors.lineRgb, 0.12),
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold" style={{ color: colors.ink0 }}>
                          {agent.username || so.isgaarsiinUnknown}
                        </p>
                        {agent.isClosest ? (
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              background: rgba(colors.goldRgb, 0.18),
                              color: colors.gold,
                            }}
                          >
                            {so.isgaarsiinClosest}
                          </span>
                        ) : null}
                      </div>
                      {agent.phone ? (
                        <p className="truncate text-sm" style={{ color: colors.gold }}>
                          {agent.phone}
                        </p>
                      ) : null}
                      <p className="truncate text-xs" style={{ color: colors.ink2 }}>
                        {agent.county || so.isgaarsiinNoCounty}
                        {dist ? ` · ${dist}` : ""}
                        {!agent.is_active ? ` · ${so.isgaarsiinInactive}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canTalk}
                      onClick={() => onTalk(agent)}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold"
                      style={{
                        background: canTalk ? rgba(colors.goldRgb, 0.2) : rgba(colors.lineRgb, 0.06),
                        borderColor: canTalk ? rgba(colors.goldRgb, 0.45) : rgba(colors.lineRgb, 0.12),
                        color: canTalk ? colors.gold : colors.inkMut,
                        opacity: canTalk ? 1 : 0.45,
                      }}
                    >
                      <Phone size={15} />
                      {so.nearbyTalk}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
