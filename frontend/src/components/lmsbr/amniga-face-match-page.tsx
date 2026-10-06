"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { PrimaryButton, SecondaryButton, type AccountsThemeColors } from "./accounts-shared";
import api from "@/lib/axios";
import { resolveSuspectPhotoUrl } from "@/lib/suspect-photo";

type ThemeColors = AccountsThemeColors;

type FaceMatchRow = {
  id: number;
  name: string;
  photo?: string | null;
  N_tuhunka?: string | null;
  degmada?: string | null;
  match_score?: number | null;
  source?: string | null;
  tnumber?: string | null;
};

type FaceMatchResponse = {
  isError?: boolean;
  found?: boolean;
  Message?: string;
  matches?: FaceMatchRow[];
};

function scoreLabel(score: number | null | undefined): string | null {
  if (score == null || Number.isNaN(Number(score))) return null;
  const n = Number(score);
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

export function AmnigaFaceMatchPage({
  C,
  accent,
  isDark,
  moduleName,
  onOpenSuspect,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  moduleName?: string;
  onOpenSuspect: (id: number) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [found, setFound] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<FaceMatchRow[]>([]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = useCallback(
    (next?: File | null) => {
      if (!next) return;
      setFile(next);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(next);
      });
      setMatches([]);
      setMessage("");
      setFound(null);
    },
    [],
  );

  const clear = useCallback(() => {
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setMatches([]);
    setMessage("");
    setFound(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }, []);

  const runMatch = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setMessage("");
    setFound(null);
    try {
      const body = new FormData();
      body.append("image", file);
      const { data } = await api.post<FaceMatchResponse>("/face-match", body, {
        timeout: 120_000,
      });
      if (data?.isError) {
        setFound(false);
        setMatches([]);
        setMessage(data.Message || t.faceMatchFailed);
        return;
      }
      const rows = Array.isArray(data?.matches) ? data.matches : [];
      setMatches(rows);
      setFound(Boolean(data?.found));
      setMessage(
        data?.Message
        || (data?.found ? t.faceMatchFound : t.faceMatchNone),
      );
    } catch (err) {
      setFound(false);
      setMatches([]);
      const axiosErr = err as { response?: { data?: { Message?: string; detail?: string } } };
      setMessage(
        axiosErr.response?.data?.Message
        || axiosErr.response?.data?.detail
        || (err instanceof Error ? err.message : t.faceMatchFailed),
      );
    } finally {
      setLoading(false);
    }
  }, [file, t.faceMatchFailed, t.faceMatchFound, t.faceMatchNone]);

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div style={{ marginBottom: 18 }}>
        {moduleName && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: accent,
              boxShadow: isDark ? `0 0 12px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
            }} />
            <span style={{
              fontSize: 11.5, letterSpacing: ".18em", textTransform: "uppercase",
              color: isDark ? accent : "#c69049", fontWeight: 600,
            }}>
              {moduleName}
            </span>
          </div>
        )}
        <h1 style={{
          margin: 0,
          fontFamily: "var(--font-cinzel)",
          fontWeight: 600,
          fontSize: "clamp(24px, 3.2vw, 34px)",
          color: C.txtPrimary,
          letterSpacing: ".01em",
        }}>
          {t.faceMatchTitle}
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: C.txtMuted, maxWidth: 560, lineHeight: 1.5 }}>
          {t.faceMatchSub}
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 18,
        alignItems: "start",
      }}>
        <div style={{
          borderRadius: 14,
          overflow: "hidden",
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
        }}>
          <div style={{
            padding: "16px 18px",
            borderBottom: `1px solid ${C.tableSep}`,
            background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
          }}>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
              {t.faceMatchUpload}
            </div>
          </div>
          <div style={{ padding: 18 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pick(e.dataTransfer.files?.[0] ?? null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                aspectRatio: "4 / 3",
                borderRadius: 12,
                border: `1.5px dashed ${dragOver ? accent : C.inputBdr}`,
                background: dragOver ? hexA(accent, 0.08) : C.inputBg,
                overflow: "hidden",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13.5, padding: 16,
                }}>
                  <span style={{ color: accent }}><Icon name="search" size={28} sw={1.7} /></span>
                  {t.faceMatchDrop}
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <SecondaryButton onClick={() => fileRef.current?.click()} C={C}>
                {t.faceMatchGallery}
              </SecondaryButton>
              <SecondaryButton onClick={() => cameraRef.current?.click()} C={C}>
                {t.faceMatchCamera}
              </SecondaryButton>
              {file ? (
                <SecondaryButton onClick={clear} C={C}>
                  {t.cancelAction}
                </SecondaryButton>
              ) : null}
            </div>
            <div style={{ marginTop: 14 }}>
              <PrimaryButton onClick={() => void runMatch()} disabled={!file || loading} accent={accent} fullWidth>
                {loading ? t.faceMatchSearching : t.faceMatchSearch}
              </PrimaryButton>
            </div>
          </div>
        </div>

        <div style={{
          borderRadius: 14,
          overflow: "hidden",
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
          minHeight: 280,
        }}>
          <div style={{
            padding: "16px 18px",
            borderBottom: `1px solid ${C.tableSep}`,
            background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
          }}>
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
              {t.faceMatchResults}
            </div>
          </div>
          <div style={{ padding: 18 }}>
            {message ? (
              <p style={{
                margin: "0 0 14px",
                fontSize: 14,
                color: found ? "#46c08a" : C.txtMuted,
                fontFamily: "var(--font-outfit)",
              }}>
                {message}
              </p>
            ) : (
              <p style={{ margin: "0 0 14px", fontSize: 14, color: C.txtMuted }}>
                {t.faceMatchHint}
              </p>
            )}
            {matches.length === 0 && !loading ? (
              <div style={{
                padding: "28px 12px",
                textAlign: "center",
                color: C.txtMuted,
                fontSize: 13.5,
              }}>
                {t.faceMatchEmpty}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {matches.map((row) => {
                const photo = resolveSuspectPhotoUrl(row.photo);
                const score = scoreLabel(row.match_score);
                return (
                  <button
                    type="button"
                    key={`${row.source ?? "suspect"}-${row.id}`}
                    onClick={() => onOpenSuspect(row.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${C.cardBdr}`,
                      background: C.cardBg,
                      cursor: "pointer",
                      fontFamily: "var(--font-outfit)",
                    }}
                  >
                    <div style={{
                      width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                      background: hexA(accent, 0.14), color: accent,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 18,
                    }}>
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        (row.name || "?").slice(0, 1)
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: C.txtPrimary, fontSize: 15 }}>
                        {row.name || "—"}
                      </div>
                      <div style={{ fontSize: 12.5, color: C.txtMuted, marginTop: 3 }}>
                        {[row.N_tuhunka, row.degmada, row.tnumber, score]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <span style={{ color: C.txtMuted, display: "flex" }}>
                      <Icon name="chevron" size={16} sw={2} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
