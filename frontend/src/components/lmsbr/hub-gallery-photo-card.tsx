"use client";

import { useState } from "react";
import { hexA } from "@/lib/lmsbr/data";
import { primaryGalleryImageUrl, weaponImageUrl } from "@/lib/record-display";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";
import type { DisarmamentRecord } from "@/types/hubkadhigis";

function initialsFrom(name?: string) {
  return name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function PhotoFallback({
  initials,
  accent,
  label,
}: {
  initials: string;
  accent: string;
  label?: string;
}) {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      background: `linear-gradient(165deg, ${hexA(accent, 0.14)} 0%, ${hexA(accent, 0.05)} 100%)`,
    }}>
      <span style={{
        fontFamily: "var(--font-cinzel)",
        fontSize: 36,
        fontWeight: 700,
        color: hexA(accent, 0.55),
      }}>
        {initials || "?"}
      </span>
      {label && (
        <span style={{ fontSize: 10, fontWeight: 600, color: hexA(accent, 0.5), fontFamily: "var(--font-outfit)" }}>
          {label}
        </span>
      )}
    </div>
  );
}

export function HubGalleryPhotoCard({
  record,
  accent,
  isDark,
  border,
  onClick,
}: {
  record: DisarmamentRecord;
  accent: string;
  isDark: boolean;
  border: string;
  onClick: () => void;
}) {
  const weaponUrl = weaponImageUrl(record);
  // Main: person if present, otherwise cover. Corner thumbnail: always cover/weapon when available.
  const mainUrl = primaryGalleryImageUrl(record);
  const cornerUrl = weaponUrl;
  const initials = initialsFrom(record.person_name);
  const [mainFailed, setMainFailed] = useState(false);
  const [weaponFailed, setWeaponFailed] = useState(false);

  const showMain = mainUrl && !mainFailed;
  const showCorner = cornerUrl && !weaponFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        border: `1px solid ${border}`,
        borderRadius: 18,
        overflow: "hidden",
        padding: 0,
        cursor: "pointer",
        background: isDark ? hexA(accent, 0.05) : "#fff",
        boxShadow: isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)",
        transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = hexA(accent, 0.42);
        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 20px 40px -18px ${hexA(accent, 0.38)}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
        (e.currentTarget as HTMLButtonElement).style.borderColor = border;
        (e.currentTarget as HTMLButtonElement).style.boxShadow = isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)";
      }}
    >
      <div style={{ position: "relative", aspectRatio: "5/6", background: isDark ? "#1e293b" : "#f8fafc" }}>
        {showMain ? (
          <img
            src={mainUrl}
            alt={record.person_name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            loading="lazy"
            onError={() => setMainFailed(true)}
          />
        ) : (
          <PhotoFallback initials={initials ?? ""} accent={accent} label="Person photo" />
        )}

        <div style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          width: 68,
          height: 68,
          borderRadius: 14,
          overflow: "hidden",
          border: "3px solid #fff",
          boxShadow: "0 8px 22px rgba(15,23,42,0.28)",
          background: "#e2e8f0",
        }}>
          {showCorner ? (
            <img
              src={cornerUrl}
              alt={record.weapon_type_name ?? "Weapon"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
              onError={() => setWeaponFailed(true)}
            />
          ) : (
            <PhotoFallback initials="W" accent={accent} />
          )}
        </div>
      </div>

      <div style={{
        padding: "14px 16px 16px",
        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : hexA(accent, 0.08)}`,
        background: isDark ? hexA(accent, 0.04) : "#fff",
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: hexA(accent, 0.75),
          fontFamily: "var(--font-outfit)",
        }}>
          {record.reference_number}
        </div>
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          marginTop: 5,
          color: isDark ? "#f1f5f9" : "#0f172a",
          fontFamily: "var(--font-outfit)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {record.person_name}
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 8,
        }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: accent,
            fontFamily: "var(--font-outfit)",
          }}>
            <Icon name="target" size={12} sw={2} />
            {record.weapon_type_name || "—"}
          </span>
          {(record.image_count ?? 0) > 0 && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              color: accent,
              fontFamily: "var(--font-outfit)",
              padding: "3px 8px",
              borderRadius: 999,
              background: hexA(accent, 0.1),
            }}>
              <Icon name="clipboard" size={11} sw={2} />
              +{record.image_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function resolveEvidenceUrl(url: string | null | undefined) {
  return resolveMediaUrl(url);
}
