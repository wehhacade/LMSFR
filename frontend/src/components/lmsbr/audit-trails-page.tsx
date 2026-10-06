"use client";

import { useDeferredValue, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useAuditTrail, useAuditTrails } from "@/hooks/use-audit";
import type { AuditEventType, AuditTrail } from "@/types/audit";
import { ShimmerForcesTable } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";

type ThemeColors = {
  cardBg: string; cardBdr: string; panelBg: string; panelShadow: string;
  tableSep: string; tableHead: string; tableHov: string;
  txtPrimary: string; txtSecondary: string; txtMuted: string;
  inputBg: string; inputBdr: string;
};

const EVENT_TYPES: { value: "" | AuditEventType; label: string }[] = [
  { value: "", label: "All events" },
  { value: "click", label: "Click" },
  { value: "visit", label: "Visit" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "view", label: "View" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
];

function eventColor(type: string): string {
  const map: Record<string, string> = {
    click: "#6366f1", visit: "#5b9fd4", create: "#46c08a", update: "#e6b25c",
    delete: "#e0655a", view: "#94a3b8", login: "#22c55e", logout: "#f97316",
  };
  return map[type] ?? "#9a8a6f";
}

function AuditDetailPanel({
  detail, accent, C, onClose,
}: {
  detail: AuditTrail; accent: string; C: ThemeColors; onClose: () => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 119,
          background: "var(--lmsbr-modal-overlay, rgba(2,1,0,0.72))",
          backdropFilter: "blur(6px)",
          animation: "is-fadeIn .28s ease both",
        }}
      />
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed", top: "72px", right: "24px", zIndex: 120,
          width: "min(520px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 96px)",
          display: "flex", flexDirection: "column",
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          borderRadius: "18px",
          boxShadow: `0 32px 80px -16px rgba(0,0,0,0.75), 0 0 0 1px ${hexA(accent, 0.14)}, inset 0 1px 0 rgba(248,228,180,0.05)`,
          transformOrigin: "top right",
          animation: "is-zoomInTR .38s cubic-bezier(.2,.8,.2,1) both",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: "12px", padding: "18px 20px 14px",
          borderBottom: `1px solid ${C.tableSep}`,
          background: `linear-gradient(135deg, ${hexA(accent, 0.1)} 0%, transparent 70%)`,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0, animation: "is-fadeUp .35s ease .08s both" }}>
            <span style={{
              fontSize: "11px", fontWeight: 600, padding: "5px 11px", borderRadius: "20px",
              background: hexA(eventColor(detail.event_type), 0.15),
              color: eventColor(detail.event_type), textTransform: "uppercase",
              fontFamily: "var(--font-outfit)",
            }}>
              {detail.event_type}
            </span>
            <h3 style={{ margin: "10px 0 4px", fontFamily: "var(--font-cinzel)", fontSize: "20px", color: C.txtPrimary, lineHeight: 1.3 }}>
              {detail.action}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {new Date(detail.created_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            data-audit-skip
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
              border: `1px solid ${C.inputBdr}`, background: C.inputBg,
              color: C.txtSecondary, cursor: "pointer",
              animation: "is-scaleIn .4s ease .12s both",
              transition: "transform .2s ease, background .2s ease, color .2s ease",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget;
              b.style.transform = "rotate(90deg) scale(1.06)";
              b.style.background = hexA(accent, 0.14);
              b.style.color = accent;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget;
              b.style.transform = "";
              b.style.background = C.inputBg;
              b.style.color = C.txtSecondary;
            }}
          >
            <span style={{ fontSize: "24px", lineHeight: 1 }}>×</span>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 22px" }}>
          <div style={{
            display: "grid", gap: "10px",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            animation: "is-fadeUp .4s ease .14s both",
          }}>
            {[
              [t.colUser, detail.user?.full_name || detail.user?.email || "—"],
              [t.colSubmodule, detail.submodule || "—"],
              ["Module", detail.module || "—"],
              ["Page", detail.page || "—"],
              ["Click / target", detail.click_target || "—"],
              ["Entity", detail.entity_type ? `${detail.entity_type} · ${detail.entity_id}` : "—"],
              [t.colIp, detail.ip_address || "—"],
              [t.colBrowser, `${detail.browser} / ${detail.operating_system}`],
              ["Path", detail.path || "—"],
              ["Method", detail.method || "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: "12px 14px", borderRadius: "12px", background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
                <div style={{ fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted, marginBottom: "5px", fontFamily: "var(--font-outfit)" }}>{k}</div>
                <div style={{ fontSize: "13px", color: C.txtPrimary, wordBreak: "break-word", fontFamily: "var(--font-outfit)" }}>{v}</div>
              </div>
            ))}
          </div>

          {Object.keys(detail.details ?? {}).length > 0 && (
            <pre style={{
              marginTop: "14px", padding: "14px", borderRadius: "12px",
              background: "rgba(0,0,0,0.22)", color: C.txtSecondary,
              fontSize: "12px", overflow: "auto",
              animation: "is-fadeUp .45s ease .2s both",
            }}>
              {JSON.stringify(detail.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}

export function AuditTrailsPage({ C, accent }: { C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [eventType, setEventType] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const deferred = useDeferredValue(search);
  const { data, isLoading } = useAuditTrails(page, deferred, todayOnly, eventType, pageSize);
  const showShimmer = isLoading && !data;
  const { data: detail } = useAuditTrail(detailId);
  const rows = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1;

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      {detailId && detail && (
        <AuditDetailPanel detail={detail} accent={accent} C={C} onClose={() => setDetailId(null)} />
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <div style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", gap: "9px", padding: "10px 14px", borderRadius: "10px", background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
          <Icon name="search" size={16} sw={1.8} />
          <input placeholder={t.searchAudit} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px", flex: 1 }} />
        </div>
        <select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }}
          style={{ padding: "10px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px" }}>
          {EVENT_TYPES.map((o) => <option key={o.value || "all"} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => { setTodayOnly((v) => !v); setPage(1); }}
          style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${todayOnly ? hexA(accent, 0.45) : C.inputBdr}`, background: todayOnly ? hexA(accent, 0.12) : C.inputBg, color: todayOnly ? accent : C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "14px" }}>
          {t.filterToday}
        </button>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: "13px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {t.permClickRow}
      </p>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {showShimmer ? <ShimmerForcesTable /> : rows.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.noAudit}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.colTime, t.colUser, "Event", t.colAction, "Page / click", t.colSubmodule, t.colIp].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const selected = detailId === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setDetailId(row.id)}
                      style={{
                        borderBottom: `1px solid ${C.tableSep}`,
                        cursor: "pointer",
                        background: selected ? hexA(accent, 0.1) : "transparent",
                        transition: "background .15s ease",
                      }}
                      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "14px 16px", color: C.txtMuted, fontSize: "13px", whiteSpace: "nowrap" }}>{new Date(row.created_at).toLocaleString()}</td>
                      <td style={{ padding: "14px 16px", color: C.txtPrimary }}>{row.user?.full_name || row.user?.email || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "12px", background: hexA(eventColor(row.event_type), 0.14), color: eventColor(row.event_type), textTransform: "uppercase" }}>{row.event_type}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary, maxWidth: "200px" }}>{row.action}</td>
                      <td style={{ padding: "14px 16px", color: C.txtMuted, fontSize: "13px" }}>{row.click_target || row.page || "—"}</td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary }}>{row.submodule || row.module || "—"}</td>
                      <td style={{ padding: "14px 16px", color: C.txtMuted, fontFamily: "monospace", fontSize: "13px" }}>{row.ip_address || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          C={C}
          accent={accent}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
          totalLabel={`${data?.count ?? 0} records`}
          hideWhenSinglePage
        />
      </div>
    </div>
  );
}
