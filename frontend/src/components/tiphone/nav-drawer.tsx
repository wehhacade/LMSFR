"use client";

import {
  Building2,
  ClipboardList,
  Fingerprint,
  LogOut,
  Megaphone,
  Settings2,
  X,
} from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import { rgba } from "@/lib/tiphone/theme";
import {
  canShowDrawerRoute,
  displayName,
  resolvePrimaryRoleLabel,
  resolveTipMediaUrl,
  type DrawerRouteId,
} from "@/lib/tiphone/utils";
import type { StoredAuth, TipPhoneScreen } from "@/lib/tiphone/types";
import { useTipTheme } from "./theme-provider";
import { ThemeSelector } from "./theme-selector";

const ITEMS: { id: DrawerRouteId; label: string; Icon: typeof Building2; screen: TipPhoneScreen }[] = [
  { id: "qmadaxda", label: so.drawerQMadaxda, Icon: Building2, screen: "leaders" },
  { id: "damiinada", label: so.drawerDamiinada, Icon: Fingerprint, screen: "damiinada" },
  { id: "ogeysiiska", label: so.drawerOgeysiiska, Icon: Megaphone, screen: "notices" },
  { id: "baaris", label: so.drawerBaaris, Icon: ClipboardList, screen: "baaris" },
  { id: "maareynta", label: so.drawerMaareynta, Icon: Settings2, screen: "maareynta" },
];

/** Opens from the RIGHT — matches mobile NavDrawer. */
export function NavDrawer({
  open,
  onClose,
  auth,
  activeScreen,
  onNavigate,
  onSignOut,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  auth: StoredAuth;
  activeScreen?: TipPhoneScreen;
  onNavigate: (screen: TipPhoneScreen) => void;
  onSignOut: () => void;
  onOpenProfile?: () => void;
}) {
  const { colors } = useTipTheme();
  const avatar = resolveTipMediaUrl(auth.user.avatar);
  const name = displayName(auth.user);
  const visible = ITEMS.filter((i) =>
    canShowDrawerRoute(i.id, auth.roles, auth.permissions),
  );
  const role = resolvePrimaryRoleLabel(auth.roles, auth.permissions);

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/55 transition-opacity duration-[88ms] ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[70] flex w-[min(76vw,268px)] flex-col overflow-hidden rounded-l-3xl border-l shadow-[-8px_0_24px_rgba(0,0,0,0.35)] transition-transform duration-[88ms] ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{
          background: `linear-gradient(180deg, ${colors.bgTop}, ${colors.bg0})`,
          borderColor: rgba(colors.lineRgb, 0.1),
        }}
      >
        {/* Ambient + pattern */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/tiphone/pattern.svg"
            alt=""
            className="absolute left-1/2 top-1/3 -translate-x-1/2 opacity-25"
            style={{ width: "112%", height: "auto", filter: "sepia(1) saturate(3)" }}
          />
          <div
            className="absolute left-1/2 top-[19%] h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: `radial-gradient(circle, ${rgba(colors.goldRgb, 0.22)} 0%, transparent 70%)`,
            }}
          />
        </div>

        <div className="relative z-[1] flex items-start justify-between px-4 pb-3 pt-[max(1.1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => {
              onOpenProfile?.();
              onClose();
            }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-2.5 text-left transition active:scale-[0.99]"
            style={{
              background: rgba(colors.surfRgb, 0.55),
              borderColor: rgba(colors.goldRgb, 0.22),
            }}
          >
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-base font-bold ring-2"
              style={{
                background: rgba(colors.goldRgb, 0.15),
                color: colors.gold,
                boxShadow: `0 0 0 2px ${rgba(colors.goldRgb, 0.35)}`,
              }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-[11px]" style={{ color: colors.inkMut }}>
                {auth.user.email}
              </p>
              {role ? (
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: rgba(colors.goldRgb, 0.15), color: colors.gold }}
                >
                  {role}
                </span>
              ) : null}
              <p className="mt-1.5 text-[11px] font-semibold" style={{ color: colors.gold }}>
                {so.drawerViewProfile}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 mt-1 rounded-xl p-1.5"
            style={{ color: colors.inkMut }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="relative z-[1] flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {visible.map(({ id, label, Icon, screen }) => {
            const active = activeScreen === screen;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onNavigate(screen);
                  onClose();
                }}
                className="relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium"
                style={{
                  background: active ? rgba(colors.goldRgb, 0.13) : "transparent",
                  border: active ? `1px solid ${rgba(colors.goldRgb, 0.38)}` : "1px solid transparent",
                  color: active ? colors.gold : colors.ink1,
                }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-[13px]"
                  style={{
                    background: active ? rgba(colors.goldRgb, 0.1) : rgba(colors.lineRgb, 0.05),
                  }}
                >
                  <Icon size={18} style={{ color: active ? colors.gold : colors.inkMut }} />
                </span>
                {label}
                {active ? (
                  <span
                    className="absolute bottom-2 right-0 top-2 w-[3px] rounded-l-full"
                    style={{
                      background: `linear-gradient(180deg, ${colors.gold2}, ${colors.goldDeep})`,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="relative z-[1] space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <p className="text-[10px] font-bold tracking-[0.14em]" style={{ color: colors.ink3 }}>
            {so.drawerAppearance}
          </p>
          <ThemeSelector />
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold"
            style={{
              borderColor: rgba(colors.roseRgb, 0.35),
              color: colors.rose,
              background: rgba(colors.roseRgb, 0.08),
            }}
          >
            <LogOut size={16} />
            {so.drawerSignOut}
          </button>
          <p className="text-center text-[10px]" style={{ color: colors.ink3 }}>
            {so.version}
          </p>
        </div>
      </aside>
    </>
  );
}
