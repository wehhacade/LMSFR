"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";
import type { AccountsThemeColors } from "./accounts-shared";

type ThemeColors = AccountsThemeColors;

export type DocItem = {
  id: number;
  label: string;
  url: string;
};

export function isImageDocUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(path);
}

function isPdfDocUrl(url: string): boolean {
  return /\.pdf$/i.test(url.split("?")[0]);
}

function isVideoDocUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(url.split("?")[0]);
}

function isAudioDocUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|m4a)$/i.test(url.split("?")[0]);
}

function DocPreviewLightbox({
  label,
  url,
  accent,
  isDark,
  onClose,
}: {
  label: string;
  url: string;
  accent: string;
  isDark: boolean;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const src = resolveMediaUrl(url) ?? url;
  const isImage = isImageDocUrl(url);
  const isPdf = isPdfDocUrl(url);
  const isVideo = isVideoDocUrl(url);
  const isAudio = isAudioDocUrl(url);

  useEffect(() => {
    if (!isPdf) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setPdfFailed(false);
    setPdfBlobUrl(null);
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        // X-Frame-Options on the original response only blocks framing the
        // network resource directly — a blob: URL we created ourselves from
        // bytes we already fetched isn't subject to it.
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPdfFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isPdf, src]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
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
  }, [onClose]);

  if (!mounted) return null;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 96vw)",
          maxHeight: "92vh",
          borderRadius: 16,
          overflow: "hidden",
          background: isDark ? "rgba(12,9,6,0.96)" : "#fff",
          border: `1px solid ${hexA(accent, isDark ? 0.22 : 0.14)}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 18px",
            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: 14,
              fontWeight: 600,
              color: isDark ? "#efe6d6" : "#1C1917",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${hexA(accent, 0.25)}`,
              background: hexA(accent, 0.08),
              color: accent,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={16} sw={2} />
          </button>
        </div>
        <div
          style={{
            padding: isPdf && pdfBlobUrl ? 0 : 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            minHeight: 240,
            height: isPdf && pdfBlobUrl ? "80vh" : undefined,
            background: isDark ? "rgba(0,0,0,0.25)" : "#f4f4f5",
          }}
        >
          {isPdf ? (
            pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title={label}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            ) : pdfFailed ? (
              <>
                <Icon name="archive" size={40} sw={1.4} />
                <div style={{ color: isDark ? "#c9c2b4" : "#57534e", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
                  PDF preview isn&apos;t available inline
                </div>
                <a
                  href={src}
                  style={{ color: accent, fontFamily: "var(--font-outfit)", fontWeight: 600 }}
                >
                  Open document
                </a>
              </>
            ) : (
              <div style={{ color: isDark ? "#c9c2b4" : "#57534e", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
                Loading preview…
              </div>
            )
          ) : isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={src}
              controls
              autoPlay
              style={{ maxWidth: "100%", maxHeight: "min(72vh, 680px)", borderRadius: 8 }}
            />
          ) : isAudio ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio src={src} controls style={{ width: "100%" }} />
          ) : failed || !isImage ? (
            <a
              href={src}
              style={{ color: accent, fontFamily: "var(--font-outfit)", fontWeight: 600 }}
            >
              Open document
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={label}
              onError={() => setFailed(true)}
              style={{
                maxWidth: "100%",
                maxHeight: "min(72vh, 680px)",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

export function DhacdoDocumentGallery({
  docs,
  emptyMessage,
  openLabel,
  C,
  accent,
  isDark,
}: {
  docs: DocItem[];
  emptyMessage: string;
  openLabel: string;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const [preview, setPreview] = useState<DocItem | null>(null);

  if (docs.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: C.txtMuted,
          fontFamily: "var(--font-outfit)",
          textAlign: "center",
          padding: "28px 0",
        }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      {preview && (
        <DocPreviewLightbox
          label={preview.label}
          url={preview.url}
          accent={accent}
          isDark={isDark}
          onClose={() => setPreview(null)}
        />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {docs.map((doc) => {
          const canPreview = isImageDocUrl(doc.url);
          const src = resolveMediaUrl(doc.url) ?? doc.url;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => setPreview(doc)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0,
                padding: 0,
                borderRadius: 12,
                border: `1px solid ${C.tableSep}`,
                background: C.inputBg ?? hexA(accent, 0.04),
                cursor: "pointer",
                overflow: "hidden",
                textAlign: "left",
                fontFamily: "var(--font-outfit)",
              }}
            >
              <div
                style={{
                  height: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDark ? "rgba(0,0,0,0.25)" : "#eef1f4",
                }}
              >
                {canPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={doc.label}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Icon name="archive" size={28} sw={1.6} />
                )}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: C.txtPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={doc.label}
                >
                  {doc.label}
                </div>
                <div style={{ fontSize: 11, color: accent, marginTop: 4, fontWeight: 600 }}>
                  {canPreview ? openLabel : openLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
