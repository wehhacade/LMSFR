"use client";

import { useTipTheme } from "./theme-provider";
import { brandHoney, rgba } from "@/lib/tiphone/theme";

function PatternStripes({ opacity }: { opacity: number }) {
  const { colors } = useTipTheme();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute left-[-20%] right-[-20%] top-[30%] h-px origin-center -rotate-[12deg]"
        style={{ background: rgba(colors.goldRgb, opacity * 0.6) }}
      />
      <div
        className="absolute left-[-20%] right-[-20%] top-[62%] h-px origin-center rotate-[8deg]"
        style={{ background: rgba(colors.goldRgb, opacity * 0.4) }}
      />
    </div>
  );
}

function Medallions() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/tiphone/pattern.svg"
        alt=""
        className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
        style={{ width: 260, height: 260, filter: "sepia(1) saturate(3) hue-rotate(5deg)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/tiphone/pattern.svg"
        alt=""
        className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-[0.08]"
        style={{ width: 520, height: 520, filter: "sepia(1) saturate(3) hue-rotate(5deg)" }}
      />
    </div>
  );
}

/** Background shell — gradients, stripes, medallions. Overlays via ShellOverlays. */
export function ScreenShell({
  children,
  variant = "default",
  forceWarm = false,
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "hero" | "home";
  forceWarm?: boolean;
  className?: string;
}) {
  const { colors: themeColors } = useTipTheme();
  const colors = forceWarm ? brandHoney : themeColors;
  const isHome = variant === "home";
  const isHero = variant === "hero";
  const stripeOp = isHome ? 0.02 : isHero ? 0.05 : 0.04;

  const gradient = isHome
    ? `linear-gradient(180deg, ${colors.bgTop} 0%, ${colors.bg0} 62%, ${colors.bg1} 100%)`
    : isHero
      ? `linear-gradient(180deg, ${colors.bgTop} 0%, ${colors.bg1} 50%, ${colors.bg0} 100%)`
      : `linear-gradient(180deg, ${colors.bgTop} 0%, ${colors.bg1} 45%, ${colors.bg0} 100%)`;

  return (
    <div
      className={`tiphone-shell relative min-h-dvh overflow-hidden ${className}`}
      style={{
        background: gradient,
        color: colors.ink0,
        fontFamily: "var(--font-poppins), Poppins, sans-serif",
      }}
    >
      {isHome ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${rgba(colors.goldRgb, 0.055)}, transparent 40%)`,
          }}
          aria-hidden
        />
      ) : null}

      <PatternStripes opacity={stripeOp} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute animate-[tipDrift_22s_ease-in-out_infinite]"
          style={{
            top: "-4%",
            left: "42%",
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: rgba(colors.goldRgb, isHome ? 0.03 : 0.04),
            opacity: 0.36,
          }}
        />
        <div
          className="absolute animate-[tipDriftB_27s_ease-in-out_infinite]"
          style={{
            bottom: "6%",
            left: "-6%",
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: rgba(colors.goldRgb, 0.034),
            opacity: 0.32,
          }}
        />
      </div>

      <Medallions />

      <div
        className="relative flex min-h-dvh flex-col"
        style={{
          paddingTop: "max(12px, calc(env(safe-area-inset-top, 0px) + 10px))",
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes tipDrift {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(12px); }
        }
        @keyframes tipDriftB {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-14px); }
        }
      `}</style>
    </div>
  );
}
