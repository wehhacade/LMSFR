"use client";

import type { CSSProperties } from "react";
import { useTipTheme } from "./theme-provider";
import { rgba } from "@/lib/tiphone/theme";

export function Shimmer({
  className = "",
  radius = 14,
  style,
}: {
  className?: string;
  radius?: number;
  style?: CSSProperties;
}) {
  const { colors } = useTipTheme();
  return (
    <div
      className={`tip-shimmer relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        background: rgba(colors.lineRgb, 0.07),
        ...style,
      }}
      aria-hidden
    >
      <div
        className="tip-shimmer-beam absolute inset-y-0 w-[55%]"
        style={{
          background: `linear-gradient(90deg, transparent, ${rgba(colors.hiRgb, 0.12)}, ${rgba(colors.goldRgb, 0.09)}, transparent)`,
        }}
      />
    </div>
  );
}

export function SuspectGridShimmer({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[18px]">
          <Shimmer className="aspect-[4/5] w-full" radius={18} />
          <div className="space-y-2 px-1 pt-2.5 pb-1">
            <Shimmer className="h-3.5 w-[88%]" radius={6} />
            <Shimmer className="h-3 w-[55%]" radius={5} />
            <Shimmer className="h-8 w-full" radius={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SuspectListShimmer({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-[18px] p-1">
          <Shimmer className="h-[72px] w-[72px] shrink-0" radius={14} />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <Shimmer className="h-3.5 w-[75%]" radius={6} />
            <Shimmer className="h-3 w-[45%]" radius={5} />
            <Shimmer className="h-3 w-[30%]" radius={5} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedPostShimmer({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-[22px] p-4">
          <div className="flex items-center gap-3">
            <Shimmer className="h-10 w-10 shrink-0" radius={999} />
            <div className="min-w-0 flex-1 space-y-2">
              <Shimmer className="h-3.5 w-[42%]" radius={6} />
              <Shimmer className="h-2.5 w-[28%]" radius={5} />
            </div>
          </div>
          <Shimmer className="h-3 w-full" radius={5} />
          <Shimmer className="h-3 w-[82%]" radius={5} />
          <Shimmer className="aspect-[16/10] w-full" radius={16} />
          <div className="flex gap-3">
            <Shimmer className="h-8 flex-1" radius={10} />
            <Shimmer className="h-8 flex-1" radius={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListRowShimmer({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-2xl border border-transparent p-3.5">
          <Shimmer className="h-3.5 w-[70%]" radius={6} />
          <Shimmer className="h-3 w-full" radius={5} />
          <Shimmer className="h-3 w-[55%]" radius={5} />
        </div>
      ))}
    </div>
  );
}

export function PersonSearchShimmer({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Shimmer className="h-14 w-14 shrink-0" radius={16} />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-3.5 w-[65%]" radius={6} />
            <Shimmer className="h-3 w-[40%]" radius={5} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileBodyShimmer() {
  return (
    <div className="space-y-3 px-1">
      <Shimmer className="mx-auto h-40 w-40" radius={999} />
      <Shimmer className="mx-auto h-4 w-[55%]" radius={6} />
      <Shimmer className="mx-auto h-3 w-[35%]" radius={5} />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-14 w-full" radius={16} />
        ))}
      </div>
    </div>
  );
}

export function InlinePanelShimmer({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Shimmer className="h-10 w-10 shrink-0" radius={12} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Shimmer className="h-3 w-[60%]" radius={5} />
            <Shimmer className="h-2.5 w-[40%]" radius={4} />
          </div>
        </div>
      ))}
    </div>
  );
}
