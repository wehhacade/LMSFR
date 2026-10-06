"use client";

import { useState } from "react";
import { useLang } from "../lang-ctx";
import { SecondaryButton } from "../accounts-shared";
import { useDistrictManagement } from "@/hooks/use-personnel";
import { ShimmerBlock } from "../shimmer";
import { hexA } from "@/lib/lmsbr/data";
import type { PersonnelPageProps } from "./personnel-page-props";

export function DistrictManagementPage({ C }: PersonnelPageProps) {
  const { lang } = useLang();
  const so = lang === "so";
  const [page, setPage] = useState(1);

  const { data, isLoading } = useDistrictManagement(page);
  const rows = data?.results ?? [];
  const total = data?.count ?? rows.length;
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-cinzel)", color: C.txtPrimary, fontSize: 22 }}>
          {so ? "Maamulka Degmooyinka" : "District Management"}
        </h2>
        <p style={{ margin: "6px 0 0", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>
          {so ? "Tirakoobka ciidanka iyo imaanshaha degmo kasta" : "Agent counts and attendance stats per district"}
        </p>
      </div>

      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${C.cardBdr}`,
          background: C.cardBg,
          boxShadow: C.cardShadow,
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div style={{ padding: 18 }}><ShimmerBlock h={320} /></div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.tableHead, textAlign: "left" }}>
                    <th style={{ padding: "10px 18px" }}>{so ? "Degmo" : "District"}</th>
                    <th style={{ padding: "10px 18px" }}>{so ? "Gobol" : "Region"}</th>
                    <th style={{ padding: "10px 18px" }}>{so ? "Qaybaha" : "Sections"}</th>
                    <th style={{ padding: "10px 18px" }}>{so ? "Ciidanka" : "Agents"}</th>
                    <th style={{ padding: "10px 18px" }}>{so ? "Firfircoon" : "Active"}</th>
                    <th style={{ padding: "10px 18px" }}>{so ? "Xayiraad" : "Restricted"}</th>
                    <th style={{ padding: "10px 18px" }}>{so ? "Joogta Maanta" : "Present Today"}</th>
                    <th style={{ padding: "10px 18px" }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                      <td style={{ padding: "12px 18px", color: C.txtPrimary, fontWeight: 500 }}>{row.name}</td>
                      <td style={{ padding: "12px 18px", color: C.txtSecondary }}>{row.region_name || "—"}</td>
                      <td style={{ padding: "12px 18px", color: C.txtSecondary, maxWidth: 200 }}>
                        {row.departments?.length ? row.departments.join(", ") : "—"}
                      </td>
                      <td style={{ padding: "12px 18px", color: C.txtSecondary }}>{row.total_agents}</td>
                      <td style={{ padding: "12px 18px", color: C.txtSecondary }}>{row.active_agents}</td>
                      <td style={{ padding: "12px 18px", color: row.restricted_agents > 0 ? "#e0655a" : C.txtSecondary }}>
                        {row.restricted_agents}
                      </td>
                      <td style={{ padding: "12px 18px", color: C.txtSecondary }}>{row.present_today}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 99, background: C.barTrack, maxWidth: 100 }}>
                            <div
                              style={{
                                width: `${row.attendance_pct}%`,
                                height: "100%",
                                borderRadius: 99,
                                background: `linear-gradient(90deg, ${hexA("#46c08a", 0.9)}, #46c08a)`,
                              }}
                            />
                          </div>
                          <span style={{ color: C.txtSecondary, minWidth: 36 }}>{row.attendance_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.tableSep}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-outfit)", fontSize: 12, color: C.txtMuted }}>
                  {so ? `Bogga ${page} / ${totalPages}` : `Page ${page} of ${totalPages}`}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <SecondaryButton C={C} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    {so ? "Hore" : "Previous"}
                  </SecondaryButton>
                  <SecondaryButton C={C} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    {so ? "Xiga" : "Next"}
                  </SecondaryButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
