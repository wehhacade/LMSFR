"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { DamiinListRow } from "@/lib/tiphone/types";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { PersonSearchShimmer } from "../shimmer";

export function DamiinadaScreen({
  onBack,
  onMenu,
  onOpenDetail,
}: {
  onBack: () => void;
  onMenu: () => void;
  onOpenDetail: (damiin: DamiinListRow) => void;
}) {
  const { colors } = useTipTheme();
  const [rows, setRows] = useState<DamiinListRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1, append = false) => {
    setLoading(true);
    try {
      const res = await TipApi.fetchDamiinList({ page: p, searchQuery: query });
      setRows((prev) => (append ? [...prev, ...res.rows] : res.rows));
      setPage(res.currentPage);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenAppBar title={so.damiinTitle} onBack={onBack} onMenu={onMenu} />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <div
          className="mb-4 flex items-center gap-2 rounded-xl border px-3"
          style={{
            background: rgba(colors.surfRgb, 0.8),
            borderColor: rgba(colors.lineRgb, 0.12),
          }}
        >
          <Search size={16} style={{ color: colors.inkMut }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="Raadi damiin…"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
            style={{ color: colors.ink0 }}
          />
        </div>

        {loading && rows.length === 0 ? (
          <PersonSearchShimmer count={6} />
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: colors.inkMut }}>
            Damiin lama helin
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((d) => {
              const photo = resolveTipMediaUrl(d.picture || d.photo);
              return (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => onOpenDetail(d)}
                  className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
                  style={{
                    background: rgba(colors.surfRgb, 0.7),
                    borderColor: rgba(colors.lineRgb, 0.1),
                  }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl text-sm font-bold"
                    style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      String(d.name || "?").slice(0, 1)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{d.name}</p>
                    <p className="truncate text-xs" style={{ color: colors.inkMut }}>
                      {[d.phone || d.tnumber, d.degmada].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="ml-auto text-lg" style={{ color: colors.gold }}>›</span>
                </button>
              );
            })}
            {page < totalPages ? (
              <button
                type="button"
                onClick={() => load(page + 1, true)}
                className="w-full py-3 text-sm font-semibold"
                style={{ color: colors.gold }}
              >
                {so.loadMore}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
