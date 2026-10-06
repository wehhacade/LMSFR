"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { formatCaptureDateTime } from "@/lib/lmsbr/suspect-utils";
import { Icon } from "./icon";
import { ShimmerSuspectProfile } from "./shimmer";
import { useVisitor } from "@/hooks/use-visitors";
import type { AccountsThemeColors } from "./accounts-shared";
import type { VisitHistoryItem, Visitor } from "@/types/visitors";

type ThemeColors = AccountsThemeColors & {
  cardShadow?: string;
  panelShadow?: string;
  tableSep: string;
  panelBg: string;
  cardBg: string;
  cardBdr: string;
  inputBdr: string;
  txtPrimary: string;
  txtSecondary: string;
  txtMuted: string;
};

type TabId = "faahfaahin" | "history";

function Panel({ children, C }: { children: React.ReactNode; C: ThemeColors }) {
  return (
    <div style={{
      padding: "22px 24px", borderRadius: 16, background: C.panelBg,
      border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow,
    }}>
      {children}
    </div>
  );
}

function FieldCard({
  label, value, C, accent, isDark, highlight,
}: {
  label: string; value: string; C: ThemeColors; accent: string; isDark: boolean; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
      border: `1px solid ${C.tableSep}`,
    }}>
      <div style={{
        fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
        color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 15, fontWeight: highlight ? 600 : 500,
        color: highlight ? accent : C.txtPrimary, fontFamily: "var(--font-outfit)",
      }}>{value || "—"}</div>
    </div>
  );
}

function genderLabel(g: string, so: boolean) {
  if (g === "m") return so ? "Lab" : "Male";
  if (g === "f") return so ? "Dhedig" : "Female";
  if (g === "other") return so ? "Kan kale" : "Other";
  return g || "—";
}

function relativeVisitTime(value: string | null | undefined, so: boolean, now: number): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return so ? "Hadda" : "Just now";
  if (minutes < 60) return so ? `${minutes} daqiiqo ka hor` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return so ? `${hours} saac ka hor` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return so ? `${days} maalin ka hor` : `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return so ? `${weeks} isbuuc ka hor` : `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return so ? `${months} bil ka hor` : `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return so ? `${years} sano ka hor` : `${years} year${years === 1 ? "" : "s"} ago`;
}

function VisitTimeline({
  visits, C, accent, so, now,
}: {
  visits: VisitHistoryItem[];
  C: ThemeColors;
  accent: string;
  so: boolean;
  now: number;
}) {
  if (!visits.length) {
    return (
      <p style={{ margin: 0, textAlign: "center", padding: "28px 0", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {so ? "Weli booqasho lama diiwaangelin" : "No visits recorded yet"}
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {visits.map((visit, idx) => {
        const captured = formatCaptureDateTime(visit.visited_at);
        const isLatest = idx === 0;
        const visitNumber = visits.length - idx;
        const relativeTime = relativeVisitTime(visit.visited_at, so, now);
        return (
          <div
            key={visit.id}
            style={{
              display: "grid", gridTemplateColumns: "28px 1fr", gap: 14,
              paddingBottom: idx === visits.length - 1 ? 0 : 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: isLatest ? accent : hexA(accent, 0.12), color: isLatest ? "#fff" : accent,
                border: `1px solid ${isLatest ? accent : hexA(accent, 0.28)}`,
                fontSize: 11, fontWeight: 700, fontFamily: "var(--font-outfit)",
              }}>{visitNumber}</div>
              {idx < visits.length - 1 && (
                <div style={{ flex: 1, width: 2, marginTop: 6, background: hexA(accent, 0.2) }} />
              )}
            </div>
            <div style={{
              padding: "16px 18px", borderRadius: 14,
              border: `1px solid ${isLatest ? hexA(accent, 0.4) : C.tableSep}`,
              background: isLatest ? hexA(accent, 0.06) : C.cardBg,
              boxShadow: isLatest ? `0 8px 20px ${hexA(accent, 0.08)}` : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 4 }}>
                    {so ? `Booqashada ${visitNumber}aad` : `Visit ${visitNumber}`}
                  </div>
                  <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
                    {visit.visiting || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {isLatest && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999,
                      background: hexA(accent, 0.15), color: accent, fontFamily: "var(--font-outfit)",
                    }}>{so ? "Ugu dambeeyay" : "Latest"}</span>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999,
                    background: hexA(visit.verified ? "#059669" : accent, 0.15),
                    color: visit.verified ? "#059669" : accent, fontFamily: "var(--font-outfit)",
                  }}>{visit.verified ? "Verified" : "Pending"}</span>
                </div>
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8,
                marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.tableSep}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                  <span style={{ display: "flex", color: accent }}><Icon name="users" size={15} sw={1.8} /></span>
                  <span><span style={{ color: C.txtMuted }}>{so ? "Diiwaangeliyey" : "Registered by"}: </span>{visit.created_by_name || "—"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                  <span style={{ display: "flex", color: accent }}><Icon name="clock" size={15} sw={1.8} /></span>
                  <span>
                    <span style={{ color: C.txtMuted }}>{so ? "Waqtiga" : "Time"}: </span>
                    {captured ? `${captured.date} · ${captured.time}` : "—"}
                    <span style={{ marginLeft: 6, color: accent, fontWeight: 600 }}>· {relativeTime}</span>
                  </span>
                </div>
              </div>
              {(visit.contact_name || visit.relationship || visit.allegation_name || visit.sentence) && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12.5, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                  {visit.contact_name && (
                    <div style={{ padding: "6px 9px", borderRadius: 8, background: hexA(accent, 0.07) }}>
                      <span style={{ color: C.txtMuted }}>{so ? "Qofka loo socdo" : "Person visited"}: </span>{visit.contact_name}
                    </div>
                  )}
                  {visit.relationship && (
                    <div style={{ padding: "6px 9px", borderRadius: 8, background: hexA(accent, 0.07) }}>
                      <span style={{ color: C.txtMuted }}>{so ? "Xiriirka" : "Relationship"}: </span>{visit.relationship}
                    </div>
                  )}
                  {visit.allegation_name && (
                    <div style={{ padding: "6px 9px", borderRadius: 8, background: hexA("#e0655a", 0.09), color: "#c24138" }}>
                      <span style={{ color: C.txtMuted }}>{so ? "Eedda" : "Allegation"}: </span>{visit.allegation_name}
                    </div>
                  )}
                  {visit.sentence && (
                    <div style={{ padding: "6px 9px", borderRadius: 8, background: hexA("#5b9fd4", 0.09) }}>
                      <span style={{ color: C.txtMuted }}>{so ? "Xukun" : "Sentence"}: </span>{visit.sentence}
                    </div>
                  )}
                </div>
              )}
              {visit.notes ? (
                <div style={{ marginTop: 8, fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  {visit.notes}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VisitorsProfilePage({
  visitorId, onBack, C, accent, isDark, onEdit,
}: {
  visitorId: number;
  onBack: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  onEdit?: (visitor: Visitor) => void;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data, isLoading, isError } = useVisitor(visitorId);
  const [tab, setTab] = useState<TabId>("history");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !data) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", borderRadius: 14, background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
        <p style={{ color: C.txtSecondary }}>{so ? "Booqde lama helin" : "Visitor not found"}</p>
        <button type="button" onClick={onBack} style={{
          marginTop: 16, padding: "10px 18px", borderRadius: 10,
          border: `1px solid ${hexA(accent, 0.35)}`, background: hexA(accent, 0.1),
          color: accent, cursor: "pointer",
        }}>{so ? "Dib u noqo" : "Back"}</button>
      </div>
    );
  }

  const name = data.full_name || "—";
  const initials = name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  const visitCount = data.visit_count ?? data.visits?.length ?? 0;
  const visits = data.visits ?? [];
  const latest = formatCaptureDateTime(data.visited_at);
  const latestRelative = relativeVisitTime(data.visited_at, so, now);

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "history", label: so ? "Taariikhda booqashada" : "Visit history", icon: "clock" },
    { id: "faahfaahin", label: so ? "Faahfaahin" : "Details", icon: "users" },
  ];

  return (
    <div style={{ animation: "is-fadeUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px",
            borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.cardBg,
            color: C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 13.5,
          }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="arrow" size={15} sw={2} /></span>
          {so ? "Liiska" : "Back to list"}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(data)}
            style={{
              padding: "9px 16px", borderRadius: 10, border: "none", background: accent, color: "#fff",
              cursor: "pointer", fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 13.5,
            }}
          >
            {so ? "Wax ka beddel" : "Edit"}
          </button>
        )}
      </div>

      <div className="lmsbr-split-aside" style={{ display: "grid", gridTemplateColumns: "minmax(240px,300px) 1fr", gap: 24, alignItems: "start" }}>
        <div style={{
          borderRadius: 18, overflow: "hidden", background: C.cardBg,
          border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow,
        }}>
          <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", background: isDark ? "#1e293b" : "#f8fafc" }}>
            {data.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.image_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                background: `linear-gradient(160deg,${hexA(accent, 0.35)},${hexA(accent, 0.08)})`,
                fontFamily: "var(--font-cinzel)", fontSize: 48, fontWeight: 700, color: hexA(accent, 0.7),
              }}>{initials}</div>
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 55%,rgba(0,0,0,0.85) 100%)" }} />
            <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 20,
                background: hexA(data.verified ? "#059669" : accent, 0.92), color: "#fff", fontFamily: "var(--font-outfit)",
              }}>
                {data.verified ? "Verified" : "Pending"}
              </span>
              {visitCount > 1 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 20,
                  background: "rgba(0,0,0,0.55)", color: "#fff", fontFamily: "var(--font-outfit)",
                }}>
                  {so ? `Booqday ×${visitCount}` : `Visited ×${visitCount}`}
                </span>
              )}
            </div>
          </div>
          <div style={{ padding: "20px 22px 24px" }}>
            <h2 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 22, color: C.txtPrimary, margin: 0, lineHeight: 1.25 }}>
              {name}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {data.mother_name ? `${so ? "Hooyo" : "Mother"}: ${data.mother_name}` : ""}
            </p>
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.tableSep}`,
              display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: C.txtSecondary,
              fontFamily: "var(--font-outfit)",
            }}>
              <div style={{
                padding: "12px 13px", borderRadius: 12, border: `1px solid ${hexA(accent, 0.26)}`,
                background: hexA(accent, 0.07),
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, color: accent, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
                  <Icon name="clock" size={14} sw={2} />
                  {so ? "Booqashada ugu dambeysa" : "Latest visit"}
                </div>
                <div style={{ marginTop: 7, color: C.txtPrimary, fontWeight: 600, fontSize: 13.5 }}>
                  {latest ? `${latest.date} · ${latest.time}` : "—"}
                </div>
                <div style={{ marginTop: 5, fontSize: 12, color: accent, fontWeight: 600 }}>
                  {latestRelative}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", color: accent }}><Icon name="users" size={16} sw={1.8} /></span>
                {genderLabel(data.gender, so)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", color: accent }}><Icon name="badge" size={16} sw={1.8} /></span>
                {data.phone || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", color: accent }}><Icon name="clipboard" size={16} sw={1.8} /></span>
                NIRA: {data.nira || "—"}
              </div>
              {data.visiting && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", color: accent }}><Icon name="map" size={16} sw={1.8} /></span>
                  {so ? "Booqanaya" : "Visiting"}: {data.visiting}
                </div>
              )}
              {data.contact_name && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", color: accent }}><Icon name="users" size={16} sw={1.8} /></span>
                  {so ? "Qofka loo socdo" : "Person visited"}: {data.contact_name}
                </div>
              )}
              {data.relationship && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", color: accent }}><Icon name="link" size={16} sw={1.8} /></span>
                  {so ? "Xiriirka" : "Relationship"}: {data.relationship}
                </div>
              )}
              {data.allegation_name && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c24138" }}>
                  <span style={{ display: "flex" }}><Icon name="alert" size={16} sw={1.8} /></span>
                  {so ? "Eedda" : "Allegation"}: {data.allegation_name}
                </div>
              )}
              {data.sentence && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ display: "flex", color: "#5b9fd4", marginTop: 2 }}><Icon name="clipboard" size={16} sw={1.8} /></span>
                  <span>{so ? "Xukunka" : "Sentence"}: {data.sentence}</span>
                </div>
              )}
              {data.created_by_name && (
                <div style={{
                  marginTop: 2, padding: "10px 11px", borderRadius: 9,
                  border: `1px solid ${isDark ? C.tableSep : "rgba(17,24,39,0.16)"}`,
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(17,24,39,0.055)",
                  fontSize: 12.5, color: isDark ? C.txtPrimary : "#111827", fontWeight: 700,
                }}>
                  {so ? "Markii ugu horreysay diiwaangeliyey" : "First registered by"}: {data.created_by_name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 2, borderBottom: `1px solid ${C.tableSep}`,
            marginBottom: 24, overflowX: "auto",
          }}>
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "11px 16px", border: "none", cursor: "pointer",
                    background: "transparent", fontFamily: "var(--font-outfit)", fontSize: 13.5, fontWeight: on ? 600 : 400,
                    color: on ? accent : C.txtMuted, borderBottom: on ? `2px solid ${accent}` : "2px solid transparent",
                    marginBottom: "-1px", whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ display: "flex", color: on ? accent : C.txtMuted }}>
                    <Icon name={t.icon} size={15} sw={on ? 2.2 : 1.8} />
                  </span>
                  {t.label}
                  {t.id === "history" && visitCount > 0 ? ` (${visitCount})` : ""}
                </button>
              );
            })}
          </div>

          {tab === "history" ? (
            <Panel C={C}>
              <div style={{
                fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 17, color: C.txtPrimary, marginBottom: 16,
              }}>
                {so ? "Taariikhda booqashada" : "Visit history"}
                {visitCount > 1 ? (
                  <span style={{ marginLeft: 10, fontSize: 13, color: accent, fontFamily: "var(--font-outfit)" }}>
                    {so ? `Wuu soo booqday ×${visitCount}` : `Returned ×${visitCount}`}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: "-8px 0 18px", fontSize: 13, lineHeight: 1.55, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                {so
                  ? "Booqasho kasta waxay muujinaysaa qofkii diiwaangeliyey iyo waqtiga ay dhacday."
                  : "Each visit shows who registered it and when it was recorded."}
              </p>
              <VisitTimeline visits={visits} C={C} accent={accent} so={so} now={now} />
            </Panel>
          ) : (
            <Panel C={C}>
              <div style={{
                fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 17, color: C.txtPrimary, marginBottom: 16,
              }}>
                {so ? "Faahfaahinta booqde" : "Visitor details"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                <FieldCard label={so ? "Magaca" : "Full name"} value={data.full_name} C={C} accent={accent} isDark={isDark} highlight />
                <FieldCard label={so ? "Hooyo" : "Mother"} value={data.mother_name || "—"} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Jinsi" : "Gender"} value={genderLabel(data.gender, so)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Telefoon" : "Phone"} value={data.phone || "—"} C={C} accent={accent} isDark={isDark} />
                <FieldCard label="NIRA" value={data.nira || "—"} C={C} accent={accent} isDark={isDark} />
                <FieldCard
                  label={so ? "Cida la booqanayo" : "Visiting"}
                  value={data.visiting || "—"}
                  C={C}
                  accent={accent}
                  isDark={isDark}
                  highlight
                />
                <FieldCard
                  label={so ? "Magaca saddexan ee loo socdo" : "Person visited"}
                  value={data.contact_name || "—"}
                  C={C}
                  accent={accent}
                  isDark={isDark}
                />
                <FieldCard
                  label={so ? "Xiriirka ka dhexeeya" : "Relationship"}
                  value={data.relationship || "—"}
                  C={C}
                  accent={accent}
                  isDark={isDark}
                />
                <FieldCard
                  label={so ? "Eedda" : "Allegation"}
                  value={data.allegation_name || "—"}
                  C={C}
                  accent="#c24138"
                  isDark={isDark}
                  highlight
                />
                <FieldCard
                  label={so ? "Xukunka lagu riday" : "Sentence / judgment"}
                  value={data.sentence || "—"}
                  C={C}
                  accent="#5b9fd4"
                  isDark={isDark}
                />
                <FieldCard
                  label={so ? "Tirada booqashooyinka" : "Visit count"}
                  value={String(visitCount)}
                  C={C}
                  accent={accent}
                  isDark={isDark}
                />
                <FieldCard
                  label="Status"
                  value={data.verified ? "Verified" : "Pending"}
                  C={C}
                  accent={accent}
                  isDark={isDark}
                />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
