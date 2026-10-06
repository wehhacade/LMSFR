"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icon";
import { DARK_CORE } from "@/lib/lmsbr/theme-tokens";

export type SurveySelectTheme = {
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  inputBg: string;
  inputBdr: string;
  isDark: boolean;
};

type Option = { value: string; label: string };

export function SurveySelect({
  T,
  value,
  onChange,
  options,
  disabled,
}: {
  T: SurveySelectTheme;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow);

    setPanelStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 5000,
      maxHeight: height,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const panelBg = T.isDark ? DARK_CORE.dropdown : "#ffffff";

  const panel = open && typeof document !== "undefined" ? (
    createPortal(
      <div
        ref={panelRef}
        role="listbox"
        style={{
          ...panelStyle,
          overflowY: "auto",
          borderRadius: 10,
          background: panelBg,
          border: `1px solid ${T.isDark ? DARK_CORE.inputBorder : T.inputBdr}`,
          boxShadow: T.isDark
            ? "0 28px 56px -16px rgba(0,0,0,0.82), inset 0 1px 0 rgba(248,228,180,0.04)"
            : "0 12px 32px -8px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06)",
          padding: 6,
          animation: "is-fadeUp .18s ease both",
        }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-outfit)",
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: active ? T.accentSoft : "transparent",
                color: active ? T.accent : T.muted,
                transition: "background .15s, color .15s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = T.isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(59,130,246,0.08)";
                  e.currentTarget.style.color = T.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = T.muted;
                }
              }}
            >
              {active && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: T.accent,
                    flexShrink: 0,
                  }}
                />
              )}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>,
      document.body,
    )
  ) : null;

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "9px 12px",
          borderRadius: 8,
          border: `1px solid ${open ? T.accent : T.inputBdr}`,
          background: T.inputBg,
          color: T.text,
          fontFamily: "var(--font-outfit)",
          fontSize: 14,
          fontWeight: 500,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color .2s, box-shadow .2s",
          boxShadow: open ? `0 0 0 3px ${T.accentSoft}` : "none",
          textAlign: "left",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? value}
        </span>
        <span
          style={{
            display: "flex",
            color: open ? T.accent : T.muted,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s, color .2s",
            flexShrink: 0,
          }}
        >
          <Icon name="chevdown" size={14} sw={2} />
        </span>
      </button>
      {panel}
    </div>
  );
}
