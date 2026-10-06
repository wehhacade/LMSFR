"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useLang } from "../lang-ctx";
import { useTheme } from "../theme-ctx";
import { PrimaryButton, SecondaryButton, TextInput } from "../accounts-shared";
import type { PersonnelPageProps } from "./personnel-page-props";
import { useQeybs } from "@/hooks/use-accounts";
import {
  useAbsenceReasons,
  useAttendanceStatuses,
  useBulkRecordAttendance,
  useOpenAttendanceSection,
} from "@/hooks/use-personnel";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "../icon";
import { bulkRecordAttendance } from "@/lib/personnel-api";
import { toast } from "@/components/ui/use-toast";
import type { AttendanceAgentRow, AttendanceSectionOpenResult } from "@/types/personnel";
import type { AgentSummary } from "@/types/agents";
import { TransferFormModal } from "./transfer-form-modal";

type AttendanceMap = Record<number, { status_code: string; absence_reason_code?: string; notes?: string }>;
type DistrictScope = "all" | "one";

const QUICK_ABSENCE_REASONS = [
  { code: "MISSING", labelSo: "Lama haayo", labelEn: "Missing", color: "#d97706" },
  { code: "INJURY", labelSo: "Dhaawac", labelEn: "Injured", color: "#7c5cbf" },
  { code: "ARRESTED", labelSo: "La xiray", labelEn: "Arrested", color: "#991b1b" },
] as const;

function toTransferAgent(agent: AttendanceAgentRow): AgentSummary {
  return {
    id: String(agent.agent_id),
    user_id: null,
    user_email: null,
    user_username: null,
    user_is_active: true,
    user_role: "",
    profile_url: null,
    service_id: agent.service_id,
    personal_number: null,
    personal_fullname: agent.name,
    first_name: "",
    father_name: "",
    last_name: "",
    phone: agent.phone,
    email: null,
    status: "",
    present: "",
    county: agent.county_id ? String(agent.county_id) : null,
    county_name: agent.county_name ?? null,
    directorate: null,
    directorate_name: null,
    created_at: "",
  };
}

function FieldLabel({ children, C }: { children: React.ReactNode; C: PersonnelPageProps["C"] }) {
  return (
    <span style={{ fontFamily: "var(--font-outfit)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: C.txtMuted }}>
      {children}
    </span>
  );
}

function SelectInput({
  value,
  onChange,
  disabled,
  children,
  C,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  C: PersonnelPageProps["C"];
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "11px 13px",
        borderRadius: 11,
        border: `1px solid ${C.inputBdr}`,
        background: disabled ? hexA(C.inputBg, 0.6) : C.inputBg,
        color: disabled ? C.txtMuted : C.txtPrimary,
        fontFamily: "var(--font-outfit)",
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </select>
  );
}

export function AttendanceSessionPage({ C, accent }: PersonnelPageProps) {
  const { lang } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const so = lang === "so";
  const { data: qeybs = [] } = useQeybs();
  const { data: attendanceStatuses = [] } = useAttendanceStatuses();
  const { data: absenceReasons = [] } = useAbsenceReasons();
  const openSection = useOpenAttendanceSection();

  const today = new Date().toISOString().slice(0, 10);
  const [departmentId, setDepartmentId] = useState("");
  const [districtScope, setDistrictScope] = useState<DistrictScope>("all");
  const [countyId, setCountyId] = useState("");
  const [date, setDate] = useState(today);
  const [sessionType, setSessionType] = useState("morning");
  const [activeSession, setActiveSession] = useState<AttendanceSectionOpenResult | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [marks, setMarks] = useState<AttendanceMap>({});
  const [saving, setSaving] = useState(false);
  const [transferAgent, setTransferAgent] = useState<AgentSummary | null>(null);

  const selectedQeyb = useMemo(
    () => qeybs.find((q) => String(q.id) === departmentId),
    [qeybs, departmentId],
  );

  const sectionDistricts = selectedQeyb?.counties ?? [];

  const filteredAgents = useMemo(() => {
    const agents = activeSession?.agents ?? [];
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.service_id.toLowerCase().includes(q)
        || a.name.toLowerCase().includes(q)
        || a.phone.toLowerCase().includes(q)
        || (a.county_name ?? "").toLowerCase().includes(q),
    );
  }, [activeSession?.agents, deferredSearch]);

  const stats = useMemo(() => {
    const agents = activeSession?.agents ?? [];
    let present = 0;
    let absent = 0;
    let pending = 0;
    for (const agent of agents) {
      const code = marks[agent.agent_id]?.status_code ?? agent.attendance?.status_code;
      if (!code) pending += 1;
      else if (code === "PRESENT") present += 1;
      else absent += 1;
    }
    return { total: agents.length, present, absent, pending, changed: Object.keys(marks).length };
  }, [activeSession?.agents, marks]);

  const handleOpenSession = async () => {
    if (!departmentId) return;
    if (districtScope === "one" && !countyId) return;
    const result = await openSection.mutateAsync({
      department_id: Number(departmentId),
      county_id: districtScope === "one" ? Number(countyId) : null,
      date,
      session: sessionType,
    });
    setActiveSession(result);
    setMarks({});
  };

  const setMark = (agentId: number, status_code: string, absence_reason_code?: string) => {
    setMarks((prev) => {
      const entry: AttendanceMap[number] = { status_code };
      if (absence_reason_code) entry.absence_reason_code = absence_reason_code;
      if (prev[agentId]?.notes) entry.notes = prev[agentId].notes;
      return { ...prev, [agentId]: entry };
    });
  };

  const refreshActiveSession = async () => {
    if (!activeSession) return;
    const refreshed = await openSection.mutateAsync({
      department_id: activeSession.department_id,
      county_id: activeSession.scope === "district" ? activeSession.sessions[0]?.county : null,
      date: activeSession.date,
      session: activeSession.session,
    });
    setActiveSession(refreshed);
  };

  const handleSave = async () => {
    if (!activeSession || !Object.keys(marks).length) return;
    setSaving(true);
    try {
      const sessionByAgent = new Map<number, number>();
      for (const agent of activeSession.agents) {
        if (agent.session_id) sessionByAgent.set(agent.agent_id, agent.session_id);
      }
      const grouped = new Map<number, { agent_id: number; status_code: string; absence_reason_code?: string; notes?: string }[]>();
      for (const [agentIdStr, mark] of Object.entries(marks)) {
        const agentId = Number(agentIdStr);
        const sessionId = sessionByAgent.get(agentId);
        if (!sessionId) continue;
        const bucket = grouped.get(sessionId) ?? [];
        bucket.push({
          agent_id: agentId,
          status_code: mark.status_code,
          absence_reason_code: mark.absence_reason_code,
          notes: mark.notes,
        });
        grouped.set(sessionId, bucket);
      }
      await Promise.all(
        [...grouped.entries()].map(([sessionId, records]) => bulkRecordAttendance(sessionId, records)),
      );
      setMarks({});
      toast({ title: so ? "Imaanshaha waa la kaydiyay" : "Attendance saved" });
      await refreshActiveSession();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || (so ? "Kaydinta wuu fashilmay" : "Save failed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const presentCode = attendanceStatuses.find((s) => s.code === "PRESENT")?.code ?? "PRESENT";
  const absentCode = attendanceStatuses.find((s) => s.code === "ABSENT")?.code ?? "ABSENT";

  const sessionLabel = useMemo(() => {
    if (!activeSession) return "";
    const scopeLabel =
      activeSession.scope === "section"
        ? so ? "Dhammaan degmooyinka" : "All districts"
        : activeSession.sessions[0]?.county_name ?? "";
    return `${activeSession.department_name} · ${scopeLabel} · ${activeSession.date} · ${activeSession.session}`;
  }, [activeSession, so]);

  const markAllPresent = () => {
    const next: AttendanceMap = {};
    for (const agent of activeSession?.agents ?? []) {
      next[agent.agent_id] = { status_code: presentCode };
    }
    setMarks(next);
  };

  return (
    <div style={{ animation: "is-fadeUp .45s ease both", paddingBottom: 32 }}>
      {/* Hero */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: accent,
                boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
              }}
            />
            <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: accent, fontWeight: 600, fontFamily: "var(--font-outfit)" }}>
              {so ? "Imaanshaha" : "Attendance"}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "clamp(22px, 2.8vw, 30px)", color: C.txtPrimary, margin: 0 }}>
            {so ? "Imaanshaha Ciidanka" : "Agent Attendance"}
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.5, fontFamily: "var(--font-outfit)" }}>
            {so
              ? "Dooro qaybta, kadibna ku calaamadee joogitaanka adigoo isticmaalaya 4-ta lambar ee ugu dambeeya"
              : "Select a section, then mark attendance using the last 4 digits of Agent ID"}
          </p>
        </div>
      </div>

      {!activeSession ? (
        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${C.cardBdr}`,
            background: C.cardBg,
            boxShadow: C.cardShadow,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderBottom: `1px solid ${C.tableSep}`,
              background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
            }}
          >
            <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
              {so ? "Fur Fadhiga Imaanshaha" : "Open Attendance Session"}
            </div>
            <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)" }}>
              {so ? "Dooro qaybta, baaxadda degmada, taariikhda iyo fadhiga" : "Choose section, district scope, date and session"}
            </div>
          </div>

          <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FieldLabel C={C}>{so ? "Qaybta" : "Section"}</FieldLabel>
                <SelectInput
                  value={departmentId}
                  onChange={(v) => {
                    setDepartmentId(v);
                    setCountyId("");
                  }}
                  C={C}
                >
                  <option value="">{so ? "Dooro qaybta" : "Select section"}</option>
                  {qeybs.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}{q.counties?.length ? ` (${q.counties.length} ${so ? "degmo" : "districts"})` : ""}
                    </option>
                  ))}
                </SelectInput>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FieldLabel C={C}>{so ? "Baaxadda Degmada" : "District Scope"}</FieldLabel>
                <SelectInput
                  value={districtScope}
                  onChange={(v) => {
                    setDistrictScope(v as DistrictScope);
                    if (v === "all") setCountyId("");
                  }}
                  disabled={!departmentId}
                  C={C}
                >
                  <option value="all">{so ? "Dhammaan degmooyinka qaybta" : "All districts in section"}</option>
                  <option value="one">{so ? "Hal degmo" : "One district only"}</option>
                </SelectInput>
              </label>

              {districtScope === "one" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <FieldLabel C={C}>{so ? "Degmo" : "District"}</FieldLabel>
                  <SelectInput
                    value={countyId}
                    onChange={setCountyId}
                    disabled={!departmentId}
                    C={C}
                  >
                    <option value="">{so ? "Dooro degmo" : "Select district"}</option>
                    {sectionDistricts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectInput>
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FieldLabel C={C}>{so ? "Taariikh" : "Date"}</FieldLabel>
                <TextInput type="date" value={date} onChange={setDate} placeholder={so ? "Taariikh" : "Date"} C={C} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FieldLabel C={C}>{so ? "Fadhiga" : "Session"}</FieldLabel>
                <SelectInput value={sessionType} onChange={setSessionType} C={C}>
                  <option value="morning">{so ? "Subax" : "Morning"}</option>
                  <option value="afternoon">{so ? "Galab" : "Afternoon"}</option>
                  <option value="evening">{so ? "Habeen" : "Evening"}</option>
                </SelectInput>
              </label>
            </div>

            {selectedQeyb && sectionDistricts.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: hexA(accent, isDark ? 0.08 : 0.06),
                  border: `1px solid ${hexA(accent, 0.2)}`,
                }}
              >
                <span style={{ fontSize: 12, color: C.txtSecondary, fontFamily: "var(--font-outfit)", width: "100%", marginBottom: 2 }}>
                  {districtScope === "all"
                    ? (so ? "Degmooyinka qaybtan:" : "Districts in this section:")
                    : (so ? "Degmo la dooran karo:" : "Available districts:")}
                </span>
                {sectionDistricts.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontFamily: "var(--font-outfit)",
                      background: C.cardBg,
                      border: `1px solid ${C.cardBdr}`,
                      color: countyId === String(c.id) ? accent : C.txtSecondary,
                      fontWeight: countyId === String(c.id) ? 600 : 400,
                    }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
              <PrimaryButton
                accent={accent}
                onClick={handleOpenSession}
                disabled={
                  !departmentId
                  || (districtScope === "one" && !countyId)
                  || openSection.isPending
                  || (selectedQeyb != null && sectionDistricts.length === 0)
                }
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon name="check" size={16} sw={2} />
                  {openSection.isPending ? (so ? "Furaya…" : "Opening…") : (so ? "Fur Fadhiga" : "Open Session")}
                </span>
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Session toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderRadius: 14,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              boxShadow: C.cardShadow,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 14, color: C.txtPrimary }}>
                {sessionLabel}
              </div>
              <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3, fontFamily: "var(--font-outfit)" }}>
                {activeSession.sessions.length} {so ? "fadhiyo degmo" : "district session(s)"} · {stats.total} {so ? "ciidan" : "agents"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TextInput placeholder={so ? "Raadi ID / Magac / Degmo" : "Search ID / Name / District"} value={search} onChange={setSearch} C={C} />
              <SecondaryButton C={C} onClick={markAllPresent}>{so ? "Dhammaan Joog" : "Mark All Present"}</SecondaryButton>
              <SecondaryButton C={C} onClick={() => { setActiveSession(null); setMarks({}); }}>
                {so ? "Fadhiga Cusub" : "New Session"}
              </SecondaryButton>
              <PrimaryButton accent={accent} onClick={handleSave} disabled={saving || !stats.changed}>
                {saving ? (so ? "Kaydinaya…" : "Saving…") : (so ? "Kaydi" : "Save Attendance")}
              </PrimaryButton>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
            {[
              { label: so ? "Wadar" : "Total", value: stats.total, color: accent },
              { label: so ? "Joog" : "Present", value: stats.present, color: "#46c08a" },
              { label: so ? "Maqan" : "Absent", value: stats.absent, color: "#e0655a" },
              { label: so ? "Sugitaan" : "Pending", value: stats.pending, color: C.txtMuted },
              { label: so ? "Isbeddel" : "Changed", value: stats.changed, color: "#b8860b" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${C.cardBdr}`,
                  background: C.cardBg,
                  textAlign: "center",
                }}
              >
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 22, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Agent table */}
          <div style={{ overflowX: "auto", borderRadius: 16, border: `1px solid ${C.cardBdr}`, background: C.cardBg, boxShadow: C.cardShadow }}>
            <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.tableHead, textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  <th style={{ padding: "13px 16px" }}>ID</th>
                  <th style={{ padding: "13px 16px" }}>{so ? "Ciidan" : "Agent"}</th>
                  {activeSession.scope === "section" && (
                    <th style={{ padding: "13px 16px" }}>{so ? "Degmo" : "District"}</th>
                  )}
                  <th style={{ padding: "13px 16px" }}>{so ? "Taleefan" : "Phone"}</th>
                  <th style={{ padding: "13px 16px" }}>{so ? "Xaalad" : "Status"}</th>
                  <th style={{ padding: "13px 16px" }}>{so ? "Imaansho" : "Attendance"}</th>
                </tr>
              </thead>
              <tbody>
                {!filteredAgents.length ? (
                  <tr>
                    <td colSpan={activeSession.scope === "section" ? 6 : 5} style={{ padding: 32, textAlign: "center", color: C.txtMuted }}>
                      {so ? "Ciidan lama helin" : "No agents found"}
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <AgentAttendanceRow
                      key={agent.agent_id}
                      agent={agent}
                      marks={marks}
                      setMarks={setMarks}
                      setMark={setMark}
                      presentCode={presentCode}
                      absentCode={absentCode}
                      absenceReasons={absenceReasons}
                      showDistrict={activeSession.scope === "section"}
                      accent={accent}
                      onTransfer={() => setTransferAgent(toTransferAgent(agent))}
                      C={C}
                      so={so}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TransferFormModal
            open={!!transferAgent}
            onClose={() => setTransferAgent(null)}
            onSuccess={refreshActiveSession}
            agent={transferAgent}
            C={C}
            accent={accent}
          />
        </>
      )}
    </div>
  );
}

function AgentAttendanceRow({
  agent,
  marks,
  setMarks,
  setMark,
  presentCode,
  absentCode,
  absenceReasons,
  showDistrict,
  accent,
  onTransfer,
  C,
  so,
}: {
  agent: AttendanceAgentRow;
  marks: AttendanceMap;
  setMarks: React.Dispatch<React.SetStateAction<AttendanceMap>>;
  setMark: (id: number, code: string, absenceReasonCode?: string) => void;
  presentCode: string;
  absentCode: string;
  absenceReasons: { id: number; code: string; name: string; name_so?: string }[];
  showDistrict: boolean;
  accent: string;
  onTransfer: () => void;
  C: PersonnelPageProps["C"];
  so: boolean;
}) {
  const current = marks[agent.agent_id];
  const saved = agent.attendance;
  const activeCode = current?.status_code ?? saved?.status_code;
  const activeReasonCode = current?.absence_reason_code ?? saved?.absence_reason_code;
  const activeReason = absenceReasons.find((r) => r.code === activeReasonCode);

  return (
    <tr style={{ borderTop: `1px solid ${C.tableSep}` }}>
      <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 17, color: C.txtPrimary, fontFamily: "var(--font-cinzel)", fontVariantNumeric: "tabular-nums" }}>
        {agent.service_id_last4}
      </td>
      <td style={{ padding: "12px 16px", color: C.txtPrimary, fontWeight: 500 }}>{agent.name}</td>
      {showDistrict && (
        <td style={{ padding: "12px 16px", color: C.txtSecondary }}>{agent.county_name || "—"}</td>
      )}
      <td style={{ padding: "12px 16px", color: C.txtSecondary, fontVariantNumeric: "tabular-nums" }}>{agent.phone}</td>
      <td style={{ padding: "12px 16px", color: C.txtSecondary }}>{agent.status_name}</td>
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", maxWidth: 520 }}>
          <AttendanceToggle
            label={so ? "Joog" : "Present"}
            active={activeCode === presentCode}
            activeColor="#46c08a"
            onClick={() => setMark(agent.agent_id, presentCode)}
            C={C}
          />
          <AttendanceToggle
            label={so ? "Maqan" : "Absent"}
            active={activeCode === absentCode && !activeReasonCode}
            activeColor="#c44a3f"
            onClick={() => setMark(agent.agent_id, absentCode)}
            C={C}
          />
          {QUICK_ABSENCE_REASONS.map((reason) => (
            <AttendanceToggle
              key={reason.code}
              label={so ? reason.labelSo : reason.labelEn}
              active={activeCode === absentCode && activeReasonCode === reason.code}
              activeColor={reason.color}
              onClick={() => setMark(agent.agent_id, absentCode, reason.code)}
              C={C}
            />
          ))}
          <AttendanceToggle
            label={so ? "Badal" : "Transfer"}
            active={false}
            activeColor={accent}
            onClick={onTransfer}
            C={C}
            outline
            accent={accent}
          />
          {activeCode === absentCode && !QUICK_ABSENCE_REASONS.some((r) => r.code === activeReasonCode) && (
            <select
              value={current?.absence_reason_code ?? saved?.absence_reason_code ?? ""}
              onChange={(e) =>
                setMarks((prev) => ({
                  ...prev,
                  [agent.agent_id]: {
                    ...prev[agent.agent_id],
                    status_code: absentCode,
                    absence_reason_code: e.target.value,
                  },
                }))
              }
              style={{
                padding: "7px 10px",
                borderRadius: 9,
                border: `1px solid ${C.inputBdr}`,
                background: C.inputBg,
                color: C.txtPrimary,
                fontFamily: "var(--font-outfit)",
                fontSize: 12,
              }}
            >
              <option value="">{so ? "Sabab kale" : "Other reason"}</option>
              {absenceReasons
                .filter((r) => !QUICK_ABSENCE_REASONS.some((q) => q.code === r.code))
                .map((r) => (
                  <option key={r.id} value={r.code}>{so && r.name_so ? r.name_so : r.name}</option>
                ))}
            </select>
          )}
          {activeReason && activeCode === absentCode && (
            <span style={{ fontSize: 11, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {so && activeReason.name_so ? activeReason.name_so : activeReason.name}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function AttendanceToggle({
  label,
  active,
  activeColor,
  onClick,
  C,
  outline,
  accent,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
  C: PersonnelPageProps["C"];
  outline?: boolean;
  accent?: string;
}) {
  const borderColor = outline ? (accent ?? activeColor) : (active ? activeColor : C.inputBdr);
  const background = outline ? C.inputBg : (active ? activeColor : C.inputBg);
  const color = outline ? (accent ?? activeColor) : (active ? "#fff" : C.txtSecondary);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 9,
        border: `1px solid ${borderColor}`,
        cursor: "pointer",
        background,
        color,
        fontFamily: "var(--font-outfit)",
        fontSize: 11.5,
        fontWeight: active || outline ? 600 : 500,
        transition: "all .15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
