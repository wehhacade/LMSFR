"use client";

import { useTipTheme } from "./theme-provider";
import { rgba } from "@/lib/tiphone/theme";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import type { SuspectListRow } from "@/lib/tiphone/types";
import { so } from "@/lib/tiphone/i18n";

export function PersonCard({
  person,
  onClick,
}: {
  person: SuspectListRow;
  onClick?: () => void;
}) {
  const { colors } = useTipTheme();
  const photo = resolveTipMediaUrl(person.photo);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99]"
      style={{
        background: rgba(colors.surfRgb, 0.75),
        borderColor: rgba(colors.lineRgb, 0.1),
      }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold"
        style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          (person.name || "?").slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: colors.ink0 }}>
          {person.name || "—"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {person.source === "baaris" || person.source === "amniga" || person.source === "wanted" ? (
            <span
              className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background:
                  person.source === "wanted"
                    ? rgba("224, 101, 90", 0.18)
                    : person.source === "baaris"
                      ? rgba("63, 208, 181", 0.18)
                      : rgba(colors.goldRgb, 0.18),
                color:
                  person.source === "wanted"
                    ? "#e0655a"
                    : person.source === "baaris"
                      ? "#3fd0b5"
                      : colors.gold,
              }}
            >
              {person.source === "wanted"
                ? "Wanted"
                : person.source === "baaris"
                  ? "Baaris"
                  : "Amniga"}
            </span>
          ) : null}
          <p className="truncate text-xs" style={{ color: colors.inkMut }}>
            {[person.tnumber, person.degmada, person.N_tuhunka].filter(Boolean).join(" · ") ||
              so.noPhoto}
          </p>
        </div>
        {person.registered_by ? (
          <p className="mt-0.5 text-[10px]" style={{ color: colors.ink3 }}>
            {person.registered_by}
            {person.created_ago ? ` · ${person.created_ago}` : ""}
          </p>
        ) : person.created_ago ? (
          <p className="mt-0.5 text-[10px]" style={{ color: colors.ink3 }}>
            {person.created_ago}
          </p>
        ) : null}
      </div>
      {person.match_score != null ? (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: rgba(colors.goldRgb, 0.18), color: colors.gold }}
        >
          {Math.round(person.match_score * 100)}%
        </span>
      ) : null}
    </button>
  );
}
