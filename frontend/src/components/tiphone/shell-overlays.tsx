"use client";

import { useTipTheme } from "./theme-provider";
import { rgba } from "@/lib/tiphone/theme";

function describeWedge(radius: number, startDeg: number, sweepDeg: number, center: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const start = toRad(startDeg);
  const end = toRad(startDeg + sweepDeg);
  const x1 = center + radius * Math.cos(start);
  const y1 = center + radius * Math.sin(start);
  const x2 = center + radius * Math.cos(end);
  const y2 = center + radius * Math.sin(end);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

const SPOT = 132;
const R = SPOT / 2;
const PRIMARY = describeWedge(R, -28, 56, R);
const SECONDARY = describeWedge(R - 6, 156, 40, R);

/** Rotating gold beam — above page chrome, below drawers/modals (native ScreenShell z 30). */
export function Spotlight({ vivid = false }: { vivid?: boolean }) {
  const { colors } = useTipTheme();
  const o1 = vivid
    ? { a: 0.07, b: 0.44, c: 0.18 }
    : { a: 0.04, b: 0.26, c: 0.1 };
  const o2 = vivid ? { a: 0.04, b: 0.24 } : { a: 0.02, b: 0.13 };

  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ top: "19%", width: SPOT, height: SPOT, marginTop: -R }}
      aria-hidden
    >
      <div
        className="relative overflow-hidden"
        style={{ width: SPOT, height: SPOT, borderRadius: R }}
      >
        <svg
          className="absolute inset-0 animate-[tipSpin_9s_linear_infinite]"
          width={SPOT}
          height={SPOT}
        >
          <defs>
            <radialGradient id="tipSpotPrimary" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors.gold} stopOpacity={o1.a} />
              <stop offset="38%" stopColor={colors.gold} stopOpacity={o1.b} />
              <stop offset="68%" stopColor={colors.gold} stopOpacity={o1.c} />
              <stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
            </radialGradient>
          </defs>
          <path d={PRIMARY} fill="url(#tipSpotPrimary)" />
        </svg>
        <svg
          className="absolute inset-0 animate-[tipSpinRev_13s_linear_infinite]"
          width={SPOT}
          height={SPOT}
        >
          <defs>
            <radialGradient id="tipSpotSecondary" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors.gold} stopOpacity={o2.a} />
              <stop offset="42%" stopColor={colors.gold} stopOpacity={o2.b} />
              <stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
            </radialGradient>
          </defs>
          <path d={SECONDARY} fill="url(#tipSpotSecondary)" />
        </svg>
        <div
          className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full animate-[tipBreathe_6.4s_ease-in-out_infinite]"
          style={{ background: rgba(colors.goldRgb, vivid ? 0.75 : 0.55) }}
        />
      </div>
    </div>
  );
}

/** Diagonal email watermark — native EmailWatermark parity. */
export function EmailWatermark({ email }: { email: string }) {
  const { colors } = useTipTheme();
  if (!email.trim()) return null;
  const len = Math.max(email.length, 8);
  const fontSize = Math.min(
    72,
    Math.max(44, (typeof window !== "undefined" ? window.innerWidth : 390) / (len * 0.32)),
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="flex h-full items-center justify-center">
        <p
          className="whitespace-nowrap text-center font-bold tracking-[0.12em]"
          style={{
            color: rgba(colors.hiRgb, 0.065),
            fontSize,
            transform: "rotate(-42deg) scaleX(1.12)",
            textShadow: `0 1px 6px ${rgba(colors.goldRgb, 0.08)}`,
            width: "108%",
          }}
        >
          {email}
        </p>
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${rgba(colors.scrimRgb, 0.14)}, transparent 42%, ${rgba(colors.scrimRgb, 0.16)})`,
        }}
      />
    </div>
  );
}

/**
 * Fixed overlay layer — sits above page content + bottom nav (z-50), below drawer/modals.
 * Native RN keeps watermark/spotlight above in-shell content because z-index is scoped;
 * PWA fixed UI escapes stacking, so this uses viewport-fixed z-[55].
 */
export function ShellOverlays({
  email,
  zIndex = 55,
  disableSpotlight = false,
}: {
  email?: string | null;
  zIndex?: number;
  disableSpotlight?: boolean;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex }}
      aria-hidden
    >
      {email?.trim() ? <EmailWatermark email={email} /> : null}
      {!disableSpotlight ? <Spotlight /> : null}
      <style>{`
        @keyframes tipSpin { to { transform: rotate(360deg); } }
        @keyframes tipSpinRev { to { transform: rotate(-360deg); } }
        @keyframes tipBreathe {
          0%, 100% { opacity: 0.28; }
          50% { opacity: 0.36; }
        }
      `}</style>
    </div>
  );
}
