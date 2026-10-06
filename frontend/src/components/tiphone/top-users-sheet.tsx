"use client";

import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "./theme-provider";
import { ListRowShimmer } from "./shimmer";

const PODIUM = ["#E8B923", "#9AA8BC", "#C97A3A"];

type TopUserRow = { name: string; county: string; s_count: string | number };

export function TopUsersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();
  const [rows, setRows] = useState<TopUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setRows([]);
    TipApi.fetchTopUsers()
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch(() => {
        if (alive) setError(so.leadersLoadError);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl border sm:rounded-3xl"
        style={{
          background: `linear-gradient(180deg, ${colors.bgTop}, ${colors.bg0})`,
          borderColor: rgba(colors.lineRgb, 0.12),
        }}
      >
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: rgba(colors.goldRgb, 0.15) }}>
              <Trophy size={18} style={{ color: colors.gold }} />
            </div>
            <h2 className="text-[16px] font-bold leading-tight" style={{ color: colors.ink0 }}>
              {so.leadersTopUsers}
            </h2>
            <p className="mt-1 text-[12px]" style={{ color: colors.ink2 }}>
              {so.leadersTopUsersSub}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border p-2"
            style={{ borderColor: rgba(colors.lineRgb, 0.12), color: colors.ink1 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {loading ? (
            <ListRowShimmer count={6} />
          ) : error ? (
            <p className="py-16 text-center text-sm" style={{ color: colors.rose }}>
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm" style={{ color: colors.inkMut }}>
              {so.leadersEmpty}
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, idx) => {
                const rank = idx + 1;
                const podium = rank <= 3;
                const tone = PODIUM[rank - 1] ?? colors.gold;
                return (
                  <div
                    key={`${row.name}-${rank}`}
                    className="flex items-center gap-3 rounded-2xl border px-3 py-3"
                    style={{
                      background: podium
                        ? rgba(colors.goldRgb, rank === 1 ? 0.09 : 0.04)
                        : rgba(colors.lineRgb, 0.04),
                      borderColor: podium
                        ? rgba(colors.goldRgb, 0.2)
                        : rgba(colors.lineRgb, 0.09),
                    }}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                      style={{
                        background: podium
                          ? `linear-gradient(135deg, ${tone}, ${tone}99)`
                          : `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})`,
                      }}
                    >
                      {rank === 1 ? <Trophy size={13} /> : rank}
                    </div>
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
                    >
                      {row.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: colors.ink0 }}>
                        {row.name}
                      </p>
                      <p className="truncate text-[11px]" style={{ color: colors.gold }}>
                        {row.county || "Lama Helin"}
                      </p>
                    </div>
                    <div
                      className="shrink-0 rounded-xl border px-2.5 py-1.5 text-center"
                      style={{
                        background: "rgba(42, 120, 78, 0.1)",
                        borderColor: "rgba(42, 120, 78, 0.22)",
                      }}
                    >
                      <p className="text-sm font-bold" style={{ color: colors.green }}>
                        {row.s_count ?? 0}
                      </p>
                      <p className="text-[9px] font-semibold" style={{ color: colors.inkMut }}>
                        S.Count
                      </p>
                    </div>
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
