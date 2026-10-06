"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { SuspectPhoto } from "./suspect-photo";
import { suspectCaptureDistrict, tuhunkaColor, tuhunkaLabel } from "@/lib/lmsbr/suspect-utils";
import { BailCountBadge } from "./bail-count-badge";
import { Icon } from "./icon";
import {
  useCreateSuspectComment,
  useReleaseSuspect,
  useSuspect,
  useSuspectCases,
  useSuspectComments,
  useSuspectGuarantors,
  useUpdateDamiinPhotos,
} from "@/hooks/use-suspects";
import { ShimmerSuspectProfile } from "./shimmer";
import { PrimaryButton, type AccountsThemeColors } from "./accounts-shared";
import { toast } from "@/components/ui/use-toast";
import type { RegisteredOfficer, SuspectComment, SuspectGuarantor } from "@/types/suspect";

type ThemeColors = AccountsThemeColors & {
  cardShadow: string; panelShadow: string; tableSep: string;
};

type TabId = "faahfaahin" | "cases" | "damiinadataha" | "sarkaalka" | "comment";

function TabBar({
  active, onChange, accent, C,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  accent: string;
  C: ThemeColors;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "faahfaahin", label: t.tabFaahfaahin, icon: "users" },
    { id: "cases", label: t.tabCases, icon: "clipboard" },
    { id: "damiinadataha", label: t.tabDamiinadataha, icon: "shield" },
    { id: "sarkaalka", label: t.tabSarkaalka, icon: "badge" },
    { id: "comment", label: t.tabComment, icon: "send" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", borderBottom: `1px solid ${C.tableSep}`, marginBottom: "24px", overflowX: "auto" }}>
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            style={{
              display: "flex", alignItems: "center", gap: "7px", padding: "11px 16px", border: "none", cursor: "pointer",
              background: "transparent", fontFamily: "var(--font-outfit)", fontSize: "13.5px", fontWeight: on ? 600 : 400,
              color: on ? accent : C.txtMuted, borderBottom: on ? `2px solid ${accent}` : "2px solid transparent",
              marginBottom: "-1px", transition: "color .2s, border-color .2s", whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "flex", color: on ? accent : C.txtMuted }}><Icon name={tab.icon} size={15} sw={on ? 2.2 : 1.8} /></span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({ children, C }: { children: React.ReactNode; C: ThemeColors }) {
  return (
    <div style={{ padding: "22px 24px", borderRadius: "16px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow }}>
      {children}
    </div>
  );
}

function EmptyState({ message, C }: { message: string; C: ThemeColors }) {
  return <p style={{ margin: 0, fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", textAlign: "center", padding: "24px 0" }}>{message}</p>;
}

function ReadOnlyTable({ headers, C, children }: { headers: string[]; C: ThemeColors; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: "11px", textTransform: "uppercase", letterSpacing: ".06em", color: C.txtMuted, borderBottom: `1px solid ${C.tableSep}`, fontFamily: "var(--font-outfit)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const CasesTab = memo(function CasesTab({ suspectId, C, accent }: { suspectId: number; C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: cases = [], isLoading } = useSuspectCases(suspectId, true);

  if (isLoading) return <EmptyState message="Loading…" C={C} />;

  return (
    <Panel C={C}>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary, marginBottom: "16px" }}>{t.tabCases}</div>
      {cases.length === 0 ? <EmptyState message={t.noRecords} C={C} /> : (
        <ReadOnlyTable headers={[t.colCase, t.colTuhunka, t.colDamiin, t.colDistrict, t.colWaaxda, t.colDetails]} C={C}>
          {cases.map((c) => (
            <tr key={c.id} style={{ borderBottom: `1px solid ${C.tableSep}` }}>
              <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "14px", color: C.txtPrimary }}>{c.case_code || `#${c.id}`}</td>
              <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: accent }}>{c.tuhunka_name || "—"}</td>
              <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary }}>{c.damiin_name || "—"}</td>
              <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary }}>{c.capture_county_name || "—"}</td>
              <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary }}>{c.capture_sub_county_name || "—"}</td>
              <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary }}>{c.description || "—"}</td>
            </tr>
          ))}
        </ReadOnlyTable>
      )}
    </Panel>
  );
});

function DamiinDocumentLightbox({
  title,
  subtitle,
  url,
  accent,
  isDark,
  onClose,
}: {
  title: string;
  subtitle?: string;
  url: string;
  accent: string;
  isDark: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const panelBg = isDark ? "rgba(12,9,6,0.97)" : "#ffffff";
  const border = hexA(accent, isDark ? 0.28 : 0.16);

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(12px, 3vw, 28px)",
        background: "rgba(5, 4, 3, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: "is-fadeUp .24s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(920px, 96vw)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          overflow: "hidden",
          border: `1px solid ${border}`,
          background: panelBg,
          boxShadow: isDark
            ? `0 40px 100px -28px rgba(0,0,0,.9), 0 0 0 1px ${hexA(accent, 0.1)}`
            : "0 32px 80px -24px rgba(15,23,42,0.32)",
          animation: "is-zoomInTR .38s cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px",
            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : hexA(accent, 0.1)}`,
            background: isDark ? hexA(accent, 0.06) : hexA(accent, 0.05),
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-cinzel)",
                fontWeight: 600,
                fontSize: 17,
                color: isDark ? "#efe6d6" : "#1C1917",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13,
                  color: isDark ? "#c4b08a" : "#64748b",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 12,
              border: `1px solid ${hexA(accent, 0.35)}`,
              background: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.94)",
              color: accent,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={18} sw={2} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: "min(68vh, 640px)",
            padding: "clamp(12px, 2.5vw, 22px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isDark
              ? "radial-gradient(ellipse at center, rgba(40,30,18,0.9) 0%, #0a0704 70%)"
              : "radial-gradient(ellipse at center, #f8fafc 0%, #e8edf3 100%)",
            overflow: "auto",
          }}
        >
          {failed ? (
            <div style={{ textAlign: "center", fontFamily: "var(--font-outfit)", color: isDark ? "#c4b08a" : "#64748b" }}>
              Document lama furin.
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              onError={() => setFailed(true)}
              style={{
                maxWidth: "100%",
                maxHeight: "min(72vh, 680px)",
                objectFit: "contain",
                borderRadius: 12,
                boxShadow: isDark
                  ? "0 18px 50px rgba(0,0,0,0.55)"
                  : "0 16px 40px rgba(15,23,42,0.16)",
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const GuarantorsTab = memo(function GuarantorsTab({
  suspectId,
  C,
  accent,
  isDark,
}: {
  suspectId: number;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: rows = [], isLoading } = useSuspectGuarantors(suspectId, true);
  const updatePhotos = useUpdateDamiinPhotos(suspectId);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [docViewer, setDocViewer] = useState<{ title: string; subtitle?: string; url: string } | null>(null);
  const profileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const identityRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const upload = (damiinId: number, kind: "picture" | "identity_picture", file: File) => {
    setBusyId(damiinId);
    updatePhotos.mutate(
      { damiinId, [kind]: file },
      {
        onSuccess: () => {
          toast({
            title: kind === "picture" ? t.damiinPhotoUpdated : t.damiinDocUpdated,
          });
        },
        onError: () => toast({ title: t.damiinUploadFailed, variant: "destructive" }),
        onSettled: () => setBusyId(null),
      },
    );
  };

  if (isLoading) return <EmptyState message="Loading…" C={C} />;

  return (
    <Panel C={C}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary }}>{t.tabDamiinadataha}</div>
        {rows.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 9px",
              borderRadius: 999,
              background: hexA(accent, 0.12),
              border: `1px solid ${hexA(accent, 0.26)}`,
              color: accent,
              fontFamily: "var(--font-outfit)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {rows.length}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState message={t.noRecords} C={C} />
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            alignItems: "start",
          }}
        >
          {rows.map((g: SuspectGuarantor) => {
            const caseSummary = (g.cases ?? [])
              .map((c) => [c.Tuhunka, c.d_qabashada].filter(Boolean).join(" · "))
              .filter(Boolean)
              .join("; ");
            const photo = resolveMediaUrl(g.picture);
            const identity = resolveMediaUrl(g.identity_picture);
            const displayName = g.full_name || g.name;
            const initials = (displayName || "?")
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase();
            const busy = busyId === g.id;
            const relation = g.relationship || g.relationship_name || "—";

            const openDoc = () => {
              if (!identity) return;
              setDocViewer({
                title: t.damiinIdentityDoc,
                subtitle: displayName,
                url: identity,
              });
            };

            return (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  border: `1px solid ${C.cardBdr}`,
                  background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead,
                  minWidth: 0,
                }}
              >
                <input
                  ref={(el) => {
                    profileRefs.current[g.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) upload(g.id, "picture", file);
                  }}
                />
                <input
                  ref={(el) => {
                    identityRefs.current[g.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) upload(g.id, "identity_picture", file);
                  }}
                />

                <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => profileRefs.current[g.id]?.click()}
                    title={photo ? t.damiinChangePhoto : t.uploadProfile}
                    style={{
                      position: "relative",
                      width: 54,
                      height: 54,
                      flexShrink: 0,
                      padding: 0,
                      borderRadius: 14,
                      overflow: "hidden",
                      cursor: busy ? "default" : "pointer",
                      border: `1px solid ${hexA(accent, 0.3)}`,
                      background: photo ? "transparent" : `linear-gradient(135deg,${accent},${hexA(accent, 0.55)})`,
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-cinzel)",
                      fontWeight: 700,
                      fontSize: 17,
                    }}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      initials
                    )}
                    <span
                      style={{
                        position: "absolute",
                        right: 0,
                        bottom: 0,
                        display: "grid",
                        placeItems: "center",
                        width: 18,
                        height: 18,
                        background: accent,
                        color: "#fff",
                        borderTopLeftRadius: 8,
                      }}
                    >
                      <Icon name={busy ? "clock" : "edit"} size={10} sw={2.4} />
                    </span>
                  </button>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-cinzel)",
                        fontWeight: 600,
                        fontSize: 15,
                        color: C.txtPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayName}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-outfit)",
                        fontSize: 12.5,
                        color: C.txtMuted,
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {[g.phone, relation, g.county_name].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>

                  <span
                    title={identity ? t.damiinViewHint : t.damiinNoIdentity}
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontFamily: "var(--font-outfit)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: identity ? "#46c08a" : C.txtMuted,
                      background: hexA(identity ? "#46c08a" : "#9a8a6f", 0.12),
                      border: `1px solid ${hexA(identity ? "#46c08a" : "#9a8a6f", 0.28)}`,
                    }}
                  >
                    <Icon name={identity ? "check" : "file"} size={11} sw={2.2} />
                    ID
                  </span>
                </div>

                {(caseSummary || g.description || g.notes || g.occupation || g.workplace) && (
                  <div
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: 12,
                      color: C.txtSecondary,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {caseSummary || [g.occupation, g.workplace].filter(Boolean).join(" · ") || g.description || g.notes}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => (identity ? openDoc() : identityRefs.current[g.id]?.click())}
                    disabled={busy}
                    title={identity ? t.damiinViewHint : t.damiinUploadIdentity}
                    style={{
                      position: "relative",
                      width: 96,
                      height: 62,
                      flexShrink: 0,
                      borderRadius: 10,
                      border: `1px solid ${C.cardBdr}`,
                      background: hexA(accent, 0.06),
                      overflow: "hidden",
                      display: "grid",
                      placeItems: "center",
                      padding: 0,
                      cursor: busy ? "default" : identity ? "zoom-in" : "pointer",
                    }}
                  >
                    {identity ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={identity} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <span
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "grid",
                            placeItems: "center",
                            background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%)",
                            color: "#fff",
                          }}
                        >
                          <Icon name="search" size={14} sw={2.2} />
                        </span>
                      </>
                    ) : (
                      <span style={{ color: C.txtMuted, display: "grid", placeItems: "center" }}>
                        <Icon name={busy ? "clock" : "plus"} size={17} sw={1.9} />
                      </span>
                    )}
                  </button>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-outfit)",
                        fontSize: 11,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        color: C.txtMuted,
                      }}
                    >
                      {t.damiinIdentityDoc}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-outfit)",
                        fontSize: 12.5,
                        color: identity ? C.txtSecondary : C.txtMuted,
                        marginTop: 3,
                      }}
                    >
                      {identity ? t.damiinViewHint : t.damiinNoIdentity}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {docViewer && (
        <DamiinDocumentLightbox
          title={docViewer.title}
          subtitle={docViewer.subtitle}
          url={docViewer.url}
          accent={accent}
          isDark={isDark}
          onClose={() => setDocViewer(null)}
        />
      )}
    </Panel>
  );
});

function OfficerAvatar({ officer, accent, C }: { officer: RegisteredOfficer; accent: string; C: ThemeColors }) {
  const initials = officer.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const photo = resolveMediaUrl(officer.profile_url);
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={officer.full_name} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: `3px solid ${hexA(accent, 0.35)}` }} />
    );
  }
  return (
    <div style={{ width: 96, height: 96, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${accent},${hexA(accent, 0.5)})`, color: "#fff", fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 28, border: `3px solid ${hexA(accent, 0.35)}` }}>
      {initials}
    </div>
  );
}

const OfficerTab = memo(function OfficerTab({
  officer,
  C,
  accent,
  onOpenUser,
}: {
  officer: RegisteredOfficer | null | undefined;
  C: ThemeColors;
  accent: string;
  onOpenUser?: (userId: string) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const canOpen = Boolean(onOpenUser && officer?.id);

  return (
    <Panel C={C}>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary, marginBottom: "20px" }}>{t.tabSarkaalka}</div>
      {!officer ? <EmptyState message={t.noRecords} C={C} /> : (
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => canOpen && onOpenUser?.(String(officer.id))}
            disabled={!canOpen}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: canOpen ? "pointer" : "default",
              borderRadius: "50%",
            }}
            aria-label={canOpen ? t.viewOfficerProfile : undefined}
          >
            <OfficerAvatar officer={officer} accent={accent} C={C} />
          </button>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            {canOpen ? (
              <button
                type="button"
                onClick={() => onOpenUser?.(String(officer.id))}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-cinzel)",
                  fontWeight: 600,
                  fontSize: "20px",
                  color: accent,
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                {officer.full_name}
              </button>
            ) : (
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "20px", color: C.txtPrimary }}>{officer.full_name}</div>
            )}
            <div style={{ marginTop: "6px", fontFamily: "var(--font-outfit)", fontSize: "14px", color: C.txtMuted }}>{officer.username}</div>
          </div>
        </div>
      )}
    </Panel>
  );
});

function CommentBlock({
  comment, C, accent, suspectId, depth = 0,
}: {
  comment: SuspectComment; C: ThemeColors; accent: string; suspectId: number; depth?: number;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const create = useCreateSuspectComment(suspectId);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const submitReply = () => {
    if (!replyBody.trim()) return;
    create.mutate({ body: replyBody.trim(), kind: comment.kind, target_id: comment.id }, {
      onSuccess: () => { setReplyBody(""); setReplyOpen(false); },
    });
  };

  return (
    <div style={{ marginLeft: depth ? 20 : 0, paddingLeft: depth ? 14 : 0, borderLeft: depth ? `2px solid ${hexA(accent, 0.2)}` : undefined }}>
      <div style={{ padding: "14px 16px", borderRadius: "12px", border: `1px solid ${C.tableSep}`, background: hexA(accent, depth ? 0.02 : 0.04), marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontFamily: "var(--font-outfit)", fontSize: "13px", fontWeight: 600, color: C.txtPrimary }}>{comment.author_name}</span>
          <span style={{ fontFamily: "var(--font-outfit)", fontSize: "12px", color: C.txtMuted }}>{comment.created_at.slice(0, 16).replace("T", " ")}</span>
        </div>
        {comment.body && (
          <p style={{ margin: 0, fontFamily: "var(--font-outfit)", fontSize: "14px", lineHeight: 1.6, color: C.txtSecondary, whiteSpace: "pre-wrap" }}>{comment.body}</p>
        )}
        {comment.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.image} alt="" style={{ marginTop: comment.body ? "10px" : 0, maxWidth: "220px", width: "100%", borderRadius: "10px", border: `1px solid ${C.tableSep}`, objectFit: "cover", cursor: "pointer" }}
            onClick={() => window.open(comment.image!, "_blank", "noopener")} />
        )}
        {comment.audio && (
          <audio controls src={comment.audio} style={{ marginTop: "10px", width: "100%", maxWidth: "320px" }} />
        )}
        {comment.kind !== "reply" && (
          <button type="button" onClick={() => setReplyOpen((v) => !v)}
            style={{ marginTop: "10px", border: "none", background: "transparent", color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "13px", fontWeight: 500 }}>
            {t.replyAction}
          </button>
        )}
        {replyOpen && (
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2}
              style={{ flex: 1, boxSizing: "border-box", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px", resize: "vertical" }}
            />
            <PrimaryButton onClick={submitReply} disabled={create.isPending || !replyBody.trim()} accent={accent}>{t.sendReply}</PrimaryButton>
          </div>
        )}
      </div>
      {(comment.replies ?? []).map((r) => (
        <CommentBlock key={r.id} comment={r} C={C} accent={accent} suspectId={suspectId} depth={1} />
      ))}
    </div>
  );
}

const CommentsTab = memo(function CommentsTab({ suspectId, C, accent }: { suspectId: number; C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: rows = [], isLoading } = useSuspectComments(suspectId, true);

  if (isLoading) return <EmptyState message="Loading…" C={C} />;

  return (
    <Panel C={C}>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary, marginBottom: "16px" }}>{t.tabComment}</div>
      {rows.length === 0 ? <EmptyState message={t.noRecords} C={C} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {rows.map((c) => <CommentBlock key={c.id} comment={c} C={C} accent={accent} suspectId={suspectId} />)}
        </div>
      )}
    </Panel>
  );
});

export function SuspectProfilePage({
  suspectId, onBack, onEdit, onOpenUser, C, accent, isDark,
}: {
  suspectId: number;
  onBack: () => void;
  onEdit?: () => void;
  onOpenUser?: (userId: string) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: suspect, isLoading, isError } = useSuspect(suspectId);
  const release = useReleaseSuspect(suspectId);
  const [activeTab, setActiveTab] = useState<TabId>("faahfaahin");

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !suspect) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
        <p style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{t.noResults}</p>
        <button onClick={onBack} style={{ marginTop: "16px", padding: "10px 18px", borderRadius: "10px", border: `1px solid ${hexA(accent, 0.35)}`, background: hexA(accent, 0.1), color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)" }}>{t.backToList}</button>
      </div>
    );
  }

  const tc = tuhunkaColor(suspect.suspect_type_name);
  const isReleased = suspect.status === "cleared" || Boolean(suspect.is_released);

  return (
    <div style={{ animation: "is-fadeUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.cardBg, color: C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "13.5px", transition: ".2s" }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="arrow" size={15} sw={2} /></span>
          {t.backToList}
        </button>
        {onEdit && (
          <button onClick={onEdit}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "10px", border: `1px solid ${hexA(accent, 0.4)}`, background: hexA(accent, 0.1), color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "13.5px", fontWeight: 500 }}
          >
            {t.editSuspect}
          </button>
        )}
      </div>

      <div className="lmsbr-split-aside" style={{ display: "grid", gridTemplateColumns: "minmax(240px,300px) 1fr", gap: "24px", alignItems: "start" }}>
        <div style={{ borderRadius: "18px", overflow: "hidden", background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow }}>
          <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden" }}>
            <SuspectPhoto
              photo={suspect.photo}
              alt={suspect.name}
              loading="eager"
              cacheKey={suspect.updated_at ?? suspect.id}
              fallback={
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg,${hexA(accent, 0.35)},${hexA(accent, 0.08)})` }}>
                  <img src="/emblem.png" alt="" style={{ width: 96, height: 96, opacity: 0.5, objectFit: "contain" }} />
                </div>
              }
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 55%,rgba(0,0,0,0.85) 100%)" }} />
            <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "5px 11px", borderRadius: "20px", background: hexA(tc, 0.92), color: "#fff", fontFamily: "var(--font-outfit)", letterSpacing: ".05em" }}>{tuhunkaLabel(suspect.suspect_type_name, t)}</span>
              {isReleased && (
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "5px 11px", borderRadius: "20px", background: hexA("#46c08a", 0.92), color: "#fff", fontFamily: "var(--font-outfit)" }}>{t.suspectReleased}</span>
              )}
            </div>
          </div>
          <div style={{ padding: "20px 22px 24px" }}>
            <div style={{ marginBottom: "12px", textAlign: "center" }}>
              <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "6px 12px", borderRadius: "20px", fontFamily: "var(--font-outfit)", background: isReleased ? hexA("#46c08a", 0.15) : hexA("#e0655a", 0.12), color: isReleased ? "#46c08a" : "#e0655a", border: `1px solid ${hexA(isReleased ? "#46c08a" : "#e0655a", 0.35)}` }}>
                {isReleased ? t.suspectReleased : t.suspectHeld}
              </span>
            </div>
            <h2 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "22px", color: C.txtPrimary, margin: 0, lineHeight: 1.25 }}>{suspect.name}</h2>
            <p style={{ margin: "6px 0 0", fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>@{suspect.alias}</p>
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${C.tableSep}`, display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
              <span style={{ display: "flex", color: accent }}><Icon name="map" size={16} sw={1.8} /></span>
              {suspectCaptureDistrict(suspect)}
            </div>
            <button type="button" disabled={release.isPending} onClick={() => release.mutate()}
              style={{ marginTop: "18px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${hexA(isReleased ? "#46c08a" : "#e0655a", 0.4)}`, background: hexA(isReleased ? "#46c08a" : "#e0655a", 0.1), color: isReleased ? "#46c08a" : "#e0655a", cursor: release.isPending ? "wait" : "pointer", fontFamily: "var(--font-outfit)", fontSize: "14px", fontWeight: 600 }}>
              <Icon name="check" size={16} sw={2} />
              {t.releaseSuspect}
            </button>
          </div>
        </div>

        <div>
          <TabBar active={activeTab} onChange={setActiveTab} accent={accent} C={C} />

          {activeTab === "faahfaahin" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Panel C={C}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "18px", color: C.txtPrimary, marginBottom: "20px" }}>{t.caseDetails}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "18px" }}>
                  {[
                    { label: t.colCase, value: suspect.case_ref, accent: true },
                    { label: t.colTuhunka, value: tuhunkaLabel(suspect.suspect_type_name, t), color: tc },
                    { label: t.colStatus, value: isReleased ? t.suspectReleased : t.filterNotReleased, color: isReleased ? "#46c08a" : accent },
                    { label: t.colLastSeen, value: suspect.last_seen, accent: false },
                    { label: "Offense", value: suspect.offense, accent: false },
                  ].map((row) => (
                    <div key={row.label} style={{ padding: "14px 16px", borderRadius: "12px", background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead, border: `1px solid ${C.tableSep}` }}>
                      <div style={{ fontSize: "11px", letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: "6px" }}>{row.label}</div>
                      <div style={{ fontSize: "15px", fontWeight: row.accent ? 600 : 500, color: (row as { color?: string }).color ?? (row.accent ? accent : C.txtPrimary), fontFamily: "var(--font-outfit)" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "20px", marginTop: "20px", flexWrap: "wrap", fontSize: "12.5px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  <span>{t.registered}: {suspect.created_at.slice(0, 10)}</span>
                  <span>{t.updated}: {suspect.updated_at.slice(0, 10)}</span>
                  {(suspect.bail_count ?? 0) > 1 && (
                    <BailCountBadge count={suspect.bail_count!} accent={accent} C={C} t={t} variant="chip" />
                  )}
                </div>
              </Panel>
              {suspect.notes && (
                <Panel C={C}>
                  <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "18px", color: C.txtPrimary, marginBottom: "14px" }}>{t.notes}</div>
                  <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.7, color: C.txtSecondary, fontFamily: "var(--font-outfit)", whiteSpace: "pre-wrap" }}>{suspect.notes}</p>
                </Panel>
              )}
            </div>
          )}

          {activeTab === "cases" && <CasesTab suspectId={suspectId} C={C} accent={accent} />}
          {activeTab === "damiinadataha" && <GuarantorsTab suspectId={suspectId} C={C} accent={accent} isDark={isDark} />}
          {activeTab === "sarkaalka" && (
            <OfficerTab
              officer={suspect.registered_officer}
              C={C}
              accent={accent}
              onOpenUser={onOpenUser}
            />
          )}
          {activeTab === "comment" && <CommentsTab suspectId={suspectId} C={C} accent={accent} />}
        </div>
      </div>
    </div>
  );
}
