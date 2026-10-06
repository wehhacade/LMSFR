"use client";

import { useEffect, useMemo, useState } from "react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { NoticeRow } from "@/lib/tiphone/types";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { ListRowShimmer } from "../shimmer";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isUnread(row: NoticeRow) {
  return String(row.status ?? "0") === "0";
}

export function NoticesScreen({
  onBack,
  onMenu,
}: {
  onBack: () => void;
  onMenu: () => void;
}) {
  const { colors } = useTipTheme();
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");

  const load = async (filter = dateFilter) => {
    setLoading(true);
    setError("");
    try {
      setRows(await TipApi.fetchNotices(filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ogeysiisyada lama soo rarin.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenAppBar title={so.noticesTitle} onBack={onBack} onMenu={onMenu} />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <div className="mb-4 flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              const next = e.target.value;
              setDateFilter(next);
              void load(next);
            }}
            className="flex-1 rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: rgba(colors.lineRgb, 0.12), color: colors.ink0 }}
          />
          <button
            type="button"
            onClick={() => {
              const today = todayIso();
              setDateFilter(today);
              void load(today);
            }}
            className="rounded-xl border px-3 py-2.5 text-xs font-semibold"
            style={{ borderColor: rgba(colors.goldRgb, 0.35), color: colors.gold }}
          >
            Maanta
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFilter("");
              void load("");
            }}
            className="rounded-xl border px-3 py-2.5 text-xs font-semibold"
            style={{ borderColor: rgba(colors.lineRgb, 0.12), color: colors.ink1 }}
          >
            Dhamaan
          </button>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.ink3 }}>
          {unreadCount > 0 ? `${unreadCount} aan la akhriyin` : "Dhammaan waa la akhriyey"}
        </p>

        {loading ? (
          <ListRowShimmer count={5} />
        ) : error ? (
          <p className="py-16 text-center text-sm" style={{ color: colors.rose }}>
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: colors.inkMut }}>
            Ogeysiis lama helin
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((n, i) => {
              const unread = isUnread(n);
              return (
                <button
                  key={n.tobic_id ?? n.id ?? i}
                  type="button"
                  onClick={() => {
                    const id = n.tobic_id ?? n.id;
                    if (!id) return;
                    TipApi.markNoticeRead(Number(id))
                      .then(() => {
                        setRows((prev) =>
                          prev.map((row) =>
                            (row.tobic_id ?? row.id) === id ? { ...row, status: 1 } : row,
                          ),
                        );
                      })
                      .catch(() => {});
                  }}
                  className="w-full rounded-2xl border p-4 text-left"
                  style={{
                    background: unread ? rgba(colors.goldRgb, 0.1) : rgba(colors.surfRgb, 0.7),
                    borderColor: unread ? rgba(colors.goldRgb, 0.35) : rgba(colors.lineRgb, 0.1),
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{n.title || "Ogeysiis"}</p>
                    {unread ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: rgba(colors.goldRgb, 0.18), color: colors.gold }}
                      >
                        Cusub
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: colors.ink2 }}>
                    {n.message || n.body || ""}
                  </p>
                  {n.created_at ? (
                    <p className="mt-2 text-[11px]" style={{ color: colors.ink3 }}>
                      {n.created_at}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
