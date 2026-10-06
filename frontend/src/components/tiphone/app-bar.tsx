"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Bell, Menu, Phone } from "lucide-react";
import { useTipTheme } from "./theme-provider";
import { ThemeSelector } from "./theme-selector";
import { rgba } from "@/lib/tiphone/theme";

/** Floating frosted shell — matches mobile AppBarCard / BottomNav language. */
export function AppBarCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { colors } = useTipTheme();
  return (
    <div className={`mx-4 ${className}`}>
      <div
        className="relative flex h-16 items-center overflow-hidden rounded-3xl border px-[18px] shadow-[0_12px_18px_rgba(0,0,0,0.4)]"
        style={{
          background: rgba(colors.surfnavRgb, 0.94),
          borderColor: rgba(colors.lineRgb, 0.08),
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[45%]"
          style={{
            background: `linear-gradient(180deg, ${rgba(colors.goldRgb, 0.07)}, transparent)`,
          }}
        />
        <div className="relative z-[1] flex w-full items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

export function AppBarIconButton({
  onClick,
  children,
  label,
  className = "",
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const { colors } = useTipTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border ${className}`}
      style={{
        background: rgba(colors.lineRgb, 0.05),
        borderColor: rgba(colors.lineRgb, 0.1),
        color: colors.ink1,
      }}
    >
      {children}
    </button>
  );
}

/** Home: ThemeSelector LEFT · chips RIGHT (menu last). No avatar/title. */
export function HomeAppBar({
  onMenu,
  onAlerts,
  showPhone,
  onPhone,
  unreadNotices = 0,
}: {
  onMenu: () => void;
  onAlerts?: () => void;
  showPhone?: boolean;
  onPhone?: () => void;
  unreadNotices?: number;
}) {
  const { colors } = useTipTheme();
  return (
    <AppBarCard className="mb-2">
      <div className="flex min-w-0 flex-1 items-center">
        <ThemeSelector compact />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showPhone ? (
          <AppBarIconButton onClick={() => onPhone?.()} label="Isgaarsiinta">
            <Phone size={18} />
          </AppBarIconButton>
        ) : null}
        <div className="relative">
          <AppBarIconButton onClick={() => onAlerts?.()} label="Ogeysiisyo">
            <Bell size={18} />
          </AppBarIconButton>
          {unreadNotices > 0 ? (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full"
              style={{ background: "#e87b6b" }}
            />
          ) : null}
        </div>
        <AppBarIconButton onClick={onMenu} label="Open menu">
          <Menu size={18} />
        </AppBarIconButton>
      </div>
    </AppBarCard>
  );
}

/** Secondary: Back LEFT · title center · optional right + Menu RIGHT. */
export function ScreenAppBar({
  title,
  kicker,
  onBack,
  onMenu,
  right,
  showBack = true,
}: {
  title: ReactNode;
  kicker?: string;
  onBack?: () => void;
  onMenu?: () => void;
  right?: ReactNode;
  showBack?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <AppBarCard className="mb-2">
      {showBack && onBack ? (
        <AppBarIconButton onClick={onBack} label="Go back">
          <ArrowLeft size={18} style={{ color: colors.ink0 }} />
        </AppBarIconButton>
      ) : (
        <div className="w-10 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {kicker ? (
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: colors.ink3 }}>
            {kicker}
          </p>
        ) : null}
        <div className="truncate text-[15px] font-bold leading-tight">{title}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        {onMenu ? (
          <AppBarIconButton onClick={onMenu} label="Open menu">
            <Menu size={18} />
          </AppBarIconButton>
        ) : null}
      </div>
    </AppBarCard>
  );
}
