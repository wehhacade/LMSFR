"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useAddDhacdooyinkaUpdate, useDhacdooyinkaRecord } from "@/hooks/use-dhacdooyinka";
import { ShimmerSuspectProfile } from "./shimmer";
import { type AccountsThemeColors } from "./accounts-shared";
import { AccountsRichTextContent } from "./rich-text-field";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE, usePaginatedRows } from "./table-pagination";
import { DhacdooyinkaVictimFormModal } from "./dhacdooyinka-victim-form-modal";
import { DhacdooyinkaVictimProfile } from "./dhacdooyinka-victim-profile";
import { DhacdoDocumentGallery, type DocItem } from "./dhacdooyinka-documents";
import type { DhacdooyinkaDetail, DhacdooyinkaVictim } from "@/types/dhacdooyinka";

const EventLocationMap = dynamic(
  () => import("./event-location-map").then((m) => m.EventLocationMap),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: "100%", height: 480, borderRadius: 14, background: "#dde3ea" }} />
    ),
  },
);

type ThemeColors = AccountsThemeColors;

type TabId = "faahfaahin" | "description" | "dhibanayaasha" | "documents" | "gis";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function humanizeLocationText(text: string, placeName: string) {
  const name = placeName.trim();
  if (!text || !name) return text;
  return text.replace(
    /(Location\s*Area|Goobta(?:\s*dhacdada)?)\s*:\s*-?\d+(?:\.\d+)?\s*[,/]\s*-?\d+(?:\.\d+)?/gi,
    `$1: ${name}`,
  );
}

function targetLocationLabel(record: DhacdooyinkaDetail) {
  const named = (record.target_location_display || "").trim();
  if (named) return named;
  const bartil = (record.bartilmaameedka_dhacdada || "").trim();
  if (
    bartil
    && !/^-?\d+(?:\.\d+)?\s*[,/]\s*-?\d+(?:\.\d+)?$/.test(bartil)
    && !/^-?\d+(?:\.\d+)?$/.test(bartil)
  ) {
    return bartil;
  }
  const admin = (record.location_display || "").trim();
  return admin && admin !== "—" ? admin : "";
}

function TabBar({
  active, onChange, accent, C, tabs,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  accent: string;
  C: ThemeColors;
  tabs: { id: TabId; label: string; icon: string }[];
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      borderBottom: `1px solid ${C.tableSep}`, marginBottom: 24, overflowX: "auto",
    }}>
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "11px 16px",
              border: "none", cursor: "pointer", background: "transparent",
              fontFamily: "var(--font-outfit)", fontSize: 13.5, fontWeight: on ? 600 : 400,
              color: on ? accent : C.txtMuted,
              borderBottom: on ? `2px solid ${accent}` : "2px solid transparent",
              marginBottom: -1, transition: "color .2s, border-color .2s", whiteSpace: "nowrap",
            }}
          >
            <span style={{ display: "flex", color: on ? accent : C.txtMuted }}>
              <Icon name={tab.icon} size={15} sw={on ? 2.2 : 1.8} />
            </span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

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

function EmptyState({ message, C }: { message: string; C: ThemeColors }) {
  return (
    <p style={{
      margin: 0, fontSize: 14, color: C.txtMuted, fontFamily: "var(--font-outfit)",
      textAlign: "center", padding: "24px 0",
    }}>
      {message}
    </p>
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

function CountPill({ count, label, color, C }: { count: string | number; label: string; color: string; C: ThemeColors }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: 999,
      background: hexA(color, 0.12), border: `1px solid ${hexA(color, 0.28)}`,
    }}>
      <span style={{ fontFamily: "var(--font-cinzel)", fontSize: 20, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 12, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{label}</span>
    </div>
  );
}

const VictimsTab = memo(function VictimsTab({
  victims, C, accent, isDark, t, onAddVictim, onOpenVictim,
}: {
  victims: DhacdooyinkaDetail["victims"];
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
  onAddVictim: () => void;
  onOpenVictim: (victim: DhacdooyinkaVictim) => void;
}) {
  const { lang } = useLang();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  const { total, totalPages, pageRows, startIndex } = usePaginatedRows(victims, page, pageSize);

  useEffect(() => {
    setPage(1);
  }, [victims.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginationLabels = { prev: t.prev, next: t.next, page: t.page, of: t.of };

  const headers = [
    "#",
    t.dhacdoVictimName,
    t.dhacdoVictimAge,
    t.dhacdoVictimGender,
    t.dhacdoVictimPhone,
    t.dhacdoVictimStatus,
    t.dhacdoVictimDocument,
    t.dhacdoVictimDetails,
  ];

  return (
    <div style={{
      borderRadius: 14, overflow: "hidden",
      border: `1px solid ${C.cardBdr}`, background: C.panelBg,
    }}>
      {total === 0 ? (
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <EmptyState message={t.noRecords} C={C} />
          <button
            type="button"
            onClick={onAddVictim}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16,
              padding: "10px 16px", borderRadius: 10, border: "none",
              background: accent, color: "#fff", cursor: "pointer",
              fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14,
              boxShadow: `0 4px 14px -4px ${hexA(accent, 0.45)}`,
            }}
          >
            <Icon name="plus" size={16} sw={2} /> {t.dhacdoAddVictim}
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding: "12px 16px 0" }}>
            <TableRowsSelect
              pageSize={pageSize}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              C={C}
              label={lang === "so" ? "Tiro" : "Rows"}
            />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", minWidth: 900 }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {headers.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px", textAlign: "left", fontSize: 12, fontWeight: 600,
                        color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((v, i) => {
                  const rowNum = startIndex + i + 1;
                  return (
                    <tr
                      key={v.id ?? `${rowNum}-${v.magaca}`}
                      style={{ borderBottom: `1px solid ${C.tableSep}`, cursor: "pointer" }}
                      onClick={() => onOpenVictim(v)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "14px 16px", color: C.txtMuted, fontSize: 13, fontWeight: 600 }}>{rowNum}</td>
                      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>
                        <span style={{ color: accent, fontFamily: "var(--font-outfit)" }}>
                          {v.magaca || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary, fontSize: 13 }}>{v.dada_dh || "—"}</td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary, fontSize: 13 }}>{v.gender || "—"}</td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary, fontSize: 13 }}>{v.phone || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        {v.xalada ? (
                          <span style={{
                            display: "inline-block", padding: "4px 10px", borderRadius: 8,
                            background: hexA(accent, 0.12), color: accent, fontSize: 12, fontWeight: 600,
                          }}>
                            {v.xalada}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                        {(v.documents ?? []).filter((d) => d.document_url).length > 0 ? (
                          <span style={{ color: accent, fontWeight: 600 }}>
                            {(v.documents ?? []).filter((d) => d.document_url).length}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary, fontSize: 13, maxWidth: 280 }}>{v.fahfaahin || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            totalLabel={`${t.dhacdoVictimsTotal}: ${total}`}
            onPage={setPage}
            C={C}
            accent={accent}
            isDark={isDark}
            labels={paginationLabels}
          />
        </>
      )}
    </div>
  );
});

const UpdatesTab = memo(function UpdatesTab({
  updates, eventId, C, accent, isDark, t, showEmpty = true, placeName = "",
}: {
  updates: DhacdooyinkaDetail["updates"];
  eventId: number;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
  showEmpty?: boolean;
  placeName?: string;
}) {
  const [draft, setDraft] = useState("");
  const addUpdate = useAddDhacdooyinkaUpdate();

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    addUpdate.mutate(
      { eventId, fahfaahin: text },
      { onSuccess: () => setDraft("") },
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        borderRadius: 14, border: `1px solid ${C.cardBdr}`, background: C.panelBg,
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.dhacdoXogCusub}
          rows={3}
          style={{
            width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: 10,
            border: `1px solid ${C.inputBdr}`, background: C.inputBg ?? C.cardBg,
            color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 14,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || addUpdate.isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "9px 16px", borderRadius: 10, border: "none",
              background: accent, color: "#fff",
              cursor: draft.trim() ? "pointer" : "not-allowed",
              opacity: draft.trim() ? 1 : 0.55,
              fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 13,
              boxShadow: `0 4px 14px -4px ${hexA(accent, 0.45)}`,
            }}
          >
            <Icon name="plus" size={15} sw={2} /> {t.dhacdoXogCusub}
          </button>
        </div>
      </div>

      {updates.length === 0 ? (
        showEmpty ? (
          <Panel C={C}>
            <EmptyState message={t.dhacdoXogKuDarisEmpty} C={C} />
          </Panel>
        ) : null
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {updates.map((u) => (
            <div
              key={u.id}
              style={{
                borderRadius: 14, border: `1px solid ${C.cardBdr}`, background: C.panelBg,
                padding: "16px 18px", position: "relative",
                borderLeft: `3px solid ${hexA(accent, 0.6)}`,
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, flexWrap: "wrap", marginBottom: 10,
              }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 600, color: accent, fontFamily: "var(--font-outfit)",
                }}>
                  {formatDateTime(u.date_recorded)}
                </span>
                {u.recorded_by_name && (
                  <span style={{
                    fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    <Icon name="badge" size={12} sw={1.8} />
                    {u.recorded_by_name}
                  </span>
                )}
              </div>
              <AccountsRichTextContent
                content={humanizeLocationText(u.fahfaahin ?? "", placeName)}
                C={C}
                accent={accent}
                isDark={isDark}
                fontSize={14}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export function DhacdooyinkaProfilePage({
  recordId, onBack, onEdit, C, accent, isDark, victimId, setVictimId,
}: {
  recordId: number;
  onBack: () => void;
  onEdit?: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  victimId?: number | null;
  setVictimId?: (id: number | null) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: record, isLoading, isError } = useDhacdooyinkaRecord(recordId);
  const [activeTab, setActiveTab] = useState<TabId>("faahfaahin");
  const [showVictimForm, setShowVictimForm] = useState(false);
  const [localVictimId, setLocalVictimId] = useState<number | null>(null);
  const selectedVictimId = victimId ?? localVictimId;
  const setSelectedVictimId = setVictimId ?? setLocalVictimId;

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "faahfaahin", label: t.dhacdoTabFaahfaahin, icon: "clipboard" },
    { id: "description", label: t.dhacdoDescription, icon: "file" },
    { id: "dhibanayaasha", label: t.dhacdoTabDhibanayaasha, icon: "users" },
    { id: "documents", label: t.dhacdoTabDocuments, icon: "archive" },
    { id: "gis", label: t.dhacdoTabGis, icon: "map" },
  ];

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !record) {
    return (
      <div style={{
        padding: "48px 24px", textAlign: "center", borderRadius: 14,
        background: C.panelBg, border: `1px solid ${C.cardBdr}`,
      }}>
        <p style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{t.noResults}</p>
        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: 16, padding: "10px 18px", borderRadius: 10,
            border: `1px solid ${hexA(accent, 0.35)}`, background: hexA(accent, 0.1),
            color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)",
          }}
        >
          {t.backToList}
        </button>
      </div>
    );
  }

  const deaths = record.dhimasho ?? "0";
  const injuries = record.dhaawac ?? "0";
  const executedDate = record.taariikhda_dhacdada ?? record.date_opp;
  const lat = record.latitude?.trim();
  const lng = record.longitude?.trim();
  const hasCoords = Boolean(lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)));
  const mapUrl = hasCoords ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}` : null;
  const descriptionText = (
    record.fahfaahin
    || record.tafaasiisha_goobta_dhacdada
    || [...(record.updates ?? [])]
      .sort((a, b) => new Date(a.date_recorded).getTime() - new Date(b.date_recorded).getTime())[0]
      ?.fahfaahin
    || ""
  ).trim();
  const hasDescription = Boolean(descriptionText);
  // The event's very first update is auto-copied from the description
  // server-side when the event is created — drop it from the timeline so it
  // doesn't show twice (once as the description, once as an update).
  const timelineUpdates = hasDescription
    ? (record.updates ?? []).filter((u) => (u.fahfaahin ?? "").trim() !== descriptionText)
    : (record.updates ?? []);
  const selectedVictim = selectedVictimId != null
    ? record.victims.find((v) => v.id === selectedVictimId) ?? null
    : null;

  if (selectedVictim) {
    return (
      <div style={{ animation: "is-fadeUp .45s ease both" }}>
        <DhacdooyinkaVictimProfile
          victim={selectedVictim}
          event={record}
          onBack={() => setSelectedVictimId(null)}
          onOpenEvent={() => {
            setSelectedVictimId(null);
            setActiveTab("faahfaahin");
          }}
          C={C}
          accent={accent}
          isDark={isDark}
          t={t}
        />
      </div>
    );
  }

  return (
    <div style={{ animation: "is-fadeUp .45s ease both" }}>
      <DhacdooyinkaVictimFormModal
        open={showVictimForm}
        onClose={() => setShowVictimForm(false)}
        eventId={recordId}
        C={C}
        accent={accent}
      />
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
            fontSize: 13.5, transition: ".2s",
          }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}>
            <Icon name="arrow" size={15} sw={2} />
          </span>
          {t.backToList}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            title={t.dhacdoEditEvent}
            aria-label={t.dhacdoEditEvent}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, padding: 0,
              borderRadius: 10, border: `1px solid ${hexA("#e6b25c", 0.5)}`,
              background: hexA("#e6b25c", 0.06), color: "#e6b25c", cursor: "pointer",
            }}
          >
            <Icon name="edit" size={16} sw={2} />
          </button>
        )}
      </div>

      <div className="lmsbr-split-aside" style={{
        display: "grid", gridTemplateColumns: "minmax(260px,300px) 1fr",
        gap: 24, alignItems: "start",
      }}>
        {/* Sidebar */}
        <div style={{
          borderRadius: 18, overflow: "hidden",
          background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow,
          position: "sticky", top: 16,
        }}>
          <div style={{
            position: "relative", padding: "28px 22px 24px",
            background: isDark
              ? `linear-gradient(160deg, ${hexA(accent, 0.35)}, ${hexA("#dc2626", 0.2)})`
              : `linear-gradient(160deg, ${hexA(accent, 0.22)}, ${hexA("#dc2626", 0.08)})`,
            borderBottom: `1px solid ${C.cardBdr}`,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA("#fff", isDark ? 0.12 : 0.65),
              border: `1px solid ${hexA("#fff", 0.25)}`, marginBottom: 16,
            }}>
              <Icon name="calendar" size={26} sw={1.8} />
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
              textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)",
              marginBottom: 6,
            }}>
              {t.dhacdoColTx}
            </div>
            <h2 style={{
              margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 22,
              fontWeight: 700, color: C.txtPrimary, lineHeight: 1.2,
            }}>
              {record.tixraac_lambar || "—"}
            </h2>
            <div style={{
              marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)",
            }}>
              <Icon name="clock" size={14} sw={1.8} />
              {formatDate(executedDate)}
            </div>
            {record.nooca_dhacdada_name && (
              <span style={{
                display: "inline-block", marginTop: 14,
                padding: "5px 12px", borderRadius: 999,
                fontSize: 12, fontWeight: 600, fontFamily: "var(--font-outfit)",
                background: hexA("#dc2626", 0.14), color: "#b91c1c",
                border: `1px solid ${hexA("#dc2626", 0.28)}`,
              }}>
                {record.nooca_dhacdada_name}
              </span>
            )}
          </div>

          <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            <SidebarStat label={t.dhacdoLocation} value={record.location_display} C={C} accent={accent} icon="map" />
            <SidebarStat
              label={t.dhacdoKhasaaraha}
              value={record.khasaaraha_dhacdada || "—"}
              C={C}
              accent={accent}
              icon="target"
            />
            <SidebarStat
              label={t.dhacdoCiddaFulisay}
              value={record.cidda_fulisay || "—"}
              C={C}
              accent={accent}
              icon="shield"
              highlight="#b91c1c"
            />
            <SidebarStat
              label={t.dhacdoTaariikhdaFulisay}
              value={formatDate(executedDate)}
              C={C}
              accent={accent}
              icon="calendar"
            />

            <div style={{
              display: "flex", flexWrap: "wrap", gap: 10,
              marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.tableSep}`,
            }}>
              <CountPill count={deaths} label={t.dhacdoPeople} color="#dc2626" C={C} />
              <CountPill count={injuries} label={t.dhacdoPeople} color="#2563eb" C={C} />
            </div>
            <div style={{
              marginTop: 4, fontSize: 11, color: C.txtMuted, fontFamily: "var(--font-outfit)",
              display: "flex", justifyContent: "space-between",
            }}>
              <span>{t.dhacdoTiradaDhimashada}</span>
              <span>{t.dhacdoTiradaDhaawaca}</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div>
          <TabBar
            active={activeTab}
            onChange={(id) => {
              setActiveTab(id);
              setSelectedVictimId(null);
            }}
            accent={accent}
            C={C}
            tabs={tabs}
          />

          {activeTab === "faahfaahin" && (
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
                    { label: t.dhacdoGobolka, value: record.gobolka_name },
                    { label: t.dhacdoDegmada, value: record.degmada_name },
                    { label: t.dhacdoWaaxda, value: record.waaxda_name },
                    { label: t.dhacdoLaanta, value: record.laanta_name },
                    { label: t.dhacdoNoocaType, value: record.nooca_dhacdada_name },
                    { label: t.dhacdoTarget, value: targetLocationLabel(record) },
                    { label: t.dhacdoDhimasho, value: deaths },
                    { label: t.dhacdoDhaawac, value: injuries },
                    { label: t.dhacdoRecordedBy, value: record.recorded_by_name },
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
                <div style={{
                  display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap",
                  fontSize: 12.5, color: C.txtMuted, fontFamily: "var(--font-outfit)",
                }}>
                  <span>{t.registered}: {formatDateTime(record.date_recorded)}</span>
                  {executedDate && <span>{t.dhacdoTaariikhda}: {formatDate(executedDate)}</span>}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "description" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Panel C={C}>
                <div style={{
                  fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18,
                  color: C.txtPrimary, marginBottom: 20,
                }}>
                  {t.dhacdoDescription}
                </div>
                {hasDescription ? (
                  <AccountsRichTextContent
                    content={humanizeLocationText(descriptionText, targetLocationLabel(record))}
                    C={C}
                    accent={accent}
                    isDark={isDark}
                    fontSize={14.5}
                  />
                ) : (
                  <EmptyState message={t.dhacdoXogKuDarisEmpty} C={C} />
                )}
              </Panel>
              <UpdatesTab
                updates={timelineUpdates}
                eventId={recordId}
                C={C}
                accent={accent}
                isDark={isDark}
                t={t}
                showEmpty={false}
                placeName={targetLocationLabel(record)}
              />
            </div>
          )}

          {activeTab === "dhibanayaasha" && (
            <Panel C={C}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, flexWrap: "wrap", marginBottom: 16,
              }}>
                <div style={{
                  fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary,
                }}>
                  {t.dhacdoTabDhibanayaasha}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999,
                    background: hexA(accent, 0.12), color: accent, fontFamily: "var(--font-outfit)",
                  }}>
                    {record.victims.length} {t.dhacdoVictimsRegistered}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowVictimForm(true)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "9px 14px", borderRadius: 10, border: "none",
                      background: accent, color: "#fff", cursor: "pointer",
                      fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 13,
                      boxShadow: `0 4px 14px -4px ${hexA(accent, 0.45)}`,
                    }}
                  >
                    <Icon name="plus" size={15} sw={2} /> {t.dhacdoAddVictim}
                  </button>
                </div>
              </div>
              <VictimsTab
                victims={record.victims}
                C={C}
                accent={accent}
                isDark={isDark}
                t={t}
                onAddVictim={() => setShowVictimForm(true)}
                onOpenVictim={(v) => {
                  if (v.id != null) setSelectedVictimId(v.id);
                }}
              />
            </Panel>
          )}

          {activeTab === "documents" && (() => {
            const allDocs: DocItem[] = [
              ...(record.upload_document_url
                ? [{
                    id: -1,
                    label: record.upload_document?.split("/").pop() || t.dhacdoOpenDocument,
                    url: record.upload_document_url,
                  }]
                : []),
              ...((record.documents ?? [])
                .filter((d): d is { id: number; name: string | null; url: string } => Boolean(d.url))
                .map((d) => ({
                  id: d.id,
                  label: d.name || `${t.dhacdoOpenDocument} #${d.id}`,
                  url: d.url,
                }))),
              ...(record.victims ?? []).flatMap((v, vi) =>
                (v.documents ?? [])
                  .filter((d): d is { id: number; name?: string | null; document_url: string } => Boolean(d.document_url))
                  .map((d, di) => ({
                    id: -(1000 + vi * 1000 + di + 1),
                    label: `${v.magaca || t.dhacdoVictimProfileTitle} — ${d.name || `${t.dhacdoOpenDocument} #${d.id}`}`,
                    url: d.document_url,
                  })),
              ),
            ];
            return (
              <Panel C={C}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 12, flexWrap: "wrap", marginBottom: 16,
                }}>
                  <div style={{
                    fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary,
                  }}>
                    {t.dhacdoTabDocuments}
                  </div>
                  {allDocs.length > 0 && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999,
                      background: hexA(accent, 0.12), color: accent, fontFamily: "var(--font-outfit)",
                    }}>
                      {allDocs.length}
                    </span>
                  )}
                </div>
                <DhacdoDocumentGallery
                  docs={allDocs}
                  emptyMessage={t.dhacdoNoDocument}
                  openLabel={t.dhacdoOpenDocument}
                  C={C}
                  accent={accent}
                  isDark={isDark}
                />
              </Panel>
            );
          })()}

          {activeTab === "gis" && (
            <Panel C={C}>
              <div style={{
                fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18,
                color: C.txtPrimary, marginBottom: 16,
              }}>
                {t.dhacdoTabGis}
              </div>
              {!hasCoords ? (
                <EmptyState message={t.dhacdoNoCoordinates} C={C} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14,
                  }}>
                    <SidebarStat label={t.dhacdoTarget} value={targetLocationLabel(record) || "—"} C={C} accent={accent} icon="map" />
                    <SidebarStat label={t.dhacdoLatitude} value={lat} C={C} accent={accent} icon="map" />
                    <SidebarStat label={t.dhacdoLongitude} value={lng} C={C} accent={accent} icon="map" />
                  </div>
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 10,
                        padding: "12px 18px", borderRadius: 12, alignSelf: "flex-start",
                        border: `1px solid ${hexA(accent, 0.35)}`,
                        background: hexA(accent, 0.08), color: accent,
                        textDecoration: "none", fontFamily: "var(--font-outfit)", fontWeight: 600,
                      }}
                    >
                      <Icon name="map" size={18} sw={1.8} />
                      {t.dhacdoOpenMap}
                    </a>
                  )}
                  <div style={{ border: `1px solid ${C.tableSep}`, borderRadius: 14, overflow: "hidden" }}>
                    <EventLocationMap
                      latitude={Number(lat)}
                      longitude={Number(lng)}
                      accent={accent}
                      layerLabels={{ street: t.dhacdoMapStreets, satellite: t.dhacdoMapSatellite }}
                    />
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
