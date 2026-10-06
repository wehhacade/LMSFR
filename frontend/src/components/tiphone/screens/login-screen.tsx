"use client";

import { useState } from "react";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import { AuthError } from "@/lib/tiphone/types";
import { rgba } from "@/lib/tiphone/theme";
import { useTipAuth } from "../auth-provider";
import { useTipTheme } from "../theme-provider";
import { FloatingInput } from "../floating-input";
import { GoldButton } from "../gold-button";
import { ScreenShell } from "../screen-shell";
import { TipToast } from "../toast";
import { TypingWelcome } from "../typing-welcome";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useTipAuth();
  const { colors } = useTipTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [toast, setToast] = useState<{
    kind: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = so.loginErrorUser;
    if (!password) next.password = so.loginErrorPass;
    if (next.email || next.password) {
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await login({ username: email.trim(), password });
      setToast({ kind: "success", title: so.loginSuccess, message: so.loginSuccessMsg });
      setTimeout(onSuccess, 400);
    } catch (err) {
      if (err instanceof AuthError && err.code === "INVALID_CREDENTIALS") {
        setErrors({ password: so.loginInvalidCredentials });
        setToast({ kind: "error", title: so.loginFailed, message: so.loginInvalidCredentials });
      } else {
        const msg = err instanceof Error ? err.message : so.errorGeneric;
        setToast({ kind: "error", title: so.loginFailed, message: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell variant="hero">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-[34px] text-center">
          <h1
            className="mb-[22px] text-2xl font-bold tracking-[-0.35px]"
            style={{ color: colors.ink0 }}
          >
            Ilaalo{" "}
            <span className="font-serif italic font-normal" style={{ color: colors.gold }}>
              Shacab
            </span>
          </h1>

          <TypingWelcome
            phrases={[so.loginWelcome, so.loginWelcomeEn]}
            style={{ color: colors.gold }}
            cursorColor={colors.gold}
          />

          <p
            className="mx-auto max-w-[320px] text-[32px] font-bold leading-[38px] tracking-[-0.6px]"
            style={{ color: colors.ink0 }}
          >
            {so.loginHeading}{" "}
            <span className="font-serif italic font-normal" style={{ color: colors.gold }}>
              {so.loginHeadingEm}
            </span>
            <br />
            {so.loginHeadingEnd}
          </p>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute inset-x-3 -bottom-2 top-3 rounded-[30px] opacity-45"
            style={{
              background: rgba(colors.lineRgb, 0.06),
              boxShadow: `0 24px 48px ${rgba(colors.scrimRgb, 0.35)}`,
            }}
            aria-hidden
          />

          <form
            onSubmit={submit}
            className="relative overflow-hidden rounded-[28px] border"
            style={{
              background: rgba(colors.surfnavRgb, 0.92),
              borderColor: rgba(colors.goldRgb, 0.18),
            }}
          >
            <div
              className="relative overflow-hidden border-b px-6 pb-5 pt-6"
              style={{
                background: rgba(colors.goldRgb, 0.07),
                borderColor: rgba(colors.goldRgb, 0.16),
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[5px]"
                style={{
                  background: `linear-gradient(90deg, ${colors.gold2}, ${colors.gold}, ${colors.goldDeep})`,
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-[5px] h-16"
                style={{
                  background: `linear-gradient(180deg, ${rgba(colors.goldRgb, 0.22)}, ${rgba(colors.goldRgb, 0.08)}, transparent)`,
                }}
                aria-hidden
              />
              <div className="relative">
                <p className="text-base font-bold" style={{ color: colors.gold }}>
                  {so.loginSubmit}
                </p>
                <p className="mt-1 text-xs" style={{ color: colors.ink2 }}>
                  Geli xogtaada si aad u gasho App-ka
                </p>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <FloatingInput
                label={so.loginEmail}
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setErrors((e) => ({ ...e, email: undefined }));
                }}
                error={errors.email}
                autoComplete="username"
                icon={<Mail size={17} style={{ color: colors.gold }} />}
              />
              <FloatingInput
                type="password"
                label={so.loginPassword}
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setErrors((e) => ({ ...e, password: undefined }));
                }}
                error={errors.password}
                autoComplete="current-password"
                icon={<Lock size={17} style={{ color: colors.gold }} />}
              />
              <GoldButton type="submit" loading={loading} className="mt-2">
                {loading ? "Waa la xaqiijinayaa…" : so.loginSubmit}
                {!loading ? <ArrowRight size={16} /> : null}
              </GoldButton>
            </div>
          </form>
        </div>
      </div>
    </ScreenShell>
  );
}
