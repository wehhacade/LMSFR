"use client";

import { useRef, type ReactNode } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useDeleteDisarmamentImage,
  useDisarmamentRecord,
  usePersonHistory,
  useUploadDisarmamentImage,
} from "@/hooks/use-hubkadhigis";
import { ShimmerSuspectProfile } from "./shimmer";
import { type AccountsThemeColors } from "./accounts-shared";
import { usePermissions } from "@/hooks/use-permissions";
import { HubRecordThumbStack } from "./hubkadhigis-record-thumb";
import {
  formatRecordDate,
  personImageUrl,
  recordStatus,
  weaponImageUrl,
} from "@/lib/record-display";
import type { DisarmamentDetail, DisarmamentRecord } from "@/types/hubkadhigis";

type ThemeColors = AccountsThemeColors & {
  cardBdr: string;
  cardShadow: string;
  panelShadow: string;
  txtMuted: string;
  panelBg?: string;
  tableSep?: string;
  inputBg?: string;
};

function personInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function StatusPill({
  status,
  t,
  large,
}: {
  status: ReturnType<typeof recordStatus>;
  t: ReturnType<typeof getDict>;
  large?: boolean;
}) {
  const handed = status === "handed_over";
  const color = handed ? "#059669" : "#C69049";
  const bg = handed ? "rgba(5,150,105,0.1)" : "rgba(198,144,73,0.12)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: large ? "7px 14px" : "5px 11px",
      borderRadius: 999,
      fontSize: large ? 13 : 12,
      fontWeight: 700,
      color,
      background: bg,
      border: `1px solid ${hexA(color, 0.28)}`,
      fontFamily: "var(--font-outfit)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {handed ? t.hubStatusHandedOver : t.hubStatusRegistered}
    </span>
  );
}

function DetailTile({
  label,
  value,
  C,
  icon,
  accent,
}: {
  label: string;
  value?: ReactNode;
  C: ThemeColors;
  icon?: string;
  accent: string;
}) {
  const text = value === undefined || value === null || value === "" ? "—" : value;
  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: 12,
      border: `1px solid ${C.tableSep ?? hexA(accent, 0.12)}`,
      background: C.inputBg ?? hexA(accent, 0.03),
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
        textTransform: "uppercase", color: C.txtMuted, marginBottom: 8,
        fontFamily: "var(--font-outfit)",
      }}>
        {icon && <Icon name={icon} size={12} sw={1.8} />}
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: C.txtPrimary,
        fontFamily: "var(--font-outfit)", lineHeight: 1.45,
      }}>
        {text}
      </div>
    </div>
  );
}

function PhotoFrame({
  url,
  label,
  fallback,
  accent,
  border,
  isDark,
}: {
  url?: string | null;
  label: string;
  fallback: string;
  accent: string;
  border: string;
  isDark: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
        textTransform: "uppercase", color: "var(--hub-muted)",
        marginBottom: 10, fontFamily: "var(--font-outfit)",
      }}>
        {label}
      </div>
      <div style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${border}`,
        background: isDark ? hexA(accent, 0.08) : hexA(accent, 0.05),
        aspectRatio: "4/3",
        minHeight: 220,
        position: "relative",
        boxShadow: isDark ? "none" : "0 8px 28px -12px rgba(15,23,42,0.12)",
      }}>
        {url ? (
          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-cinzel)", fontSize: 42, fontWeight: 700,
            color: hexA(accent, 0.45),
          }}>
            {fallback}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTimeline({
  records,
  currentId,
  accent,
  C,
  isDark,
  t,
  onOpenRecord,
}: {
  records: DisarmamentRecord[];
  currentId: number;
  accent: string;
  C: ThemeColors;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
  onOpenRecord: (id: number) => void;
}) {
  if (records.length <= 1) return null;

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid ${C.cardBdr}`,
      background: C.panelBg ?? C.cardBg,
      boxShadow: C.panelShadow,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      <div style={{
        padding: "18px 22px",
        borderBottom: `1px solid ${C.tableSep ?? hexA(accent, 0.12)}`,
        background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
          }}>
            <Icon name="clock" size={16} sw={1.8} />
            <h2 style={{
              margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 17, fontWeight: 700,
              color: C.txtPrimary,
            }}>
              {t.hubPersonHistoryTitle}
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            {t.hubPersonHistorySub}
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
          textTransform: "uppercase", color: accent,
          fontFamily: "var(--font-outfit)",
          padding: "6px 12px",
          borderRadius: 999,
          background: hexA(accent, 0.1),
          border: `1px solid ${hexA(accent, 0.22)}`,
        }}>
          {t.hubPersonHistoryCount.replace("{n}", String(records.length))}
        </span>
      </div>

      <div style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {records.map((entry, index) => {
            const isCurrent = entry.id === currentId;
            const status = recordStatus(entry);
            const dateLabel = formatRecordDate(entry.surrender_date ?? entry.created_at);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => !isCurrent && onOpenRecord(entry.id)}
                style={{
                  display: "flex",
                  gap: 14,
                  textAlign: "left",
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: `1px solid ${isCurrent ? hexA(accent, 0.45) : C.cardBdr}`,
                  background: isCurrent
                    ? (isDark ? hexA(accent, 0.1) : hexA(accent, 0.06))
                    : (C.inputBg ?? C.cardBg),
                  cursor: isCurrent ? "default" : "pointer",
                  transition: "border-color .2s, transform .2s, box-shadow .2s",
                  boxShadow: isCurrent ? `0 0 0 3px ${hexA(accent, 0.1)}` : "none",
                }}
                onMouseEnter={(e) => {
                  if (isCurrent) return;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = hexA(accent, 0.35);
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  if (isCurrent) return;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.cardBdr;
                  (e.currentTarget as HTMLButtonElement).style.transform = "";
                }}
              >
                <div style={{ width: 16, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: index === 0 ? accent : (C.tableSep ?? "#d1d5db"),
                    border: `2px solid ${isCurrent ? hexA(accent, 0.35) : C.cardBdr}`,
                    boxShadow: index === 0 ? `0 0 0 4px ${hexA(accent, 0.15)}` : "none",
                  }} />
                  {index < records.length - 1 && (
                    <span style={{ flex: 1, width: 2, background: C.tableSep ?? "#e5e7eb", marginTop: 6, minHeight: 24 }} />
                  )}
                </div>

                <HubRecordThumbStack
                  weaponUrl={weaponImageUrl(entry)}
                  personUrl={personImageUrl(entry)}
                  personName={entry.person_name}
                  size={48}
                  border={C.cardBdr}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: accent, fontFamily: "var(--font-outfit)" }}>
                        {entry.reference_number}
                      </div>
                      <div style={{
                        fontSize: 15, fontWeight: 700, color: C.txtPrimary, marginTop: 4,
                        fontFamily: "var(--font-outfit)",
                      }}>
                        {[entry.weapon_type_name, entry.weapon_serial].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)" }}>
                        {dateLabel ?? "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <StatusPill status={status} t={t} />
                      {isCurrent ? (
                        <span style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: ".06em",
                          textTransform: "uppercase", color: accent,
                          fontFamily: "var(--font-outfit)",
                        }}>
                          {t.hubPersonHistoryCurrent}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: accent,
                          fontFamily: "var(--font-outfit)",
                        }}>
                          {t.hubPersonHistoryView} ›
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProfileContent({
  record,
  C,
  accent,
  isDark,
  t,
  allowEdit,
  allowAdd,
  onBack,
  onEdit,
  onRegisterNew,
  onOpenRecord,
}: {
  record: DisarmamentDetail;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
  allowEdit: boolean;
  allowAdd: boolean;
  onBack: () => void;
  onEdit: () => void;
  onRegisterNew: (record: DisarmamentDetail) => void;
  onOpenRecord: (id: number) => void;
}) {
  const upload = useUploadDisarmamentImage(record.id);
  const removeImage = useDeleteDisarmamentImage(record.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: history } = usePersonHistory(record);

  const weaponUrl = weaponImageUrl(record);
  const personUrl = personImageUrl(record);
  const status = recordStatus(record);
  const surrenderLabel = formatRecordDate(record.surrender_date);
  const createdLabel = formatRecordDate(record.created_at);
  const officerName = record.registered_officer?.full_name || record.registered_officer?.email;
  const historyRecords = history?.records ?? [record];
  const priorCount = Math.max(0, historyRecords.length - 1);
  const sep = C.tableSep ?? hexA(accent, 0.12);
  const grad = `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.55)})`;

  const cssVars = {
    "--hub-muted": C.txtMuted,
    "--hub-text": isDark ? "#f3f4f6" : "#111827",
  } as React.CSSProperties;

  const kpis = [
    { label: t.hubWeaponType, value: record.weapon_type_name, icon: "target" },
    { label: t.hubWeaponSerial, value: record.weapon_serial, icon: "archive" },
    { label: t.hubSurrenderDate, value: surrenderLabel ?? createdLabel, icon: "calendar" },
    {
      label: t.hubPersonHistoryTitle,
      value: priorCount > 0 ? `${priorCount} prior` : "First record",
      icon: "clock",
    },
  ];

  return (
    <div style={{ ...cssVars, paddingBottom: 48 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          border: "none", background: "transparent", color: C.txtMuted,
          cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 14,
          fontWeight: 500, marginBottom: 18, padding: 0,
        }}
      >
        <Icon name="arrow-left" size={16} sw={2} />
        {t.backToList}
      </button>

      {/* Hero */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 18,
        border: `1px solid ${C.cardBdr}`, background: C.cardBg,
        boxShadow: C.cardShadow, marginBottom: 16,
      }}>
        {!isDark && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 4,
            background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.35)})`,
          }} />
        )}
        <div style={{
          position: "absolute", top: -80, right: -40, width: 280, height: 280,
          borderRadius: "50%", background: hexA(accent, isDark ? 0.08 : 0.06),
          pointerEvents: "none",
        }} />

        <div style={{
          padding: "26px 28px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 20, flexWrap: "wrap", position: "relative",
        }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", minWidth: 0, flex: "1 1 300px" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 88, height: 88, borderRadius: 22, overflow: "hidden",
                border: `3px solid ${hexA(accent, 0.25)}`,
                boxShadow: `0 12px 32px ${hexA(accent, 0.25)}`,
                background: hexA(accent, 0.1),
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {personUrl ? (
                  <img src={personUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{
                    fontFamily: "var(--font-cinzel)", fontSize: 28, fontWeight: 700, color: accent,
                  }}>
                    {personInitials(record.person_name) || "?"}
                  </span>
                )}
              </div>
              {weaponUrl && (
                <div style={{
                  position: "absolute", right: -8, bottom: -8,
                  width: 38, height: 38, borderRadius: 11, overflow: "hidden",
                  border: `2px solid ${C.cardBg}`, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}>
                  <img src={weaponUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
            </div>

            <div style={{ minWidth: 0, paddingTop: 4 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: ".12em",
                textTransform: "uppercase", color: accent, marginBottom: 8,
                fontFamily: "var(--font-outfit)",
              }}>
                {t.hubProfileSubtitle}
              </div>
              <h1 style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: "clamp(24px, 3.2vw, 34px)",
                fontWeight: 700, color: C.txtPrimary, margin: "0 0 8px", lineHeight: 1.15,
              }}>
                {record.person_name}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: accent,
                  fontFamily: "var(--font-outfit)", letterSpacing: ".02em",
                }}>
                  {record.reference_number}
                </span>
                <StatusPill status={status} t={t} large />
              </div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 14,
                fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)",
              }}>
                {record.rank_name && <span>{record.rank_name}</span>}
                {record.force_unit_name && <span>{record.force_unit_name}</span>}
                {record.phone_number && <span>{record.phone_number}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {allowAdd && (
              <button
                type="button"
                onClick={() => onRegisterNew(record)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 16px", borderRadius: 11,
                  border: `1px solid ${hexA(accent, 0.35)}`,
                  background: hexA(accent, 0.08), color: accent,
                  fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <Icon name="plus" size={16} sw={2} />
                {t.hubRegisterNewWeapon}
              </button>
            )}
            {allowEdit && (
              <button
                type="button"
                onClick={onEdit}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 18px", borderRadius: 11, border: "none",
                  background: grad, color: "#fff",
                  fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14,
                  cursor: "pointer",
                  boxShadow: `0 8px 24px -8px ${hexA(accent, 0.5)}`,
                }}
              >
                <Icon name="edit" size={16} sw={2} />
                {t.editAction}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}>
        {kpis.map((k) => (
          <div key={k.label} style={{
            padding: "16px 18px", borderRadius: 14,
            border: `1px solid ${C.cardBdr}`,
            background: C.panelBg ?? C.cardBg,
            boxShadow: isDark ? "none" : "0 1px 3px rgba(15,23,42,.04)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
              fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
              textTransform: "uppercase", color: C.txtMuted,
              fontFamily: "var(--font-outfit)",
            }}>
              <Icon name={k.icon} size={12} sw={1.8} />
              {k.label}
            </div>
            <div style={{
              fontFamily: "var(--font-cinzel)", fontSize: 20, fontWeight: 700,
              color: C.txtPrimary, lineHeight: 1.2,
            }}>
              {k.value || "—"}
            </div>
          </div>
        ))}
      </div>

      <HistoryTimeline
        records={historyRecords}
        currentId={record.id}
        accent={accent}
        C={C}
        isDark={isDark}
        t={t}
        onOpenRecord={onOpenRecord}
      />

      {/* Intel panels */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}>
        <div style={{
          borderRadius: 16, border: `1px solid ${C.cardBdr}`,
          background: C.panelBg ?? C.cardBg, boxShadow: C.panelShadow,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: `1px solid ${sep}`,
            background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="target" size={18} sw={1.8} />
            <h3 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 16, fontWeight: 700 }}>
              {t.hubWeaponInfoTitle}
            </h3>
          </div>
          <div style={{ padding: "18px 20px", display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <DetailTile label={t.hubWeaponType} value={record.weapon_type_name} C={C} accent={accent} icon="target" />
              <DetailTile label={t.hubWeaponSerial} value={record.weapon_serial} C={C} accent={accent} icon="archive" />
              <DetailTile label={t.hubSurrenderLocation} value={record.surrender_location_name} C={C} accent={accent} icon="map" />
              <DetailTile label={t.hubSurrenderDate} value={surrenderLabel} C={C} accent={accent} icon="calendar" />
            </div>
            <PhotoFrame
              url={weaponUrl}
              label={t.hubWeaponPhoto}
              fallback="H"
              accent={accent}
              border={C.cardBdr}
              isDark={isDark}
            />
          </div>
        </div>

        <div style={{
          borderRadius: 16, border: `1px solid ${C.cardBdr}`,
          background: C.panelBg ?? C.cardBg, boxShadow: C.panelShadow,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: `1px solid ${sep}`,
            background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="users" size={18} sw={1.8} />
            <h3 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 16, fontWeight: 700 }}>
              {t.hubPersonInfoTitle}
            </h3>
          </div>
          <div style={{ padding: "18px 20px", display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <DetailTile label={t.hubForceNumber} value={record.force_number} C={C} accent={accent} icon="badge" />
              <DetailTile label={t.hubAgency} value={record.force_unit_name} C={C} accent={accent} icon="shield" />
              <DetailTile label={t.hubSection} value={record.county_name} C={C} accent={accent} icon="map" />
              <DetailTile label={t.hubRank} value={record.rank_name} C={C} accent={accent} icon="badge" />
              <DetailTile label={t.hubPhone} value={record.phone_number} C={C} accent={accent} icon="send" />
              <DetailTile label={t.hubPoliceStation} value={record.police_station} C={C} accent={accent} icon="home" />
            </div>
            <PhotoFrame
              url={personUrl}
              label={t.hubPersonPhoto}
              fallback={personInitials(record.person_name) || "?"}
              accent={accent}
              border={C.cardBdr}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Meta row */}
      {(record.details?.trim() || officerName) && (
        <div style={{
          borderRadius: 14, border: `1px solid ${C.cardBdr}`,
          background: C.panelBg ?? C.cardBg, padding: "18px 22px",
          marginBottom: 16, display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16,
        }}>
          {record.details?.trim() && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
                textTransform: "uppercase", color: C.txtMuted, marginBottom: 8,
                fontFamily: "var(--font-outfit)",
              }}>
                {t.hubHistoryDetails}
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>
                {record.details}
              </p>
            </div>
          )}
          {officerName && (
            <DetailTile label={t.hubRegisteredBy} value={officerName} C={C} accent={accent} icon="users" />
          )}
        </div>
      )}

      {/* Evidence gallery */}
      <div style={{
        borderRadius: 16, border: `1px solid ${C.cardBdr}`,
        background: C.panelBg ?? C.cardBg, boxShadow: C.panelShadow, overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${sep}`,
          background: isDark ? hexA(accent, 0.04) : "#FAFAF9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="grid" size={18} sw={1.8} />
            <h3 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 16, fontWeight: 700 }}>
              {t.hubEvidenceGallery}
            </h3>
          </div>
          {allowEdit && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "9px 14px", borderRadius: 10, border: "none",
                  background: grad, color: "#fff",
                  fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 13,
                  cursor: upload.isPending ? "wait" : "pointer",
                  opacity: upload.isPending ? 0.7 : 1,
                }}
              >
                <Icon name="plus" size={15} sw={2} />
                {t.hubUploadImage}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate({ file });
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
        <div style={{ padding: "20px 22px" }}>
          {record.images.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "36px 16px", color: C.txtMuted,
              fontFamily: "var(--font-outfit)", fontSize: 14,
            }}>
              {t.hubNoResults}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {record.images.map((img) => (
                <div
                  key={img.id}
                  style={{
                    borderRadius: 12, overflow: "hidden",
                    border: `1px solid ${C.cardBdr}`,
                    background: C.inputBg ?? C.cardBg,
                    boxShadow: isDark ? "none" : "0 2px 8px rgba(15,23,42,.05)",
                  }}
                >
                  {img.file_url && (
                    <img src={img.file_url} alt={img.caption} style={{ width: "100%", height: 120, objectFit: "cover" }} />
                  )}
                  <div style={{
                    padding: "8px 10px", fontSize: 11, color: C.txtMuted,
                    display: "flex", justifyContent: "space-between", gap: 6,
                    fontFamily: "var(--font-outfit)",
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {img.caption || img.weapon_serial || "—"}
                    </span>
                    {allowEdit && (
                      <button
                        type="button"
                        onClick={() => removeImage.mutate(img.id)}
                        style={{ border: "none", background: "transparent", color: "#e0655a", cursor: "pointer", flexShrink: 0 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HubkadhigisProfilePage({
  recordId,
  onBack,
  onEdit,
  onRegisterNew,
  onOpenRecord,
  C,
  accent,
  isDark,
}: {
  recordId: number;
  onBack: () => void;
  onEdit: () => void;
  onRegisterNew: (record: DisarmamentDetail) => void;
  onOpenRecord: (id: number) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { canEdit, canAdd } = usePermissions();
  const { data: record, isLoading } = useDisarmamentRecord(recordId);

  if (isLoading || !record) return <ShimmerSuspectProfile />;

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both" }}>
      <ProfileContent
        record={record}
        C={C}
        accent={accent}
        isDark={isDark}
        t={t}
        allowEdit={canEdit("records")}
        allowAdd={canAdd("records")}
        onBack={onBack}
        onEdit={onEdit}
        onRegisterNew={onRegisterNew}
        onOpenRecord={onOpenRecord}
      />
    </div>
  );
}
