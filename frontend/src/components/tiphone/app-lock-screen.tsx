"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, ScanFace, ShieldAlert } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import { SecurityStorage } from "@/lib/tiphone/security-storage";
import { authenticateFaceId } from "@/lib/tiphone/webauthn-face";
import { rgba } from "@/lib/tiphone/theme";
import { useTipAuth } from "./auth-provider";
import { useSecurityLock } from "./security-lock-provider";
import { useTipTheme } from "./theme-provider";
import { GoldButton } from "./gold-button";
import { ScreenShell } from "./screen-shell";
import { ShellOverlays } from "./shell-overlays";

const MAX_ATTEMPTS = 3;
const PIN_LEN = 4;

function PinBoxes({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { colors } = useTipTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 220);
      return () => window.clearTimeout(t);
    }
  }, [autoFocus]);

  const boxes = Array.from({ length: PIN_LEN }, (_, i) => value[i] ?? "");

  return (
    <button
      type="button"
      className="relative mx-auto block w-full max-w-[280px]"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="pointer-events-none flex justify-center gap-2.5">
        {boxes.map((d, i) => {
          const active = i === value.length && value.length < PIN_LEN;
          return (
            <span
              key={i}
              className="flex h-14 w-12 items-center justify-center rounded-2xl border-2 text-[22px] font-bold tracking-widest"
              style={{
                borderColor: d
                  ? rgba(colors.goldRgb, 0.55)
                  : active
                    ? rgba(colors.goldRgb, 0.4)
                    : rgba(colors.lineRgb, 0.14),
                background: d ? rgba(colors.goldRgb, 0.1) : rgba(colors.lineRgb, 0.04),
                color: colors.ink0,
                boxShadow: active ? `0 0 0 3px ${rgba(colors.goldRgb, 0.12)}` : undefined,
              }}
            >
              {d ? "•" : ""}
            </span>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, PIN_LEN);
          onChange(next);
          if (next.length === PIN_LEN) onComplete(next);
        }}
        className="absolute inset-0 cursor-text opacity-0"
        aria-label="PIN"
      />
    </button>
  );
}

export function AppLockScreen() {
  const { colors } = useTipTheme();
  const { auth } = useTipAuth();
  const { isLocked, markUnlocked } = useSecurityLock();
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(false);
  const [faceEnabled, setFaceEnabled] = useState(false);
  const autoTried = useRef(false);

  const resetState = useCallback(() => {
    setDigits("");
    setError("");
    setLoading(false);
    setFaceBusy(false);
    setAttempts(0);
    setShake(false);
    autoTried.current = false;
  }, []);

  useEffect(() => {
    if (!isLocked) {
      resetState();
      return;
    }
    setFaceEnabled(SecurityStorage.isBiometricEnabled());
  }, [isLocked, resetState]);

  const runShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 280);
  };

  const tryFaceId = useCallback(async () => {
    if (!SecurityStorage.isBiometricEnabled() || faceBusy || loading) return;
    const credId = SecurityStorage.getBiometricCredentialId();
    if (!credId) return;

    setFaceBusy(true);
    setError("");
    try {
      const result = await authenticateFaceId(credId);
      if (result.ok) {
        markUnlocked();
        return;
      }
      if (result.code !== "cancelled") {
        setError(result.message || so.maareyntaBioFailed);
      }
    } finally {
      setFaceBusy(false);
    }
  }, [faceBusy, loading, markUnlocked]);

  useEffect(() => {
    if (!isLocked || !faceEnabled || autoTried.current) return;
    autoTried.current = true;
    void tryFaceId();
  }, [isLocked, faceEnabled, tryFaceId]);

  const verifyPin = useCallback(
    (pin: string) => {
      if (loading || faceBusy) return;
      setLoading(true);
      const stored = SecurityStorage.getPin();
      if (!stored) {
        setError(so.appLockNoPin);
        setLoading(false);
        return;
      }
      if (pin === stored) {
        markUnlocked();
        setLoading(false);
        return;
      }
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setDigits("");
      setError(
        nextAttempts >= MAX_ATTEMPTS
          ? so.appLockTooMany
          : `${so.appLockWrongPin} (${nextAttempts}/${MAX_ATTEMPTS})`,
      );
      runShake();
      setLoading(false);
    },
    [loading, faceBusy, attempts, markUnlocked],
  );

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      <ScreenShell variant="hero">
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
          <div className="mb-7 text-center">
            <div
              className="mx-auto mb-4 flex h-[88px] w-[88px] items-center justify-center rounded-full p-[3px]"
              style={{
                background: `linear-gradient(135deg, ${colors.gold2}, ${colors.gold}, ${colors.goldDeep})`,
              }}
            >
              <div
                className="flex h-full w-full items-center justify-center overflow-hidden rounded-full text-2xl font-bold"
                style={{ background: colors.bg1, color: colors.gold }}
              >
                IS
              </div>
            </div>
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: colors.ink0 }}>
              Ilaalo <span style={{ color: colors.gold }}>Shacab</span>
            </h1>
            <p
              className="mt-2.5 text-[12px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: colors.gold }}
            >
              {so.appLockTitle}
            </p>
            <p className="mt-1.5 text-[14px]" style={{ color: colors.ink2 }}>
              {auth?.user.email || so.appLockSubtitle}
            </p>
          </div>

          <div className={`relative ${shake ? "animate-[tipShake_280ms_ease-in-out]" : ""}`}>
            <div
              className="overflow-hidden rounded-[22px] border"
              style={{
                background: rgba(colors.surfnavRgb, 0.92),
                borderColor: rgba(colors.goldRgb, 0.18),
              }}
            >
              <div
                className="relative border-b px-5 py-4"
                style={{
                  background: rgba(colors.goldRgb, 0.07),
                  borderColor: rgba(colors.goldRgb, 0.16),
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${colors.gold2}, ${colors.gold}, ${colors.goldDeep})`,
                  }}
                />
                <div className="flex items-center gap-2.5">
                  <Lock size={18} style={{ color: colors.gold }} />
                  <p className="text-[15px] font-semibold" style={{ color: colors.gold }}>
                    {faceEnabled ? so.maareyntaBioPrompt : so.appLockSubtitle}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-5">
                {faceEnabled ? (
                  <div className="mb-4">
                    <GoldButton
                      loading={faceBusy}
                      disabled={loading}
                      onClick={() => {
                        void tryFaceId();
                      }}
                    >
                      <ScanFace size={16} />
                      {so.appLockUseFace}
                    </GoldButton>
                  </div>
                ) : null}

                <PinBoxes
                  value={digits}
                  onChange={(v) => {
                    setDigits(v);
                    setError("");
                  }}
                  onComplete={(pin) => verifyPin(pin)}
                  disabled={loading || faceBusy}
                  autoFocus={!faceEnabled}
                />

                {error ? (
                  <p className="mt-2.5 text-center text-[12.5px]" style={{ color: colors.rose }}>
                    {error}
                  </p>
                ) : null}

                <div className="mt-4">
                  <GoldButton
                    loading={loading}
                    disabled={digits.length !== 4 || faceBusy}
                    onClick={() => verifyPin(digits)}
                  >
                    <Lock size={16} />
                    {so.appLockUnlock}
                  </GoldButton>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 flex items-start gap-2 px-1">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: colors.inkMut }} />
            <p className="text-[12.5px] leading-relaxed" style={{ color: colors.inkMut }}>
              {so.maareyntaSecureNote}
            </p>
          </div>
        </div>

        <style>{`
          @keyframes tipShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }
        `}</style>
      </ScreenShell>
      <ShellOverlays email={auth?.user.email} zIndex={210} />
    </div>
  );
}
