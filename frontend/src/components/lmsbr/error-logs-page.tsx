"use client";

import { useDeferredValue, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useDeleteErrorLog, useErrorLog, useErrorLogs } from "@/hooks/use-audit";
import { ShimmerForcesTable } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";

type ThemeColors = {
  cardBg: string; cardBdr: string; panelBg: string; panelShadow: string;
  tableSep: string; tableHead: string; tableHov: string;
  txtPrimary: string; txtSecondary: string; txtMuted: string;
  inputBg: string; inputBdr: string;
};

export function ErrorLogsPage({ C, accent }: { C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const deferred = useDeferredValue(search);
  const { data, isLoading } = useErrorLogs(page, deferred, todayOnly, pageSize);
  const showShimmer = isLoading && !data;
  const { data: detail } = useErrorLog(detailId);
  const deleteLog = useDeleteErrorLog();
  const rows = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1;

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      {detailId && detail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={() => setDetailId(null)}>
          <div style={{ width: "100%", maxWidth: "760px", maxHeight: "85vh", overflow: "auto", borderRadius: "16px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, padding: "24px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontFamily: "var(--font-cinzel)", color: C.txtPrimary }}>{detail.expected_error}</h3>
            <p style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontSize: "14px" }}>{detail.field_error}</p>
            <pre style={{ marginTop: "16px", padding: "14px", borderRadius: "10px", background: "rgba(0,0,0,0.25)", color: "#f8d7da", fontSize: "12px", overflow: "auto", whiteSpace: "pre-wrap" }}>{detail.trace_back}</pre>
            <button onClick={() => setDetailId(null)} style={{ marginTop: "16px", padding: "10px 16px", borderRadius: "9px", border: "none", background: accent, color: "#fff", cursor: "pointer", fontFamily: "var(--font-outfit)" }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <div style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", gap: "9px", padding: "10px 14px", borderRadius: "10px", background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
          <Icon name="search" size={16} sw={1.8} />
          <input placeholder={t.searchErrors} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px", flex: 1 }} />
        </div>
        <button onClick={() => { setTodayOnly((v) => !v); setPage(1); }}
          style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${todayOnly ? hexA(accent, 0.45) : C.inputBdr}`, background: todayOnly ? hexA(accent, 0.12) : C.inputBg, color: todayOnly ? accent : C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "14px" }}>
          {t.filterToday}
        </button>
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {showShimmer ? <ShimmerForcesTable /> : rows.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.noErrors}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.colTime, t.colType, t.colMessage, t.colPath, t.colAction].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${C.tableSep}`, cursor: "pointer" }}
                    onClick={() => setDetailId(row.id)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px 16px", color: C.txtMuted, fontSize: "13px", whiteSpace: "nowrap" }}>{new Date(row.created_at).toLocaleString()}</td>
                    <td style={{ padding: "14px 16px", color: "#e0655a", fontWeight: 600 }}>{row.expected_error}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary, maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.field_error}</td>
                    <td style={{ padding: "14px 16px", color: C.txtMuted, fontFamily: "monospace", fontSize: "12px" }}>{row.path}</td>
                    <td style={{ padding: "14px 16px" }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => deleteLog.mutate(row.id)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(224,101,90,0.35)", background: "rgba(224,101,90,0.1)", color: "#e0655a", cursor: "pointer", fontSize: "12px" }}>Delete</button>
                    </td>
                  </tr>
                ))}
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
          hideWhenSinglePage
          align="end"
        />
      </div>
    </div>
  );
}
