"use client";

import { useLang } from "../lang-ctx";
import { useAgentPersonnelSummary } from "@/hooks/use-personnel";
import { ShimmerBlock } from "../shimmer";
import type { AccountsThemeColors } from "../accounts-shared";

type ThemeColors = AccountsThemeColors & { tableSep: string; tableHead?: string };

function Panel({ children, C }: { children: React.ReactNode; C: ThemeColors }) {
  return (
    <div style={{ padding: "20px 22px", borderRadius: 14, background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, C }: { label: string; value: string | number; C: ThemeColors }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.tableSep}`, background: C.inputBg, flex: "1 1 120px" }}>
      <div style={{ fontSize: 11, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: "var(--font-outfit)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.txtPrimary, fontFamily: "var(--font-cinzel)", marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function AgentAttendanceTab({ agentId, C }: { agentId: string; C: ThemeColors }) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data, isLoading } = useAgentPersonnelSummary(agentId);

  if (isLoading) return <ShimmerBlock h={200} />;
  const att = data?.attendance;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatCard label={so ? "Heerka Imaanshaha" : "Attendance Rate"} value={`${att?.attendance_rate ?? 0}%`} C={C} />
        <StatCard label={so ? "Joog" : "Present"} value={att?.present_count ?? 0} C={C} />
        <StatCard label={so ? "Maqan" : "Absent"} value={att?.absent_count ?? 0} C={C} />
        <StatCard label={so ? "Wadar" : "Total"} value={att?.total_records ?? 0} C={C} />
      </div>
      <Panel C={C}>
        <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary, marginBottom: 14 }}>
          {so ? "Imaanshaha Dhawaan" : "Recent Attendance"}
        </div>
        {(att?.recent?.length ?? 0) === 0 ? (
          <p style={{ margin: 0, color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>{so ? "Weli lama diiwaangelin" : "No attendance records yet"}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.tableHead, textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>{so ? "Taariikh" : "Date"}</th>
                  <th style={{ padding: "8px 10px" }}>{so ? "Degmo" : "District"}</th>
                  <th style={{ padding: "8px 10px" }}>{so ? "Xaalad" : "Status"}</th>
                  <th style={{ padding: "8px 10px" }}>{so ? "Sabab" : "Reason"}</th>
                </tr>
              </thead>
              <tbody>
                {att?.recent.map((row) => (
                  <tr key={row.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                    <td style={{ padding: "10px", color: C.txtSecondary }}>{row.recorded_at?.slice(0, 10)}</td>
                    <td style={{ padding: "10px", color: C.txtSecondary }}>{row.county__name || "—"}</td>
                    <td style={{ padding: "10px", color: C.txtPrimary }}>{row.status__name}</td>
                    <td style={{ padding: "10px", color: C.txtMuted }}>{row.absence_reason__name || row.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function AgentTransfersTab({ agentId, C, accent }: { agentId: string; C: ThemeColors; accent: string }) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data, isLoading } = useAgentPersonnelSummary(agentId);

  if (isLoading) return <ShimmerBlock h={180} />;

  return (
    <Panel C={C}>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary, marginBottom: 14 }}>
        {so ? "Taariikhda Badalka" : "Assignment History"}
      </div>
      {(data?.transfers?.length ?? 0) === 0 ? (
        <p style={{ margin: 0, color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>{so ? "Weli lama badalin" : "No transfers recorded"}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data?.transfers.map((t, idx) => (
            <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent, marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, paddingBottom: idx < (data.transfers.length - 1) ? 12 : 0, borderBottom: idx < (data.transfers.length - 1) ? `1px solid ${C.tableSep}` : "none" }}>
                <div style={{ fontFamily: "var(--font-outfit)", fontSize: 14, color: C.txtPrimary, fontWeight: 600 }}>
                  {t.from_county__name || "—"} → {t.to_county__name || "—"}
                </div>
                <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12.5, color: C.txtMuted, marginTop: 4 }}>
                  {t.transfer_date} · {t.reason}
                </div>
                {t.notes && <div style={{ fontSize: 12, color: C.txtSecondary, marginTop: 4 }}>{t.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function AgentRestrictionsTab({
  agentId,
  C,
  onRelease,
}: {
  agentId: string;
  C: ThemeColors;
  onRelease?: (id: number) => void;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data, isLoading } = useAgentPersonnelSummary(agentId);

  if (isLoading) return <ShimmerBlock h={180} />;

  return (
    <Panel C={C}>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary, marginBottom: 14 }}>
        {so ? "Xayiraad / Fasax" : "Restrictions / Leave"}
      </div>
      {(data?.restrictions?.length ?? 0) === 0 ? (
        <p style={{ margin: 0, color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>{so ? "Ma jiro xayiraad" : "No restrictions"}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data?.restrictions.map((r) => (
            <div key={r.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${C.tableSep}`, background: C.inputBg }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 600, color: C.txtPrimary }}>{r.reason}</div>
                <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 99, background: r.status === "active" ? "rgba(224,101,90,0.12)" : "rgba(70,192,138,0.12)", color: r.status === "active" ? "#e0655a" : "#46c08a" }}>
                  {r.status}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: C.txtMuted, marginTop: 6, fontFamily: "var(--font-outfit)" }}>
                {r.start_date} → {r.end_date}
              </div>
              <div style={{ fontSize: 12, color: C.txtSecondary, marginTop: 6, fontFamily: "var(--font-outfit)" }}>
                ID: {r.id_card_status} · Weapon: {r.weapon_status}
              </div>
              {r.status === "active" && onRelease && (
                <button
                  type="button"
                  onClick={() => onRelease(r.id)}
                  style={{ marginTop: 10, padding: "6px 12px", borderRadius: 8, border: "none", background: "#46c08a", color: "#fff", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 12 }}
                >
                  {so ? "Sii daayo" : "Release"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function AgentStatusHistoryTab({ agentId, C }: { agentId: string; C: ThemeColors }) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data, isLoading } = useAgentPersonnelSummary(agentId);

  if (isLoading) return <ShimmerBlock h={160} />;

  return (
    <Panel C={C}>
      <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary, marginBottom: 14 }}>
        {so ? "Taariikhda Xaaladda" : "Status History"}
      </div>
      {(data?.status_history?.length ?? 0) === 0 ? (
        <p style={{ margin: 0, color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>{so ? "Ma jiro taariikh" : "No status changes"}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data?.status_history.map((row) => (
            <div key={row.id} style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary, paddingBottom: 8, borderBottom: `1px solid ${C.tableSep}` }}>
              <span style={{ color: C.txtPrimary, fontWeight: 600 }}>{row.old_status__name || "—"} → {row.new_status__name || "—"}</span>
              <span style={{ color: C.txtMuted }}> · {row.created_at?.slice(0, 10)}</span>
              {row.reason && <div style={{ marginTop: 4, fontSize: 12 }}>{row.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
