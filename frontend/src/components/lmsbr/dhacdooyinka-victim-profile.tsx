"use client";

import { useState } from "react";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";
import type { AccountsThemeColors } from "./accounts-shared";
import type { DhacdooyinkaDetail, DhacdooyinkaVictim } from "@/types/dhacdooyinka";
import { DhacdoDocumentGallery, isImageDocUrl } from "./dhacdooyinka-documents";

type ThemeColors = AccountsThemeColors;

function Panel({ children, C }: { children: React.ReactNode; C: ThemeColors }) {
  return (
    <div style={{
      padding: "22px 24px", borderRadius: 16,
      background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow,
    }}>
      {children}
    </div>
  );
}

function SidebarStat({
  label, value, C, accent, icon, highlight,
}: {
  label: string;
  value: React.ReactNode;
  C: ThemeColors;
  accent: string;
  icon: string;
  highlight?: string;
}) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: C.inputBg ?? hexA(accent, 0.04),
      border: `1px solid ${C.tableSep}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
        fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
        textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)",
      }}>
        <Icon name={icon} size={12} sw={1.8} />
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: highlight ?? C.txtPrimary,
        fontFamily: "var(--font-outfit)", lineHeight: 1.45,
      }}>
        {value}
      </div>
    </div>
  );
}

export function DhacdooyinkaVictimProfile({
  victim,
  event,
  onBack,
  onOpenEvent,
  C,
  accent,
  isDark,
  t,
}: {
  victim: DhacdooyinkaVictim;
  event: DhacdooyinkaDetail;
  onBack: () => void;
  onOpenEvent?: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
}) {
  const documents = victim.documents ?? [];
  const firstDoc = documents.find((d) => d.document_url) ?? null;
  const firstDocUrl = firstDoc?.document_url
    ? (resolveMediaUrl(firstDoc.document_url) ?? firstDoc.document_url)
    : null;
  const firstDocIsImage = firstDocUrl ? isImageDocUrl(firstDocUrl) : false;
  const [photoFailed, setPhotoFailed] = useState(false);
  const executedDate = event.taariikhda_dhacdada ?? event.date_opp;

  return (
    <div style={{ animation: "is-fadeUp .4s ease both" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: 20,
      }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px",
            borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.cardBg,
            color: C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)",
            fontSize: 13.5,
          }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}>
            <Icon name="arrow" size={15} sw={2} />
          </span>
          {t.dhacdoBackToVictims}
        </button>
      </div>

      <div className="lmsbr-split-aside" style={{
        display: "grid", gridTemplateColumns: "minmax(260px,300px) 1fr",
        gap: 24, alignItems: "start",
      }}>
        <div style={{
          borderRadius: 18, overflow: "hidden",
          background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow,
          position: "sticky", top: 16,
        }}>
          {firstDocUrl && firstDocIsImage && !photoFailed ? (
            <div style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 5",
              background: isDark ? "rgba(0,0,0,0.35)" : "#e8edf2",
              borderBottom: `1px solid ${C.cardBdr}`,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={firstDocUrl}
                alt={firstDoc?.name || victim.magaca || "Victim"}
                onError={() => setPhotoFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                padding: "48px 18px 16px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.72))",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.72)",
                  fontFamily: "var(--font-outfit)", marginBottom: 4,
                }}>
                  {t.dhacdoVictimProfileTitle}
                </div>
                <h2 style={{
                  margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 22,
                  fontWeight: 700, color: "#fff", lineHeight: 1.2,
                }}>
                  {victim.magaca || "—"}
                </h2>
                {victim.xalada && (
                  <span style={{
                    display: "inline-block", marginTop: 10,
                    padding: "5px 12px", borderRadius: 999,
                    fontSize: 12, fontWeight: 600, fontFamily: "var(--font-outfit)",
                    background: hexA("#fff", 0.18), color: "#fff",
                    border: `1px solid ${hexA("#fff", 0.28)}`,
                  }}>
                    {victim.xalada}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              padding: "28px 22px 24px",
              background: isDark
                ? `linear-gradient(160deg, ${hexA(accent, 0.32)}, ${hexA("#2563eb", 0.18)})`
                : `linear-gradient(160deg, ${hexA(accent, 0.2)}, ${hexA("#2563eb", 0.06)})`,
              borderBottom: `1px solid ${C.cardBdr}`,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA("#fff", isDark ? 0.12 : 0.65),
                border: `1px solid ${hexA("#fff", 0.25)}`, marginBottom: 16,
              }}>
                <Icon name={firstDocUrl ? "archive" : "users"} size={26} sw={1.8} />
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
                textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)",
                marginBottom: 6,
              }}>
                {t.dhacdoVictimProfileTitle}
              </div>
              <h2 style={{
                margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 22,
                fontWeight: 700, color: C.txtPrimary, lineHeight: 1.2,
              }}>
                {victim.magaca || "—"}
              </h2>
              {victim.xalada && (
                <span style={{
                  display: "inline-block", marginTop: 14,
                  padding: "5px 12px", borderRadius: 999,
                  fontSize: 12, fontWeight: 600, fontFamily: "var(--font-outfit)",
                  background: hexA(accent, 0.14), color: accent,
                  border: `1px solid ${hexA(accent, 0.28)}`,
                }}>
                  {victim.xalada}
                </span>
              )}
            </div>
          )}

          <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            <SidebarStat label={t.dhacdoVictimAge} value={victim.dada_dh || "—"} C={C} accent={accent} icon="users" />
            <SidebarStat label={t.dhacdoVictimGender} value={victim.gender || "—"} C={C} accent={accent} icon="users" />
            <SidebarStat label={t.dhacdoVictimPhone} value={victim.phone || "—"} C={C} accent={accent} icon="badge" />

            <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.tableSep}` }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
                textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)",
                marginBottom: 8,
              }}>
                {t.dhacdoLinkedEvent}
              </div>
              <button
                type="button"
                onClick={onOpenEvent}
                style={{
                  width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12,
                  border: `1px solid ${hexA(accent, 0.3)}`, background: hexA(accent, 0.06),
                  cursor: onOpenEvent ? "pointer" : "default", fontFamily: "var(--font-outfit)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                  {event.tixraac_lambar || "—"}
                </div>
                <div style={{ fontSize: 12, color: C.txtSecondary, marginTop: 4 }}>
                  {event.nooca_dhacdada_name || event.location_display}
                </div>
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel C={C}>
            <div style={{
              fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18,
              color: C.txtPrimary, marginBottom: 20,
            }}>
              {t.dhacdoTabFaahfaahin}
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14,
            }}>
              {[
                { label: t.dhacdoVictimName, value: victim.magaca },
                { label: t.dhacdoVictimAge, value: victim.dada_dh },
                { label: t.dhacdoVictimGender, value: victim.gender },
                { label: t.dhacdoVictimPhone, value: victim.phone },
                { label: t.dhacdoVictimStatus, value: victim.xalada },
                { label: t.dhacdoColTx, value: event.tixraac_lambar },
                { label: t.dhacdoNoocaType, value: event.nooca_dhacdada_name },
                { label: t.dhacdoLocation, value: event.location_display },
              ].map((row) => (
                <div key={row.label} style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead,
                  border: `1px solid ${C.tableSep}`,
                }}>
                  <div style={{
                    fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
                    color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 6,
                  }}>
                    {row.label}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 500, color: C.txtPrimary,
                    fontFamily: "var(--font-outfit)",
                  }}>
                    {row.value || "—"}
                  </div>
                </div>
              ))}
            </div>

            {victim.fahfaahin?.trim() && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.tableSep}` }}>
                <div style={{
                  fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
                  color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 10,
                }}>
                  {t.dhacdoVictimDetails}
                </div>
                <p style={{
                  margin: 0, fontSize: 14.5, lineHeight: 1.65, color: C.txtSecondary,
                  fontFamily: "var(--font-outfit)", whiteSpace: "pre-wrap",
                }}>
                  {victim.fahfaahin}
                </p>
              </div>
            )}

            {executedDate && (
              <div style={{
                marginTop: 20, fontSize: 12.5, color: C.txtMuted, fontFamily: "var(--font-outfit)",
              }}>
                {t.dhacdoTaariikhda}: {new Date(executedDate).toLocaleDateString(undefined, {
                  year: "numeric", month: "long", day: "numeric",
                })}
              </div>
            )}
          </Panel>

          <Panel C={C}>
            <div style={{
              fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18,
              color: C.txtPrimary, marginBottom: 16,
            }}>
              {t.dhacdoTabDocuments}
            </div>
            <DhacdoDocumentGallery
              docs={(documents ?? [])
                .filter((d): d is { id: number; name?: string | null; document_url: string } => Boolean(d.document_url))
                .map((d) => ({
                  id: d.id,
                  label: d.name || `${t.dhacdoOpenDocument} #${d.id}`,
                  url: d.document_url,
                }))}
              emptyMessage={t.dhacdoNoDocument}
              openLabel={t.dhacdoOpenDocument}
              C={C}
              accent={accent}
              isDark={isDark}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
