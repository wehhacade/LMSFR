"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  KeyRound,
  RotateCcw,
  ScanFace,
  Shield,
  Users,
  X,
} from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import { SecurityStorage } from "@/lib/tiphone/security-storage";
import type { StoredAuth } from "@/lib/tiphone/types";
import { canManageUsers, canResetElevatedPin } from "@/lib/tiphone/utils";
import { rgba } from "@/lib/tiphone/theme";
import { canUsePlatformBiometric, registerFaceId } from "@/lib/tiphone/webauthn-face";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { FloatingInput } from "../floating-input";
import { GoldButton } from "../gold-button";
import { TipToast } from "../toast";
import { useSwipeBackHandler } from "../ios-swipe-back";

type PinFlow = null | "create" | "disable" | "change-old" | "change-new";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTipTheme();
  return (
    <section className="mb-5">
      <p className="mb-2 px-1 text-[10px] font-bold tracking-[0.14em]" style={{ color: colors.ink3 }}>
        {title}
      </p>
      <div
        className="overflow-hidden rounded-[18px] border"
        style={{
          background: rgba(colors.surfnavRgb, 0.72),
          borderColor: rgba(colors.lineRgb, 0.1),
        }}
      >
        {children}
      </div>
    </section>
  );
}

function NavRow({
  icon,
  title,
  subtitle,
  accent = "gold",
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: "gold" | "violet" | "rose";
  onClick: () => void;
}) {
  const { colors } = useTipTheme();
  const tint =
    accent === "violet" ? "#5B6FD6" : accent === "rose" ? colors.rose : colors.gold;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b px-3.5 py-3.5 text-left last:border-b-0"
      style={{ borderColor: rgba(colors.lineRgb, 0.08) }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
        style={{ background: `${tint}22`, color: tint }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px]" style={{ color: colors.inkMut }}>
          {subtitle}
        </p>
      </div>
      <ChevronRight size={16} style={{ color: colors.ink3 }} />
    </button>
  );
}

function SwitchRow({
  icon,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTipTheme();
  return (
    <div
      className="flex items-center gap-3 border-b px-3.5 py-3.5 last:border-b-0"
      style={{ borderColor: rgba(colors.lineRgb, 0.08) }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]"
        style={{ background: "rgba(91,111,214,0.15)", color: "#5B6FD6" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px]" style={{ color: colors.inkMut }}>
          {subtitle}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition"
        style={{ background: checked ? "#5B6FD6" : rgba(colors.lineRgb, 0.2) }}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

function PinCodeSheet({
  open,
  title,
  message,
  confirmLabel = so.maareyntaSavePin,
  verifyPin,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** When set, entered PIN must match before onConfirm. */
  verifyPin?: string | null;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useTipTheme();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!/^\d{4}$/.test(pin)) {
      setError(so.maareyntaCreatePinMsg);
      return;
    }
    if (verifyPin != null && pin !== verifyPin) {
      setError(so.appLockWrongCurrent);
      setPin("");
      return;
    }
    onConfirm(pin);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/55" onClick={onCancel} aria-label="Close" />
      <div
        className="relative w-full max-w-md rounded-t-[24px] border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-[24px]"
        style={{
          background: rgba(colors.surfRgb, 0.98),
          borderColor: rgba(colors.lineRgb, 0.12),
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-bold" style={{ color: colors.ink0 }}>
              {title}
            </p>
            {message ? (
              <p className="mt-1 text-[12px]" style={{ color: colors.inkMut }}>
                {message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border p-2"
            style={{ borderColor: rgba(colors.lineRgb, 0.12), color: colors.ink1 }}
          >
            <X size={16} />
          </button>
        </div>
        <FloatingInput
          label="PIN (4)"
          value={pin}
          onChange={(v) => {
            setPin(v.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          inputMode="numeric"
          error={error || undefined}
          autoFocus
        />
        <div className="mt-3">
          <GoldButton onClick={submit} disabled={pin.length !== 4}>
            {confirmLabel}
          </GoldButton>
        </div>
      </div>
    </div>
  );
}

export function MaareyntaScreen({
  auth,
  onBack,
  onMenu,
  onUserManagement,
}: {
  auth: StoredAuth;
  onBack: () => void;
  onMenu: () => void;
  onUserManagement: () => void;
}) {
  const { colors } = useTipTheme();
  const canOpenUserManagement = canManageUsers(auth.roles, auth.permissions);
  const canResetPin = canResetElevatedPin(auth.roles, auth.permissions);
  const [panel, setPanel] = useState<"main" | "password">("main");
  const [pinLock, setPinLock] = useState(false);
  const [faceId, setFaceId] = useState(false);
  const [faceAvailable, setFaceAvailable] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [pinFlow, setPinFlow] = useState<PinFlow>(null);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    setSavedPin(SecurityStorage.getPin());
    setPinLock(SecurityStorage.isPinLockEnabled() && Boolean(SecurityStorage.getPin()));
    setFaceId(SecurityStorage.isBiometricEnabled());
    canUsePlatformBiometric().then(setFaceAvailable);
  }, []);

  const swipeBack = useCallback(() => {
    if (pinFlow) {
      setPinFlow(null);
      return;
    }
    if (panel !== "main") {
      setPanel("main");
      return;
    }
    onBack();
  }, [panel, onBack, pinFlow]);

  useSwipeBackHandler(swipeBack);

  async function submitPassword() {
    if (!oldPw) {
      setToast({ kind: "error", title: so.maareyntaOldPassRequired });
      return;
    }
    if (!newPw || newPw.length < 8) {
      setToast({ kind: "error", title: so.maareyntaPassShort });
      return;
    }
    if (newPw !== confirmPw) {
      setToast({ kind: "error", title: so.maareyntaPassMismatch });
      return;
    }
    setLoading(true);
    try {
      await TipApi.changePassword(oldPw, newPw);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setPanel("main");
      setToast({ kind: "success", title: so.maareyntaPassSuccess });
    } catch (err) {
      setToast({
        kind: "error",
        title: so.maareyntaPassFailed,
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  const handlePinLockToggle = (next: boolean) => {
    if (next) {
      if (!savedPin) {
        setPinFlow("create");
        return;
      }
      SecurityStorage.setPinLockEnabled(true);
      setPinLock(true);
      return;
    }
    setPinFlow("disable");
  };

  const finishPinCreate = (pin: string) => {
    SecurityStorage.setPin(pin);
    SecurityStorage.setPinLockEnabled(true);
    TipApi.setPin(pin, auth.user.id).catch(() => {});
    setSavedPin(pin);
    setPinLock(true);
    setPinFlow(null);
    setToast({ kind: "success", title: so.maareyntaPinSaved });
  };

  const finishPinDisable = () => {
    SecurityStorage.setPinLockEnabled(false);
    SecurityStorage.setBiometricEnabled(false);
    setPinLock(false);
    setFaceId(false);
    setPinFlow(null);
  };

  const handleFaceIdToggle = async (next: boolean) => {
    if (bioBusy) return;
    if (!next) {
      SecurityStorage.setBiometricEnabled(false);
      setFaceId(false);
      setToast({ kind: "success", title: so.maareyntaBioDisabled });
      return;
    }
    if (!pinLock || !savedPin) {
      setToast({ kind: "info", title: so.maareyntaBioNeedPin });
      return;
    }
    if (!faceAvailable) {
      setToast({
        kind: "info",
        title: so.maareyntaBioUnavailable,
        message:
          typeof window !== "undefined" && !window.isSecureContext
            ? so.maareyntaBioHttps
            : undefined,
      });
      return;
    }

    setBioBusy(true);
    try {
      const result = await registerFaceId({
        userId: auth.user.id,
        userName: auth.user.email || `agent-${auth.user.id}`,
      });
      if (!result.ok) {
        setToast({
          kind: "error",
          title: result.message || so.maareyntaBioFailed,
          message: result.code === "insecure" ? so.maareyntaBioHttps : undefined,
        });
        return;
      }
      if (!result.credentialId) {
        setToast({ kind: "error", title: so.maareyntaBioFailed });
        return;
      }
      SecurityStorage.setBiometricEnabled(true, result.credentialId);
      setFaceId(true);
      setToast({ kind: "success", title: so.maareyntaBioEnabled });
    } finally {
      setBioBusy(false);
    }
  };

  const finishChangeNew = (pin: string) => {
    SecurityStorage.setPin(pin);
    setSavedPin(pin);
    setPinFlow(null);
    TipApi.setPin(pin, auth.user.id).catch(() => {});
    setToast({ kind: "success", title: so.maareyntaPinChanged });
  };

  function resetPin() {
    if (!confirm(so.maareyntaResetPinConfirm)) return;
    SecurityStorage.setPin("0000");
    SecurityStorage.setPinLockEnabled(true);
    setSavedPin("0000");
    setPinLock(true);
    setToast({ kind: "success", title: so.maareyntaPinResetDone });
  }

  if (panel === "password") {
    return (
      <div className="flex min-h-dvh flex-col">
        {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
        <ScreenAppBar title={so.maareyntaChangePassword} onBack={() => setPanel("main")} onMenu={onMenu} />
        <div className="mx-auto w-full max-w-lg space-y-3 px-[18px] py-4">
          <p className="text-xs" style={{ color: colors.inkMut }}>
            {so.maareyntaPassRules}
          </p>
          <FloatingInput type="password" label={so.maareyntaOldPassword} value={oldPw} onChange={setOldPw} />
          <FloatingInput type="password" label={so.maareyntaNewPassword} value={newPw} onChange={setNewPw} />
          <FloatingInput type="password" label={so.maareyntaConfirmPassword} value={confirmPw} onChange={setConfirmPw} />
          <GoldButton loading={loading} onClick={submitPassword}>
            {so.maareyntaSubmitPassword}
          </GoldButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
      <ScreenAppBar title={so.maareyntaTitle} onBack={onBack} onMenu={onMenu} />
      <div className="mx-auto w-full max-w-lg flex-1 px-[18px] py-4 pb-10">
        <p className="mb-4 text-sm" style={{ color: colors.inkMut }}>
          {so.maareyntaSubtitle}
        </p>

        <SettingsSection title={so.maareyntaSecurity}>
          {canOpenUserManagement ? (
            <NavRow
              icon={<Users size={18} />}
              title={so.maareyntaUserMgmt}
              subtitle={so.maareyntaUserMgmtSub}
              accent="violet"
              onClick={onUserManagement}
            />
          ) : null}
          <NavRow
            icon={<KeyRound size={18} />}
            title={so.maareyntaChangePassword}
            subtitle={so.maareyntaChangePasswordSub}
            onClick={() => setPanel("password")}
          />
          <NavRow
            icon={<Shield size={18} />}
            title={so.maareyntaChangePin}
            subtitle={so.maareyntaChangePinSub}
            accent="violet"
            onClick={() => setPinFlow(savedPin ? "change-old" : "create")}
          />
          {canResetPin ? (
            <NavRow
              icon={<RotateCcw size={18} />}
              title={so.maareyntaResetPin}
              subtitle={so.maareyntaResetPinSub}
              accent="rose"
              onClick={resetPin}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection title={so.maareyntaLogin}>
          <SwitchRow
            icon={<ScanFace size={18} />}
            title={so.maareyntaFaceId}
            subtitle={so.maareyntaBioSub}
            checked={faceId}
            onChange={(v) => {
              void handleFaceIdToggle(v);
            }}
          />
          <SwitchRow
            icon={<Shield size={18} />}
            title={so.maareyntaPinLock}
            subtitle={so.maareyntaPinLockSub}
            checked={pinLock}
            onChange={handlePinLockToggle}
          />
        </SettingsSection>

        <p className="flex items-start gap-2 px-1 text-[11px]" style={{ color: colors.ink3 }}>
          <Shield size={14} className="mt-0.5 shrink-0" style={{ color: colors.gold }} />
          {so.maareyntaSecureNote}
        </p>
      </div>

      <PinCodeSheet
        open={pinFlow === "create"}
        title={so.maareyntaCreatePin}
        message={so.maareyntaCreatePinMsg}
        confirmLabel={so.maareyntaSavePin}
        onConfirm={finishPinCreate}
        onCancel={() => setPinFlow(null)}
      />
      <PinCodeSheet
        open={pinFlow === "disable"}
        title={so.maareyntaDisablePin}
        message={so.maareyntaDisablePinMsg}
        verifyPin={savedPin}
        confirmLabel={so.maareyntaSavePin}
        onConfirm={() => finishPinDisable()}
        onCancel={() => setPinFlow(null)}
      />
      <PinCodeSheet
        open={pinFlow === "change-old"}
        title={so.maareyntaOldPin}
        verifyPin={savedPin}
        confirmLabel={so.maareyntaSavePin}
        onConfirm={() => setPinFlow("change-new")}
        onCancel={() => setPinFlow(null)}
      />
      <PinCodeSheet
        open={pinFlow === "change-new"}
        title={so.maareyntaNewPin}
        message={so.maareyntaNewPinMsg}
        confirmLabel={so.maareyntaSavePin}
        onConfirm={finishChangeNew}
        onCancel={() => setPinFlow(null)}
      />
    </div>
  );
}
