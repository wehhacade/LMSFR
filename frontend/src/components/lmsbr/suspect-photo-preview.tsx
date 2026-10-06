"use client";

import { useEffect } from "react";
import { SuspectPhoto } from "./suspect-photo";
import { hexA } from "@/lib/lmsbr/data";
import { tuhunkaColor, tuhunkaLabel } from "@/lib/lmsbr/suspect-utils";
import { suspectCaptureDistrict } from "@/lib/lmsbr/suspect-utils";
import { useSuspectCases } from "@/hooks/use-suspects";
import { Icon } from "./icon";
import type { Suspect } from "@/types/suspect";
import type { Lang } from "@/lib/lmsbr/data";
import { getDict } from "@/lib/lmsbr/data";

interface SuspectPhotoPreviewProps {
  suspect: Suspect;
  open: boolean;
  onClose: () => void;
  accent: string;
  isDark: boolean;
  lang: Lang;
  onOpenProfile?: () => void;
}

export function SuspectPhotoPreview({
  suspect,
  open,
  onClose,
  accent,
  isDark,
  lang,
  onOpenProfile,
}: SuspectPhotoPreviewProps) {
  const t = getDict(lang);
  const { data: cases = [] } = useSuspectCases(suspect.id, open);
  const displaySuspicionType = cases[0]?.tuhunka_name || tuhunkaLabel(suspect.suspect_type_name, t);
  const tc = tuhunkaColor(suspect.suspect_type_name);
  const initials = suspect.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const border = isDark ? hexA(accent, 0.22) : hexA(accent, 0.14);
  const panelBg = isDark ? "rgba(12,9,6,0.96)" : "#ffffff";

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={suspect.name}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(5, 4, 3, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: "is-fadeUp .24s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lmsbr-stack-2"
        style={{
          position: "relative",
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
          gap: 0,
          borderRadius: 22,
          overflow: "hidden",
          border: `1px solid ${border}`,
          background: panelBg,
          boxShadow: isDark
            ? `0 40px 100px -28px rgba(0,0,0,.9), 0 0 0 1px ${hexA(accent, 0.1)}`
            : "0 32px 80px -24px rgba(15,23,42,0.28)",
          animation: "is-zoomInTR .38s cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            zIndex: 3,
            width: 42,
            height: 42,
            borderRadius: 12,
            border: `1px solid ${hexA(accent, 0.35)}`,
            background: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.94)",
            color: accent,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="close" size={18} sw={2} />
        </button>

        <div
          style={{
            position: "relative",
            minHeight: "min(72vh, 680px)",
            background: isDark ? "#0a0704" : "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: "min(72vh, 680px)",
              borderRadius: 0,
              overflow: "hidden",
              position: "relative",
              boxShadow: isDark ? "none" : "inset -1px 0 0 rgba(15,23,42,0.06)",
            }}
          >
            <SuspectPhoto
              photo={suspect.photo}
              alt={suspect.name}
              loading="eager"
              style={{ objectFit: "contain", background: isDark ? "#0a0704" : "#eef2f7" }}
              fallback={
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "min(72vh, 680px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    background: `linear-gradient(165deg, ${hexA(accent, 0.18)} 0%, ${hexA(accent, 0.05)} 100%)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-cinzel)",
                      fontSize: 72,
                      fontWeight: 700,
                      color: hexA(accent, 0.55),
                    }}
                  >
                    {initials || "?"}
                  </span>
                  <img src="/emblem.png" alt="" style={{ width: 88, height: 88, opacity: 0.35, objectFit: "contain" }} />
                </div>
              }
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.18) 100%)",
              }}
            />
          </div>
        </div>

        <div
          style={{
            padding: "28px 26px 30px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            borderLeft: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : hexA(accent, 0.08)}`,
            background: isDark ? hexA(accent, 0.03) : "#fff",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 999,
                background: hexA(tc, 0.16),
                color: tc,
                border: `1px solid ${hexA(tc, 0.32)}`,
                letterSpacing: ".06em",
                fontFamily: "var(--font-outfit)",
              }}
            >
              {tuhunkaLabel(suspect.suspect_type_name, t)}
            </span>
            {(suspect.bail_count ?? 0) > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: hexA(accent, 0.12),
                  color: accent,
                  border: `1px solid ${hexA(accent, 0.28)}`,
                  fontFamily: "var(--font-outfit)",
                }}
              >
                {suspect.bail_count} {t.bailCases}
              </span>
            )}
          </div>

          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-cinzel)",
              fontWeight: 600,
              fontSize: "clamp(22px, 3vw, 30px)",
              color: isDark ? "#efe6d6" : "#1C1917",
              lineHeight: 1.2,
            }}
          >
            {suspect.name}
          </h2>
          {suspect.alias && (
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-outfit)", fontSize: 14, color: isDark ? "#b89a6a" : "#8B7D6B" }}>
              @{suspect.alias}
            </p>
          )}

          <div
            style={{
              marginTop: 22,
              display: "grid",
              gap: 12,
              fontFamily: "var(--font-outfit)",
              fontSize: 14,
              color: isDark ? "#c4b08a" : "#4A5568",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: accent, display: "flex" }}><Icon name="clipboard" size={15} sw={1.9} /></span>
              <span><strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>{t.colTuhunka}:</strong> {displaySuspicionType}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: accent, display: "flex" }}><Icon name="map" size={15} sw={1.9} /></span>
              <span><strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>{t.colDistrict}:</strong> {suspectCaptureDistrict(suspect)}</span>
            </div>
            {suspect.offense && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: accent, display: "flex", marginTop: 2 }}><Icon name="alert" size={15} sw={1.9} /></span>
                <span><strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>{t.colDetails}:</strong> {suspect.offense}</span>
              </div>
            )}
          </div>

          {onOpenProfile && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              style={{
                marginTop: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 18px",
                borderRadius: 11,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-outfit)",
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
                background: `linear-gradient(120deg, ${hexA(accent, 0.95)}, ${hexA(accent, 0.65)})`,
                boxShadow: `0 12px 28px -12px ${hexA(accent, 0.65)}`,
              }}
            >
              {t.suspectProfile}
              <Icon name="arrow" size={15} sw={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
