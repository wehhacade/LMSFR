"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Shield, X } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type { StoredAuth } from "@/lib/tiphone/types";
import { displayName, resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "./theme-provider";
import { ProfileBodyShimmer } from "./shimmer";

function pickField(data: Record<string, unknown> | null, keys: string[]): unknown {
  if (!data) return undefined;
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) return data[key];
  }
  return undefined;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SectionLabel({ children }: { children: string }) {
  const { colors } = useTipTheme();
  return (
    <p className="mb-2 text-[10px] font-bold tracking-[0.14em]" style={{ color: colors.inkMut }}>
      {children}
    </p>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { colors } = useTipTheme();
  return (
    <div
      className={`rounded-[18px] border p-3.5 ${className}`}
      style={{
        background: rgba(colors.surfRgb, 0.72),
        borderColor: rgba(colors.lineRgb, 0.1),
      }}
    >
      {children}
    </div>
  );
}

export function OfficerProfileModal({
  open,
  onClose,
  auth,
}: {
  open: boolean;
  onClose: () => void;
  auth: StoredAuth;
}) {
  const { colors } = useTipTheme();
  const [agentData, setAgentData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAgentData(null);
      setFetchError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setFetchError(null);
    TipApi.fetchAgentLogin(auth.user.id)
      .then((data) => {
        if (alive) setAgentData(data);
      })
      .catch(() => {
        if (alive) setFetchError(so.profileLoadError);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, auth.user.id]);

  const name = useMemo(() => {
    if (agentData) {
      const fromAgent =
        (agentData.username as string | undefined) ||
        (agentData.full_name as string | undefined) ||
        (agentData.name as string | undefined);
      if (fromAgent) return fromAgent;
    }
    return displayName(auth.user);
  }, [agentData, auth.user]);

  const email = (agentData?.email as string | undefined) || auth.user.email || null;
  const avatar = resolveTipMediaUrl(
    (agentData?.image as string | undefined) ||
      (agentData?.avatar as string | undefined) ||
      auth.user.avatar,
  );
  const phone =
    (agentData?.phone as string | undefined) ||
    (agentData?.mobile as string | undefined) ||
    auth.user.phone ||
    null;

  const memberSince = useMemo(() => {
    const raw = pickField(agentData, ["date_joined", "created_at", "join_date"]);
    if (typeof raw === "string") {
      try {
        return new Date(raw).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      } catch {
        return "—";
      }
    }
    return "—";
  }, [agentData]);

  const appUsage = useMemo(() => {
    const raw = pickField(agentData, ["app_usage", "usage", "sessions"]);
    if (raw == null) return "—";
    return String(raw);
  }, [agentData]);

  const loginAttempts = useMemo(() => {
    const raw = pickField(agentData, [
      "login_attempts",
      "login_attempt",
      "location_attempts",
      "attempts",
    ]);
    if (raw == null) return "0";
    return String(raw);
  }, [agentData]);

  const userSuspect = useMemo(() => {
    const raw = pickField(agentData, ["user_suspect", "is_user_suspect", "suspect_count"]);
    if (raw == null) return "0";
    return String(raw);
  }, [agentData]);

  const allowPasswordChange = useMemo(() => {
    const allow = pickField(agentData, ["allow_password_change"]);
    if (typeof allow === "boolean") return allow;
    const mustChange = pickField(agentData, ["change_password"]);
    if (typeof mustChange === "boolean") return !mustChange;
    return !auth.forcePasswordChange;
  }, [agentData, auth.forcePasswordChange]);

  const allowPinChange = useMemo(() => {
    const raw = pickField(agentData, ["change_app_pin", "allow_pin_change"]);
    if (typeof raw === "boolean") return raw;
    return Boolean(auth.hasPin);
  }, [agentData, auth.hasPin]);

  if (!open) return null;

  const loginSafe = loginAttempts === "0";
  const suspectClear = userSuspect === "0";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl"
        style={{
          background: colors.bg0,
          borderColor: rgba(colors.lineRgb, 0.12),
        }}
      >
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full" style={{ background: rgba(colors.lineRgb, 0.28) }} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-xl border p-2"
          style={{ borderColor: rgba(colors.lineRgb, 0.14), background: rgba(colors.lineRgb, 0.1), color: colors.ink0 }}
          aria-label="Close"
        >
          <X size={15} />
        </button>

        <div className="overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <div
            className="relative mb-4 overflow-hidden rounded-[22px] border p-4"
            style={{
              background: rgba(colors.surfnavRgb, 0.88),
              borderColor: rgba(colors.lineRgb, 0.12),
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(145deg, ${rgba(colors.goldRgb, 0.14)}, transparent 55%)`,
              }}
            />
            <div className="relative flex items-start gap-3">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] p-0.5"
                style={{ background: `linear-gradient(135deg, ${colors.gold2}, ${colors.goldDeep})` }}
              >
                <div
                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] text-lg font-bold"
                  style={{ background: colors.bg1, color: colors.ink0 }}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials(name)
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[17px] font-bold leading-tight" style={{ color: colors.ink0 }}>
                  {name}
                </p>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold"
                style={{
                  background: "rgba(42, 120, 78, 0.12)",
                  borderColor: "rgba(42, 120, 78, 0.3)",
                  color: colors.green,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.green }} />
                {so.active}
              </span>
            </div>
            {email ? (
              <div
                className="relative mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2.5"
                style={{
                  background: rgba(colors.lineRgb, 0.06),
                  borderColor: rgba(colors.lineRgb, 0.1),
                }}
              >
                <Mail size={14} style={{ color: colors.gold }} />
                <span className="truncate text-sm" style={{ color: colors.ink1 }}>
                  {email}
                </span>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="py-4">
              <ProfileBodyShimmer />
            </div>
          ) : fetchError ? (
            <div className="py-10 text-center">
              <p className="text-sm" style={{ color: colors.rose }}>
                {fetchError}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setFetchError(null);
                  TipApi.fetchAgentLogin(auth.user.id)
                    .then(setAgentData)
                    .catch(() => setFetchError(so.profileLoadError))
                    .finally(() => setLoading(false));
                }}
                className="mt-3 text-sm font-semibold"
                style={{ color: colors.gold }}
              >
                {so.profileRetry}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                <GlassCard>
                  <p className="text-[10px] font-bold" style={{ color: colors.inkMut }}>
                    {so.profileAppUsage}
                  </p>
                  <p className="mt-2 text-xl font-bold" style={{ color: colors.ink0 }}>
                    {appUsage}
                  </p>
                  <p className="text-[11px]" style={{ color: colors.ink2 }}>
                    {so.profileSessions}
                  </p>
                </GlassCard>
                <GlassCard>
                  <p className="text-[10px] font-bold" style={{ color: colors.inkMut }}>
                    {so.profileSince}
                  </p>
                  <p className="mt-2 text-xl font-bold" style={{ color: colors.ink0 }}>
                    {memberSince}
                  </p>
                </GlassCard>
              </div>

              <div>
                <SectionLabel>{so.profileContact}</SectionLabel>
                <GlassCard>
                  <p className="text-[10px] font-bold" style={{ color: colors.inkMut }}>
                    {so.profilePhone}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Phone size={15} style={{ color: colors.gold }} />
                    <span className="text-sm font-semibold" style={{ color: colors.ink0 }}>
                      {phone || "—"}
                    </span>
                  </div>
                </GlassCard>
              </div>

              <div>
                <SectionLabel>{so.profileSecurity}</SectionLabel>
                <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                  <GlassCard>
                    <div className="mb-2 flex items-center justify-between">
                      <Shield size={15} style={{ color: colors.gold }} />
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          background: "rgba(42, 120, 78, 0.14)",
                          color: colors.green,
                        }}
                      >
                        {loginSafe ? so.profileSafe : so.profileWarn}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold" style={{ color: colors.inkMut }}>
                      {so.profileLoginAttempts}
                    </p>
                    <p className="mt-1 text-xl font-bold" style={{ color: colors.ink0 }}>
                      {loginAttempts}
                    </p>
                  </GlassCard>
                  <GlassCard>
                    <div className="mb-2 flex items-center justify-between">
                      <Shield size={15} style={{ color: colors.gold }} />
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{
                          background: "rgba(42, 120, 78, 0.14)",
                          color: colors.green,
                        }}
                      >
                        {suspectClear ? so.profileClear : so.profileFlag}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold" style={{ color: colors.inkMut }}>
                      {so.profileUserSuspect}
                    </p>
                    <p className="mt-1 text-xl font-bold" style={{ color: colors.ink0 }}>
                      {userSuspect}
                    </p>
                  </GlassCard>
                </div>

                <GlassCard className="!p-0">
                  <div
                    className="flex items-center justify-between border-b px-3.5 py-3"
                    style={{ borderColor: rgba(colors.lineRgb, 0.08) }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.ink0 }}>
                        {so.profileChangePassword}
                      </p>
                      <p className="text-[11px]" style={{ color: colors.inkMut }}>
                        {so.profileChangePasswordSub}
                      </p>
                    </div>
                    <input type="checkbox" checked={allowPasswordChange} disabled readOnly className="h-4 w-4 accent-amber-500" />
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.ink0 }}>
                        {so.profileChangePin}
                      </p>
                      <p className="text-[11px]" style={{ color: colors.inkMut }}>
                        {so.profileChangePinSub}
                      </p>
                    </div>
                    <input type="checkbox" checked={allowPinChange} disabled readOnly className="h-4 w-4 accent-amber-500" />
                  </div>
                </GlassCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
