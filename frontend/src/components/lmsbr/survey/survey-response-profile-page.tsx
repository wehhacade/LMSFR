"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Answer, SurveyResponseDetail } from "@/types/surveys";
import { useDeleteSurveyResponse, useSurveyResponse } from "@/hooks/use-surveys";
import { useMe } from "@/hooks/use-auth";
import { canDeleteSurveyResponse } from "@/lib/permissions";
import { hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "../icon";
import { useLang } from "../lang-ctx";
import { StatusBadge } from "./survey-pulse-ui";
import { SurveyConfirmDialog } from "./survey-form-modal";
import {
  SurveyEmptyState,
  SurveyPageRoot,
  SurveyPanel,
  SurveyPanelHeader,
} from "./survey-layout";
import type { SurveyThemeColors } from "./survey-theme";
import { Skeleton } from "@/components/ui/skeleton";

const AVATAR_COLORS = [
  "#3fd0b5", "#1A365D", "#46c08a", "#5b9fd4", "#9d8ef5",
  "#e0655a", "#6B7280", "#A6742F",
];

function isImageAttachmentUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(path);
}

function respondentLabel(r: SurveyResponseDetail): string {
  return r.user_name ?? r.respondent_phone ?? "Anonymous";
}

function ownerNameFromAnswers(answers: Answer[]): string {
  const match = answers.find((a) => /magaca\s+milkila?ha/i.test(a.question_text));
  return match?.value_text?.trim() || "";
}

function AttachmentPreview({
  label,
  url,
  ownerName,
  ownerPhone,
  respondentName,
  guriNumber,
  location,
  accent,
  isDark,
  onClose,
}: {
  label: string;
  url: string;
  ownerName: string;
  ownerPhone: string;
  respondentName: string;
  guriNumber: string;
  location: string;
  accent: string;
  isDark: boolean;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(url) ?? url;

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

  const border = isDark ? hexA(accent, 0.22) : hexA(accent, 0.14);
  const panelBg = isDark ? "rgba(12,9,6,0.96)" : "#ffffff";
  const photoH = "min(72vh, 680px)";
  const [mounted, setMounted] = useState(false);
  const { lang } = useLang();
  const so = lang === "so";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const dialog = (
    <div
      role="dialog"
      aria-modal
      aria-label={label}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: isDark ? "rgba(8, 6, 4, 0.55)" : "rgba(15, 23, 42, 0.32)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "is-fadeIn .2s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="survey-attachment-preview-panel"
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
          animation: "is-scaleIn .32s cubic-bezier(.2,.8,.2,1) both",
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
            height: photoH,
            minHeight: photoH,
            background: isDark ? "#0a0704" : "#eef2f7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: isDark ? "none" : "inset -1px 0 0 rgba(15,23,42,0.06)",
          }}
        >
          {failed ? (
            <div style={{ textAlign: "center", padding: 24, fontFamily: "var(--font-outfit)", color: isDark ? "#c4b08a" : "#64748b" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Image could not load</div>
              <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: accent, fontSize: 13 }}>
                Open in new tab
              </a>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={label}
              referrerPolicy="no-referrer"
              decoding="async"
              onError={() => setFailed(true)}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.18) 100%)",
            }}
          />
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
            minHeight: photoH,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 999,
                background: hexA(accent, 0.16),
                color: accent,
                border: `1px solid ${hexA(accent, 0.32)}`,
                letterSpacing: ".06em",
                fontFamily: "var(--font-outfit)",
              }}
            >
              {label}
            </span>
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
            {ownerName || respondentName}
          </h2>
          {ownerName && ownerName !== respondentName && (
            <p style={{
              margin: "8px 0 0",
              fontFamily: "var(--font-outfit)",
              fontSize: 13,
              color: isDark ? "#a89878" : "#64748b",
            }}>
              {so ? "Milkiilaha guriga" : "Property owner"}
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
            {ownerName && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: accent, display: "flex", marginTop: 2 }}><Icon name="users" size={15} sw={1.9} /></span>
                <span>
                  <strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>
                    {so ? "Magaca milkiilaha:" : "Owner name:"}
                  </strong>{" "}
                  {ownerName}
                  {guriNumber ? ` · ${so ? "Guri" : "House"} ${guriNumber}` : ""}
                </span>
              </div>
            )}
            {ownerPhone && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: accent, display: "flex" }}><Icon name="mail" size={15} sw={1.9} /></span>
                <span>
                  <strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>
                    {so ? "Telefoonka milkiilaha:" : "Owner phone:"}
                  </strong>{" "}
                  {ownerPhone}
                </span>
              </div>
            )}
            {respondentName && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: accent, display: "flex", marginTop: 2 }}><Icon name="clipboard" size={15} sw={1.9} /></span>
                <span>
                  <strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>
                    {so ? "Jawaab-bixiyaha:" : "Respondent:"}
                  </strong>{" "}
                  {respondentName}
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: accent, display: "flex" }}><Icon name="map" size={15} sw={1.9} /></span>
              <span>
                <strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>
                  {so ? "Goobta:" : "Location:"}
                </strong>{" "}
                {location}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: accent, display: "flex" }}><Icon name="file" size={15} sw={1.9} /></span>
              <span>
                <strong style={{ color: isDark ? "#efe6d6" : "#1C1917" }}>
                  {so ? "Lifaaqa:" : "Attachment:"}
                </strong>{" "}
                {label}
              </span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .survey-attachment-preview-panel {
            grid-template-columns: 1fr !important;
          }
          .survey-attachment-preview-panel > div:first-of-type {
            min-height: min(48vh, 420px) !important;
            height: min(48vh, 420px) !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(dialog, document.body);
}

function respondentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatNumberValue(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) && !Number.isInteger(n) ? n.toFixed(1) : String(value);
}

function formatAnswerValue(answer: Answer): string {
  switch (answer.question_type) {
    case "single":
    case "multi": {
      if (!answer.choices.length) return "—";
      const labels = answer.choices.map((c) => {
        if (c.is_other && answer.value_text?.trim()) {
          return `${c.label}: ${answer.value_text.trim()}`;
        }
        return c.label;
      });
      return labels.join(", ");
    }
    case "boolean":
      return answer.value_bool === null ? "—" : answer.value_bool ? "Yes" : "No";
    case "date":
      return answer.value_date || "—";
    case "integer":
    case "decimal":
    case "rating":
      return answer.value_number !== null ? formatNumberValue(answer.value_number) : "—";
    case "short_text":
    case "long_text":
      return answer.value_text || "—";
    default:
      break;
  }
  if (answer.value_text) return answer.value_text;
  if (answer.choices.length > 0) return answer.choices.map((c) => c.label).join(", ");
  if (answer.value_number !== null) return formatNumberValue(answer.value_number);
  if (answer.value_date) return answer.value_date;
  if (answer.value_bool !== null) return answer.value_bool ? "Yes" : "No";
  return "—";
}

function isRatingAnswer(answer: Answer): boolean {
  return answer.question_type === "rating" && answer.value_number !== null;
}

function DetailTile({
  label,
  value,
  C,
  icon,
}: {
  label: string;
  value: ReactNode;
  C: SurveyThemeColors;
  icon?: string;
}) {
  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: 12,
      border: `1px solid ${C.tableSep}`,
      background: C.inputBg,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: C.txtMuted,
        marginBottom: 8,
        fontFamily: "var(--font-outfit)",
      }}>
        {icon && <Icon name={icon} size={12} sw={1.8} />}
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.txtPrimary, fontFamily: "var(--font-outfit)", lineHeight: 1.45 }}>
        {value}
      </div>
    </div>
  );
}

function ProgressRing({
  pct,
  accent,
  C,
  size = 88,
}: {
  pct: number;
  accent: string;
  C: SurveyThemeColors;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.barTrack} strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-cinzel)", fontSize: 18, fontWeight: 700, fill: C.txtPrimary }}
      >
        {pct}%
      </text>
    </svg>
  );
}

function AnswerCard({
  answer,
  index,
  C,
  accent,
  isDark,
}: {
  answer: Answer;
  index: number;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const display = formatAnswerValue(answer);
  const rating = isRatingAnswer(answer) ? Number(answer.value_number) : null;

  return (
    <div style={{
      position: "relative",
      padding: "18px 20px 18px 24px",
      borderRadius: 14,
      border: `1px solid ${C.cardBdr}`,
      background: isDark ? hexA(accent, 0.04) : "#FFFFFF",
      boxShadow: isDark ? "none" : "0 1px 3px rgba(15,23,42,.04)",
    }}>
      <div style={{
        position: "absolute",
        left: 0,
        top: 14,
        bottom: 14,
        width: 3,
        borderRadius: "0 3px 3px 0",
        background: `linear-gradient(180deg, ${accent}, ${hexA(accent, 0.35)})`,
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hexA(accent, 0.12),
          color: accent,
          fontFamily: "var(--font-cinzel)",
          fontSize: 13,
          fontWeight: 700,
        }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: C.txtMuted,
            marginBottom: 6,
          }}>
            {answer.question_type.replace(/_/g, " ")}
          </div>
          <div style={{
            fontFamily: "var(--font-outfit)",
            fontSize: 15,
            fontWeight: 600,
            color: C.txtPrimary,
            marginBottom: 10,
            lineHeight: 1.45,
          }}>
            {answer.question_text}
          </div>
          {rating !== null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      background: star <= rating ? hexA(accent, 0.18) : C.barTrack,
                      color: star <= rating ? accent : C.txtMuted,
                      border: `1px solid ${star <= rating ? hexA(accent, 0.35) : C.tableSep}`,
                    }}
                  >
                    {star}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 14, color: C.txtMuted }}>{display}</span>
            </div>
          ) : answer.choices.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {answer.choices.map((c) => (
                <span
                  key={c.id}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    background: hexA(accent, 0.1),
                    color: accent,
                    border: `1px solid ${hexA(accent, 0.25)}`,
                  }}
                >
                  {c.is_other && answer.value_text?.trim()
                    ? `${c.label}: ${answer.value_text.trim()}`
                    : c.label}
                </span>
              ))}
            </div>
          ) : (
            <div style={{
              fontSize: 14,
              color: C.txtSecondary,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              padding: "10px 14px",
              borderRadius: 10,
              background: C.inputBg,
              border: `1px solid ${C.tableSep}`,
            }}>
              {display}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton({ C, accent, isDark }: { C: SurveyThemeColors; accent: string; isDark: boolean }) {
  return (
    <SurveyPageRoot>
      <Skeleton style={{ height: 140, borderRadius: 14, marginBottom: 16, background: C.barTrack }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} style={{ height: 100, borderRadius: 14, background: C.barTrack }} />
        ))}
      </div>
      <Skeleton style={{ height: 320, borderRadius: 14, background: C.barTrack }} />
    </SurveyPageRoot>
  );
}

function ResponseProfileContent({
  response,
  C,
  accent,
  isDark,
  onBack,
}: {
  response: SurveyResponseDetail;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const so = lang === "so";
  const { data: me } = useMe();
  const canDelete = canDeleteSurveyResponse(me);
  const deleteResponse = useDeleteSurveyResponse();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const name = respondentLabel(response);
  const ownerName = ownerNameFromAnswers(response.answers);
  const ownerPhone = response.phone_number?.trim() || "";
  const avatarColor = AVATAR_COLORS[response.id % AVATAR_COLORS.length];
  const location = [response.county_name, response.sub_county_name].filter(Boolean).join(" · ") || "—";
  const completionPct = response.total_questions > 0
    ? Math.round((response.answer_count / response.total_questions) * 100)
    : response.answer_count > 0 ? 100 : 0;
  const submitted = new Date(response.submitted_at);
  const [preview, setPreview] = useState<{ label: string; url: string } | null>(null);

  const files = [
    { label: "Identity document", url: response.identity_file, icon: "file" },
    { label: "Respondent photo", url: response.photo, icon: "users" },
    { label: "House photo", url: response.sawirka_guriga, icon: "file" },
    { label: "House document", url: response.documentiga_guriga, icon: "file" },
  ].filter((f): f is { label: string; url: string; icon: string } => Boolean(f.url));

  return (
    <SurveyPageRoot>
      {preview && (
        <AttachmentPreview
          label={preview.label}
          url={preview.url}
          ownerName={ownerName}
          ownerPhone={ownerPhone}
          respondentName={name}
          guriNumber={response.guri_number || ""}
          location={location}
          accent={accent}
          isDark={isDark}
          onClose={() => setPreview(null)}
        />
      )}
      <SurveyConfirmDialog
        open={confirmDelete}
        title={so ? "Tirtir jawaabta?" : "Delete this response?"}
        message={
          so
            ? `Jawaabta #${response.id} (${name}) waa la tirtiri doonaa si joogto ah. Ficilkan lama celin karo.`
            : `Response #${response.id} (${name}) will be permanently deleted. This cannot be undone.`
        }
        confirmLabel={so ? "Tirtir" : "Delete"}
        cancelLabel={so ? "Jooji" : "Cancel"}
        pending={deleteResponse.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteResponse.mutate(response.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              router.push("/dashboard/survey");
            },
          });
        }}
      />
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          color: C.txtMuted,
          cursor: "pointer",
          fontFamily: "var(--font-outfit)",
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 18,
          padding: 0,
        }}
      >
        <Icon name="arrow-left" size={16} sw={2} />
        {so ? "Ku noqo jawaabaha" : "Back to responses"}
      </button>

      {/* Hero */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        marginBottom: 16,
      }}>
        {!isDark && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.4)})`,
          }} />
        )}
        <div style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", minWidth: 0, flex: "1 1 280px" }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(145deg, ${avatarColor}, ${hexA(avatarColor, 0.65)})`,
              color: "#fff",
              fontFamily: "var(--font-cinzel)",
              fontSize: 24,
              fontWeight: 700,
              boxShadow: `0 8px 24px ${hexA(avatarColor, 0.35)}`,
            }}>
              {respondentInitials(name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: C.txtMuted,
                marginBottom: 8,
              }}>
                Response profile · #{response.id}
              </div>
              <h1 style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: "clamp(22px, 3vw, 32px)",
                fontWeight: 700,
                color: C.txtPrimary,
                margin: "0 0 8px",
                lineHeight: 1.15,
              }}>
                {name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <StatusBadge status={response.completion_status} />
                <span style={{ fontSize: 14, color: C.txtMuted }}>{response.survey_name}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {response.navigation_url && (
              <a
                href={response.navigation_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${hexA(accent, 0.35)}`,
                  background: hexA(accent, 0.08),
                  color: accent,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  fontFamily: "var(--font-outfit)",
                }}
              >
                <Icon name="map" size={15} sw={1.8} />
                {so ? "Fur Maps" : "Open in Maps"}
              </a>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteResponse.isPending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(224,101,90,0.4)",
                  background: "rgba(224,101,90,0.1)",
                  color: "#e0655a",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-outfit)",
                  cursor: deleteResponse.isPending ? "not-allowed" : "pointer",
                }}
              >
                <Icon name="delete" size={15} sw={1.8} />
                {so ? "Tirtir jawaabta" : "Delete response"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 0,
        borderRadius: 14,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        overflow: "hidden",
        marginBottom: 16,
      }}>
        {[
          { label: "Answers", value: `${response.answer_count} / ${response.total_questions}`, hint: "Questions answered", icon: "check" },
          { label: "Submitted", value: submitted.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), hint: submitted.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), icon: "clock" },
          { label: "Telephone-ka milkiilaha", value: response.phone_number || "—", hint: response.guri_number ? `Guri ${response.guri_number}` : "Contact", icon: "mail" },
          { label: "Location", value: location, hint: response.latitude ? `${response.latitude}, ${response.longitude}` : "No coordinates", icon: "map" },
        ].map((k, i, arr) => (
          <div
            key={k.label}
            style={{
              padding: "20px 22px",
              borderRight: i < arr.length - 1 ? `1px solid ${C.tableSep}` : undefined,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.12), color: accent,
              marginBottom: 14,
            }}>
              <Icon name={k.icon} size={18} sw={1.8} />
            </div>
            <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 22, fontWeight: 700, color: C.txtPrimary, lineHeight: 1.2 }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 6, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 3 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="survey-response-profile-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 1.6fr)", gap: 16 }}>
        {/* Sidebar details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SurveyPanel C={C} accent={accent} isDark={isDark}>
            <SurveyPanelHeader C={C} accent={accent} isDark={isDark} title="Submission details" sub="Respondent metadata" />
            <div style={{ padding: "16px 20px 20px", display: "grid", gap: 10 }}>
              <DetailTile label="Survey" value={response.survey_name} C={C} icon="clipboard" />
              <DetailTile label="Guri number" value={response.guri_number || "—"} C={C} icon="home" />
              <DetailTile label="County" value={response.county_name || "—"} C={C} icon="map" />
              <DetailTile label="Sub-county" value={response.sub_county_name || "—"} C={C} icon="map" />
              {response.deadline_at && (
                <DetailTile
                  label="Deadline"
                  value={
                    <span style={{ color: response.is_deadline_expired ? "#ef4444" : C.txtPrimary }}>
                      {new Date(response.deadline_at).toLocaleString()}
                      {response.is_deadline_expired ? " · Expired" : ""}
                    </span>
                  }
                  C={C}
                  icon="clock"
                />
              )}
              {(response.context_object || response.context_id) && (
                <DetailTile
                  label="Context"
                  value={`${response.context_object || "—"}${response.context_id ? ` · ${response.context_id}` : ""}`}
                  C={C}
                  icon="open"
                />
              )}
            </div>
          </SurveyPanel>

          <SurveyPanel C={C} accent={accent} isDark={isDark}>
            <SurveyPanelHeader C={C} accent={accent} isDark={isDark} title="Completion" sub="Progress overview" />
            <div style={{ padding: "20px", display: "flex", alignItems: "center", gap: 20 }}>
              <ProgressRing pct={completionPct} accent={accent} C={C} />
              <div>
                <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 20, fontWeight: 700, color: C.txtPrimary }}>
                  {response.answer_count} of {response.total_questions}
                </div>
                <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 6 }}>
                  questions answered
                </div>
                <div style={{ marginTop: 12 }}>
                  <StatusBadge status={response.completion_status} />
                </div>
              </div>
            </div>
          </SurveyPanel>

          {files.length > 0 && (
            <SurveyPanel C={C} accent={accent} isDark={isDark}>
              <SurveyPanelHeader C={C} accent={accent} isDark={isDark} title="Attachments" sub={`${files.length} file${files.length === 1 ? "" : "s"}`} />
              <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {files.map((f) => {
                  const canPreview = isImageAttachmentUrl(f.url);
                  const commonStyle = {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: `1px solid ${C.tableSep}`,
                    background: C.inputBg,
                    color: accent,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--font-outfit)",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left" as const,
                  };
                  if (canPreview) {
                    return (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => setPreview({ label: f.label, url: f.url })}
                        style={{ ...commonStyle, borderStyle: "solid" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.url}
                          alt=""
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            objectFit: "cover",
                            flexShrink: 0,
                            background: isDark ? "#1a1510" : "#e2e8f0",
                          }}
                        />
                        <Icon name={f.icon} size={16} sw={1.8} />
                        {f.label}
                        <span style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12, fontWeight: 500 }}>
                          Preview
                        </span>
                      </button>
                    );
                  }
                  return (
                    <a
                      key={f.label}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={commonStyle}
                    >
                      <Icon name={f.icon} size={16} sw={1.8} />
                      {f.label}
                      <span style={{ marginLeft: "auto", opacity: 0.6 }}>
                        <Icon name="open" size={14} sw={1.8} />
                      </span>
                    </a>
                  );
                })}
              </div>
            </SurveyPanel>
          )}
        </div>

        {/* Answers */}
        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title="Questionnaire responses"
            sub={response.answers.length === 0 ? "No answers recorded" : `${response.answers.length} answer${response.answers.length === 1 ? "" : "s"}`}
          />
          <div style={{ padding: "16px 20px 24px" }}>
            {response.answers.length === 0 ? (
              <SurveyEmptyState
                C={C}
                accent={accent}
                icon="file"
                title="No answers"
                message="This submission was started but no answers were saved."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {response.answers.map((answer, i) => (
                  <AnswerCard key={answer.id} answer={answer} index={i} C={C} accent={accent} isDark={isDark} />
                ))}
              </div>
            )}
          </div>
        </SurveyPanel>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .survey-response-profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </SurveyPageRoot>
  );
}

export function SurveyResponseProfilePage({
  responseId,
  onBack,
  C,
  accent,
  isDark,
}: {
  responseId: number;
  onBack?: () => void;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const router = useRouter();
  const { data, isLoading, isError } = useSurveyResponse(responseId);

  const handleBack = onBack ?? (() => router.push("/dashboard/survey"));

  if (isLoading) return <ProfileSkeleton C={C} accent={accent} isDark={isDark} />;

  if (isError || !data) {
    return (
      <SurveyPageRoot>
        <button type="button" onClick={handleBack} style={{
          display: "inline-flex", alignItems: "center", gap: 8, border: "none",
          background: "transparent", color: C.txtMuted, cursor: "pointer",
          fontFamily: "var(--font-outfit)", marginBottom: 20,
        }}>
          <Icon name="arrow-left" size={16} /> Back to responses
        </button>
        <SurveyEmptyState
          C={C}
          accent={accent}
          icon="alert"
          title="Response not found"
          message="This submission could not be loaded or may have been removed."
        />
      </SurveyPageRoot>
    );
  }

  return (
    <ResponseProfileContent
      response={data}
      C={C}
      accent={accent}
      isDark={isDark}
      onBack={handleBack}
    />
  );
}
