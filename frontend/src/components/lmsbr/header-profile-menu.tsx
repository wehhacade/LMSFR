"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePermissions } from "@/hooks/use-permissions";
import { hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";

export type HeaderProfileColors = {
  txtPrimary: string;
  txtSecondary: string;
  txtMuted: string;
  cardBdr: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  logoutHovC: string;
  logoutHovBg: string;
  btnBg: string;
  btnBdr: string;
  inputBdr: string;
};

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || "U").toUpperCase();
}

export function HeaderProfileMenu({
  C,
  accent,
  isDark,
  onLogout,
  onProfileClick,
  profileLabel,
  signOutLabel,
  signOutConfirmTitle,
  signOutConfirmMessage,
  cancelLabel,
  compact = false,
  fullWidth = false,
}: {
  C: HeaderProfileColors;
  accent: string;
  isDark: boolean;
  onLogout: () => void | Promise<void>;
  onProfileClick: () => void;
  profileLabel: string;
  signOutLabel: string;
  signOutConfirmTitle: string;
  signOutConfirmMessage: string;
  cancelLabel: string;
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const { user } = usePermissions();
  const [open, setOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!logoutConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !logoutPending) setLogoutConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logoutConfirm, logoutPending]);

  const displayName = user?.full_name || user?.username || "User";
  const email = user?.email ?? "";
  const ini = userInitials(displayName);
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "";
  const avatarUrl = resolveMediaUrl(user?.profile_url);

  const triggerBg = open
    ? (isDark ? hexA(accent, 0.14) : hexA(accent, 0.07))
    : (isDark ? C.btnBg : C.btnBg);

  const confirmLogout = async () => {
    setLogoutPending(true);
    try {
      await Promise.resolve(onLogout());
      setLogoutConfirm(false);
    } finally {
      setLogoutPending(false);
    }
  };

  const logoutConfirmPanel = logoutConfirm && typeof document !== "undefined"
    ? createPortal(
        <div
          role="alertdialog"
          aria-labelledby="logout-confirm-title"
          aria-describedby="logout-confirm-msg"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 250,
            width: "min(360px, calc(100vw - 32px))",
            borderRadius: "14px",
            border: `1px solid ${isDark ? "rgba(224,101,90,0.35)" : "rgba(224,101,90,0.28)"}`,
            background: C.panelBg,
            boxShadow: isDark
              ? "0 24px 50px -16px rgba(0,0,0,.6), 0 0 0 1px rgba(224,101,90,0.12)"
              : "0 12px 40px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            overflow: "hidden",
            animation: "is-slideUpBR .28s cubic-bezier(.2,.8,.2,1) both",
            fontFamily: "var(--font-outfit)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px 16px 14px",
              borderBottom: `1px solid ${C.tableSep}`,
              background: isDark ? "rgba(224,101,90,0.08)" : "rgba(224,101,90,0.06)",
            }}
          >
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(224,101,90,0.14)",
                color: C.logoutHovC,
              }}
            >
              <Icon name="logout" size={18} sw={2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div id="logout-confirm-title" style={{ fontSize: "15px", fontWeight: 600, color: C.txtPrimary, lineHeight: 1.3 }}>
                {signOutConfirmTitle}
              </div>
              <p id="logout-confirm-msg" style={{ margin: "6px 0 0", fontSize: "13px", color: C.txtMuted, lineHeight: 1.45 }}>
                {signOutConfirmMessage}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 14px" }}>
            <button
              type="button"
              disabled={logoutPending}
              onClick={() => setLogoutConfirm(false)}
              style={{
                padding: "9px 14px",
                borderRadius: "9px",
                border: `1px solid ${C.inputBdr}`,
                background: "transparent",
                color: C.txtSecondary,
                cursor: logoutPending ? "not-allowed" : "pointer",
                fontFamily: "var(--font-outfit)",
                fontSize: "13px",
                fontWeight: 500,
                opacity: logoutPending ? 0.6 : 1,
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={logoutPending}
              onClick={() => void confirmLogout()}
              style={{
                padding: "9px 16px",
                borderRadius: "9px",
                border: "none",
                background: C.logoutHovC,
                color: "#fff",
                cursor: logoutPending ? "not-allowed" : "pointer",
                fontFamily: "var(--font-outfit)",
                fontSize: "13px",
                fontWeight: 600,
                opacity: logoutPending ? 0.7 : 1,
              }}
            >
              {logoutPending ? "…" : signOutLabel}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div ref={rootRef} style={{ position: "relative", width: fullWidth ? "100%" : undefined }}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? "0" : "10px",
            width: fullWidth ? "100%" : undefined,
            padding: compact ? "3px" : fullWidth ? "6px 10px 6px 6px" : "4px 10px 4px 4px",
            borderRadius: "12px",
            border: `1px solid ${open ? hexA(accent, 0.5) : C.inputBdr}`,
            background: triggerBg,
            cursor: "pointer",
            transition: "border-color .2s, background .2s, box-shadow .2s",
            boxShadow: open && !isDark ? "0 4px 14px -6px rgba(15,23,42,0.12)" : isDark ? "none" : "0 1px 2px rgba(15,23,42,0.04)",
            fontFamily: "var(--font-outfit)",
          }}
        >
          <span
            style={{
              width: compact ? "34px" : "36px",
              height: compact ? "34px" : "36px",
              borderRadius: "50%",
              flexShrink: 0,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: avatarUrl
                ? "transparent"
                : `linear-gradient(135deg,${accent},${hexA(accent, 0.55)})`,
              color: "#fff",
              fontWeight: 700,
              fontSize: "12px",
              boxShadow: `0 0 0 2px ${isDark ? hexA(accent, 0.35) : "#fff"}, 0 0 0 3px ${hexA(accent, 0.22)}`,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              ini
            )}
          </span>
          {!compact && (
            <>
              <span style={{ textAlign: "left", minWidth: 0, maxWidth: "140px" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: C.txtPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.25,
                  }}
                >
                  {displayName}
                </span>
                {roleLabel && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: C.txtMuted,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: "1px",
                    }}
                  >
                    {roleLabel}
                  </span>
                )}
              </span>
              <span
                style={{
                  display: "flex",
                  color: C.txtMuted,
                  transform: open ? "rotate(180deg)" : "none",
                  transition: "transform .25s",
                }}
              >
                <Icon name="chevdown" size={14} sw={2.2} />
              </span>
            </>
          )}
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: "248px",
              zIndex: 120,
              borderRadius: "14px",
              border: `1px solid ${C.cardBdr}`,
              background: C.panelBg,
              boxShadow: isDark
                ? "0 24px 50px -20px rgba(0,0,0,.55)"
                : C.panelShadow,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              overflow: "hidden",
              animation: "is-fadeUp .22s ease both",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: `1px solid ${C.tableSep}`,
                background: isDark ? hexA(accent, 0.06) : hexA(accent, 0.05),
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 600, color: C.txtPrimary, lineHeight: 1.3 }}>
                {displayName}
              </div>
              {email && (
                <div
                  style={{
                    fontSize: "12px",
                    color: C.txtMuted,
                    marginTop: "4px",
                    wordBreak: "break-all",
                  }}
                >
                  {email}
                </div>
              )}
              {roleLabel && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "10px",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    padding: "4px 9px",
                    borderRadius: "20px",
                    background: hexA(accent, 0.14),
                    color: accent,
                    border: `1px solid ${hexA(accent, 0.28)}`,
                  }}
                >
                  {roleLabel}
                </span>
              )}
            </div>

            <div style={{ padding: "6px" }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onProfileClick();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "transparent",
                  color: C.txtPrimary,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  textAlign: "left",
                  transition: "background .2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = isDark
                    ? "rgba(255,255,255,0.06)"
                    : hexA(accent, 0.08);
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span style={{ display: "flex", color: accent }}>
                  <Icon name="users" size={17} sw={1.8} />
                </span>
                {profileLabel}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setLogoutConfirm(true);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "transparent",
                  color: C.logoutHovC,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  textAlign: "left",
                  transition: "background .2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = C.logoutHovBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span style={{ display: "flex" }}>
                  <Icon name="logout" size={17} sw={1.8} />
                </span>
                {signOutLabel}
              </button>
            </div>
          </div>
        )}
      </div>
      {logoutConfirmPanel}
    </>
  );
}
