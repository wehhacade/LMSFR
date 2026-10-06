"use client";

import { useDeferredValue, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useAPITraffic } from "@/hooks/use-audit";
import { ShimmerForcesTable } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";

type ThemeColors = {
  cardBg: string; cardBdr: string; panelBg: string; panelShadow: string;
  tableSep: string; tableHead: string; tableHov: string;
  txtPrimary: string; txtSecondary: string; txtMuted: string;
  inputBg: string; inputBdr: string;
};

function statusColor(code: number) {
  if (code < 300) return "#46c08a";
  if (code < 400) return "#e6b25c";
  if (code < 500) return "#f0a04a";
  return "#e0655a";
}

export function APITrafficPage({ C, accent }: { C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [path, setPath] = useState("");
  const deferred = useDeferredValue(path);
  const { data, isLoading } = useAPITraffic(page, deferred, pageSize);
  const rows = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1;

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      <div style={{ marginBottom: "18px", display: "flex", alignItems: "center", gap: "9px", padding: "10px 14px", borderRadius: "10px", background: C.inputBg, border: `1px solid ${C.inputBdr}`, maxWidth: "420px" }}>
        <Icon name="search" size={16} sw={1.8} />
        <input placeholder={t.searchTraffic} value={path} onChange={(e) => { setPath(e.target.value); setPage(1); }}
          style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: "14px", flex: 1 }} />
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {isLoading ? <ShimmerForcesTable /> : rows.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.noTraffic}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.colTime, "Method", "Path", "Status", "ms", t.colUser, t.colIp].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${C.tableSep}` }}>
                    <td style={{ padding: "14px 16px", color: C.txtMuted, fontSize: "13px", whiteSpace: "nowrap" }}>{new Date(row.created_at).toLocaleString()}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, color: C.txtPrimary }}>{row.method}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary, fontFamily: "monospace", fontSize: "12px" }}>{row.path}</td>
                    <td style={{ padding: "14px 16px", color: statusColor(row.status_code), fontWeight: 600 }}>{row.status_code}</td>
                    <td style={{ padding: "14px 16px", color: C.txtMuted }}>{row.duration_ms}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary }}>{row.user_email || "—"}</td>
                    <td style={{ padding: "14px 16px", color: C.txtMuted, fontFamily: "monospace", fontSize: "12px" }}>{row.ip_address || "—"}</td>
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
