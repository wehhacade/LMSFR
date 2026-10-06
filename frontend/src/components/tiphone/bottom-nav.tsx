"use client";

import { Home, Fingerprint, MessageSquareReply } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import type { BottomNavTab } from "@/lib/tiphone/types";
import { rgba } from "@/lib/tiphone/theme";
import { isBaarisRole } from "@/lib/tiphone/utils";
import { useTipAuth } from "./auth-provider";
import { useTipTheme } from "./theme-provider";

const TABS: { key: BottomNavTab; label: string; Icon: typeof Home }[] = [
  { key: "home", label: so.navHome, Icon: Home },
  { key: "suspects", label: so.navSuspects, Icon: Fingerprint },
  { key: "responses", label: so.navResponses, Icon: MessageSquareReply },
];

export function BottomNav({
  active,
  onSelect,
}: {
  active: BottomNavTab;
  onSelect: (tab: BottomNavTab) => void;
}) {
  const { colors } = useTipTheme();
  const { auth } = useTipAuth();
  const tabs =
    auth && isBaarisRole(auth.roles, auth.permissions)
      ? TABS.filter((tab) => tab.key !== "responses")
      : TABS;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto mx-auto flex h-16 max-w-lg items-center overflow-hidden rounded-3xl border"
        style={{
          background: rgba(colors.surfnavRgb, 0.94),
          borderColor: rgba(colors.lineRgb, 0.08),
          backdropFilter: "blur(16px)",
        }}
      >
        {tabs.map(({ key, label, Icon }) => {
          const isActive = key === active;
          const tint = isActive ? colors.gold : colors.inkMut;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition active:scale-95"
            >
              <span
                className="absolute inset-x-6 top-0 h-[3px] rounded-b-full transition-opacity"
                style={{
                  opacity: isActive ? 1 : 0,
                  background: `linear-gradient(90deg, ${colors.gold2}, ${colors.goldDeep})`,
                }}
              />
              <Icon size={20} style={{ color: tint }} strokeWidth={isActive ? 2.4 : 2} />
              <span className="text-[11px] font-semibold" style={{ color: tint }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
