"use client";

import { useEffect } from "react";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { useTipTheme } from "./theme-provider";
import { rgba } from "@/lib/tiphone/theme";

export type ToastKind = "success" | "error" | "info";

export function TipToast({
  kind = "info",
  title,
  message,
  onClose,
}: {
  kind?: ToastKind;
  title: string;
  message?: string;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();

  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? XCircle : Info;
  const accent = kind === "success" ? colors.green : kind === "error" ? colors.rose : colors.gold;

  return (
    <div
      className="pointer-events-auto fixed left-4 right-4 top-4 z-[100] mx-auto max-w-md"
      style={{ animation: "tipSlideDown 0.28s ease" }}
    >
      <div
        className="flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md"
        style={{
          background: rgba(colors.surfnavRgb, 0.95),
          borderColor: rgba(colors.lineRgb, 0.12),
        }}
      >
        <Icon size={20} style={{ color: accent }} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: colors.ink0 }}>
            {title}
          </p>
          {message ? (
            <p className="mt-0.5 text-xs" style={{ color: colors.ink2 }}>
              {message}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} style={{ color: colors.inkMut }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
