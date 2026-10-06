"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { fetchCounties } from "@/lib/accounts-api";
import { STALE_LIST_MS } from "@/lib/query-config";
import {
  useChangeAgentCounty,
  useCreateAgentFromStaff,
  useSearchAgentHrm,
  useSearchAgentStaff,
} from "@/hooks/use-agents";
import {
  AccountModal,
  PrimaryButton,
  SecondaryButton,
  type AccountsThemeColors,
} from "./accounts-shared";
import type {
  AgentHrmSearchResult,
  AgentStaffSearchHit,
  AgentStaffSearchResult,
  StaffPayrollHit,
} from "@/types/agents";

type ThemeColors = AccountsThemeColors;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function Copyable({
  value,
  C,
  tone = "green",
}: {
  value: string;
  C: ThemeColors;
  tone?: "green" | "blue";
}) {
  const [copied, setCopied] = useState(false);
  const v = value || "—";
  const bg = tone === "blue" ? hexA("#3b82f6", 0.16) : hexA("#46c08a", 0.16);
  return (
    <code
      title={value ? "Click to copy" : undefined}
      style={{
        cursor: value ? "pointer" : "default",
        userSelect: "all",
        background: copied ? hexA("#46c08a", 0.28) : bg,
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 12.5,
        color: C.txtPrimary,
        fontFamily: "var(--font-outfit)",
      }}
      onClick={async () => {
        if (!value) return;
        const ok = await copyText(value);
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1000);
      }}
    >
      {copied ? "Copied!" : v}
    </code>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "3px 9px",
        borderRadius: 8,
        fontSize: 11.5,
        fontWeight: 600,
        background: hexA(color, 0.14),
        color,
        border: `1px solid ${hexA(color, 0.28)}`,
        fontFamily: "var(--font-outfit)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  C,
  tone = "green",
}: {
  label: string;
  value: string;
  C: ThemeColors;
  tone?: "green" | "blue";
}) {
  return (
    <div style={{ fontSize: 13, fontFamily: "var(--font-outfit)", marginBottom: 6, color: C.txtPrimary }}>
      <strong style={{ color: C.txtMuted, fontWeight: 600 }}>{label}: </strong>
      <Copyable value={value} C={C} tone={tone} />
    </div>
  );
}

export function AmnigaStaffSearchModal({
  open,
  onClose,
  title,
  C,
  accent,
  mode,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  C: ThemeColors;
  accent: string;
  mode: "staff" | "hrm";
  onCreated?: () => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [query, setQuery] = useState("");
  const [createFor, setCreateFor] = useState<StaffPayrollHit | null>(null);
  const [changeCountyFor, setChangeCountyFor] = useState<AgentStaffSearchHit | null>(null);
  const [gender, setGender] = useState("Male");
  const [countyId, setCountyId] = useState("");
  const [newCountyId, setNewCountyId] = useState("");
  const [profile, setProfile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const staffSearch = useSearchAgentStaff();
  const hrmSearch = useSearchAgentHrm();
  const create = useCreateAgentFromStaff();
  const changeCounty = useChangeAgentCounty();
  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: fetchCounties,
    staleTime: STALE_LIST_MS,
    enabled: open,
  });

  const pending = mode === "staff" ? staffSearch.isPending : hrmSearch.isPending;
  const result: AgentStaffSearchResult | AgentHrmSearchResult | undefined =
    mode === "staff" ? staffSearch.data : hrmSearch.data;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCreateFor(null);
      setChangeCountyFor(null);
      setProfile(null);
      setCountyId("");
      setNewCountyId("");
      setGender("Male");
      staffSearch.reset();
      hrmSearch.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = () => {
    const q = query.trim();
    if (!q) return;
    if (mode === "staff") staffSearch.mutate(q);
    else hrmSearch.mutate(q);
  };

  const refreshSearch = () => {
    const q = query.trim();
    if (!q) return;
    if (mode === "staff") staffSearch.mutate(q);
    else hrmSearch.mutate(q);
  };

  const staffRows = (result?.staff_data ?? []) as StaffPayrollHit[];
  const agentRows = (result?.agents_data ?? []) as AgentStaffSearchHit[];
  const hrm = result as AgentHrmSearchResult | undefined;
  const staffMatched = result?.staff_terms_matched ?? staffRows.length;
  const searched = result?.searched_count ?? 0;

  const openChangeCounty = (agent: AgentStaffSearchHit) => {
    setChangeCountyFor(agent);
    setNewCountyId(agent.county_id ? String(agent.county_id) : "");
  };

  const submitChangeCounty = () => {
    if (!changeCountyFor || !newCountyId) return;
    changeCounty.mutate(
      {
        county_id: newCountyId,
        agent_id: changeCountyFor.id || undefined,
        service_id: changeCountyFor.service_id || undefined,
      },
      {
        onSuccess: () => {
          setChangeCountyFor(null);
          setNewCountyId("");
          onCreated?.();
          refreshSearch();
        },
      },
    );
  };

  const submitCreate = () => {
    if (!createFor || !countyId || !profile) return;
    create.mutate(
      {
        employee_id: createFor.employee_id,
        gender,
        county_id: countyId,
        profile,
      },
      {
        onSuccess: () => {
          setCreateFor(null);
          setProfile(null);
          onCreated?.();
          if (query.trim()) staffSearch.mutate(query.trim());
        },
      },
    );
  };

  const cardStyle = (color: string): CSSProperties => ({
    border: `1.5px solid ${hexA(color, 0.45)}`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    background: hexA(color, 0.04),
  });

  return (
    <>
      <AccountModal
        open={open && !createFor && !changeCountyFor}
        onClose={onClose}
        title={title}
        subtitle={t.appUsersSearchHint}
        C={C}
        accent={accent}
        size="xl"
        footer={
          <>
            <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
            {result && (
              <SecondaryButton
                onClick={() => {
                  staffSearch.reset();
                  hrmSearch.reset();
                }}
                C={C}
              >
                {lang === "so" ? "Raadi mar kale" : "Search Again"}
              </SecondaryButton>
            )}
            <PrimaryButton onClick={run} disabled={pending || !query.trim()} accent={accent}>
              {pending ? (lang === "so" ? "Raadinaya…" : "Searching…") : t.searchPh}
            </PrimaryButton>
          </>
        }
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={4}
          placeholder={t.appUsersSearchPlaceholder}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${C.inputBdr}`,
            background: C.inputBg,
            color: C.txtPrimary,
            fontFamily: "var(--font-outfit)",
            fontSize: 14,
            resize: "vertical",
          }}
        />

        {result && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {searched > 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.cardBdr}`,
                  background: C.inputBg,
                  fontSize: 13,
                  fontFamily: "var(--font-outfit)",
                  color: C.txtPrimary,
                }}
              >
                <strong>{lang === "so" ? "Soo koobid:" : "Search summary:"}</strong>{" "}
                {staffMatched} {lang === "so" ? "ka mid ah" : "of"} {searched} ID(s){" "}
                {lang === "so" ? "laga helay Staff payroll" : "found in Staff payroll"}
                {(result.missing_from_staff_count ?? 0) > 0 && (
                  <span style={{ color: "#e0655a" }}>
                    {" "}— {result.missing_from_staff_count} {lang === "so" ? "maahan Staff" : "missing from Staff"}
                  </span>
                )}
              </div>
            )}

            {mode === "hrm" && hrm && !hrm.configured && (
              <div style={{ padding: 12, borderRadius: 10, background: hexA("#e0655a", 0.1), color: "#e0655a", fontSize: 13 }}>
                {hrm.message}
              </div>
            )}

            {/* Staff payroll */}
            {staffRows.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#16a34a", fontFamily: "var(--font-outfit)" }}>
                  Staff Payroll Results ({staffMatched} {lang === "so" ? "ka mid ah" : "of"} {searched || staffRows.length} ID(s))
                </h3>
                {staffRows.map((s, i) => (
                  <div key={`${s.employee_id}-${i}`} style={cardStyle("#16a34a")}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: "#16a34a", fontFamily: "var(--font-outfit)" }}>
                      Staff Member {i + 1}
                    </div>
                    <Field label="Employee ID" value={s.employee_id} C={C} />
                    <Field label="Phone" value={s.number} C={C} />
                    <Field label="Name" value={s.name} C={C} />
                    <Field label="Grade" value={s.grade} C={C} />
                    <Field label="Position" value={s.position} C={C} />
                    <Field label="Directorate" value={s.directorate} C={C} />
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 13, color: C.txtMuted }}>{lang === "so" ? "Ficil:" : "Action:"}</strong>
                      {s.has_agent ? (
                        <Badge label="Has agent" color="#3b82f6" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCreateFor(s)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "#3b82f6",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 12.5,
                            cursor: "pointer",
                            fontFamily: "var(--font-outfit)",
                          }}
                        >
                          {lang === "so" ? "Create Agent / User" : "Create Agent"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* HRM rows */}
            {mode === "hrm" && (hrm?.hrm_data?.length ?? 0) > 0 && (
              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#7c3aed", fontFamily: "var(--font-outfit)" }}>
                  HRM Results ({hrm!.hrm_data!.length})
                </h3>
                {hrm!.hrm_data!.map((r, i) => (
                  <div key={`${r.employee_id}-${i}`} style={cardStyle(r.is_active ? "#7c3aed" : "#e0655a")}>
                    <Field label="Employee ID" value={r.employee_id} C={C} />
                    <Field label="Name" value={r.name} C={C} />
                    <Field label="Phone" value={r.phone} C={C} />
                    <Field label="Position" value={r.position} C={C} />
                    <Field label="Status" value={r.status || (r.is_active ? "Active" : "Inactive")} C={C} />
                  </div>
                ))}
              </div>
            )}

            {/* Agents */}
            {agentRows.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#7c3aed", fontFamily: "var(--font-outfit)" }}>
                  Agents Database Results ({agentRows.length})
                </h3>
                {agentRows.map((a, i) => (
                  <div key={a.id || `${a.employee_id}-${i}`} style={cardStyle("#7c3aed")}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: "#7c3aed", fontFamily: "var(--font-outfit)" }}>
                      Agent {i + 1}
                    </div>
                    <Field label="Employee ID" value={a.employee_id || a.nickname} C={C} tone="blue" />
                    <Field label="Service ID" value={a.service_id} C={C} tone="blue" />
                    <Field label="Phone" value={a.phone} C={C} tone="blue" />
                    <Field label="Name" value={a.name} C={C} tone="blue" />
                    <Field label="County" value={a.county_name} C={C} tone="blue" />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                      <Badge
                        label={a.user_status || (a.user_is_active ? "Active" : "Inactive")}
                        color={a.user_is_active ? "#46c08a" : "#9a8a6f"}
                      />
                      {(a.groups ?? []).map((g) => (
                        <Badge key={g.id} label={g.name} color="#3b82f6" />
                      ))}
                      {(a.service_id || a.id) && (
                        <button
                          type="button"
                          onClick={() => openChangeCounty(a)}
                          style={{
                            padding: "6px 11px",
                            borderRadius: 8,
                            border: "none",
                            background: "#0ea5e9",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 12.5,
                            cursor: "pointer",
                            fontFamily: "var(--font-outfit)",
                          }}
                        >
                          Change County
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(result.not_found_terms?.length ?? 0) > 0 && (
              <div style={{ fontSize: 12.5, color: "#e0655a", fontFamily: "var(--font-outfit)" }}>
                {t.appUsersNotFound}: {result.not_found_terms!.join(", ")}
              </div>
            )}

            {result.debug && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: hexA("#3b82f6", 0.1),
                  color: C.txtPrimary,
                  fontSize: 12,
                  fontFamily: "var(--font-outfit)",
                }}
              >
                Debug: terms={(result.debug.search_terms as string[] | undefined)?.join(", ") || "—"}
                {" | "}staff={String(result.debug.staff_count ?? staffRows.length)}
                {" | "}agents={String(result.debug.agents_count ?? agentRows.length)}
              </div>
            )}

            {!result.exists && (
              <div style={{ padding: 16, textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                {result.message}
              </div>
            )}
          </div>
        )}
      </AccountModal>

      {/* Create Agent from Staff */}
      <AccountModal
        open={!!createFor}
        onClose={() => setCreateFor(null)}
        title={lang === "so" ? "Create Agent from Staff" : "Create Agent from Staff"}
        subtitle={createFor ? `${createFor.name} · ${createFor.employee_id}` : undefined}
        C={C}
        accent="#3b82f6"
        size="md"
        footer={
          <>
            <SecondaryButton onClick={() => setCreateFor(null)} C={C}>{t.cancelAction}</SecondaryButton>
            <PrimaryButton
              onClick={submitCreate}
              disabled={create.isPending || !countyId || !profile}
              accent="#3b82f6"
            >
              {create.isPending ? "…" : (lang === "so" ? "Create Agent" : "Create Agent")}
            </PrimaryButton>
          </>
        }
      >
        {createFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-outfit)" }}>
            <div style={{ fontSize: 13, color: C.txtMuted }}>
              Password = phone · DOB default 1991-06-26 · county applies to user + agent
            </div>
            <label style={{ fontSize: 13, color: C.txtPrimary }}>
              Gender
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  color: C.txtPrimary,
                }}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label style={{ fontSize: 13, color: C.txtPrimary }}>
              County *
              <select
                value={countyId}
                onChange={(e) => setCountyId(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  color: C.txtPrimary,
                }}
              >
                <option value="">— Select county —</option>
                {counties.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 13, color: C.txtPrimary }}>
              Profile photo * (JPG/PNG, max 2.5MB)
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                onChange={(e) => setProfile(e.target.files?.[0] ?? null)}
                style={{ display: "block", marginTop: 6, width: "100%" }}
              />
            </label>
            {profile && (
              <div style={{ fontSize: 12, color: "#46c08a", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={14} /> {profile.name}
              </div>
            )}
          </div>
        )}
      </AccountModal>

      {/* Change County — v2 parity */}
      <AccountModal
        open={!!changeCountyFor}
        onClose={() => {
          setChangeCountyFor(null);
          setNewCountyId("");
        }}
        title="Change County"
        subtitle={
          changeCountyFor
            ? `${changeCountyFor.name} · Service ${changeCountyFor.service_id || "—"}`
            : undefined
        }
        C={C}
        accent="#0ea5e9"
        size="md"
        footer={
          <>
            <SecondaryButton
              onClick={() => {
                setChangeCountyFor(null);
                setNewCountyId("");
              }}
              C={C}
            >
              {t.cancelAction}
            </SecondaryButton>
            <PrimaryButton
              onClick={submitChangeCounty}
              disabled={changeCounty.isPending || !newCountyId}
              accent="#0ea5e9"
            >
              {changeCounty.isPending ? "…" : (lang === "so" ? "Kaydi" : "Save")}
            </PrimaryButton>
          </>
        }
      >
        {changeCountyFor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-outfit)" }}>
            <div style={{ fontSize: 13, color: C.txtPrimary }}>
              <strong style={{ color: C.txtMuted }}>Current county: </strong>
              {changeCountyFor.county_name || "N/A"}
            </div>
            <label style={{ fontSize: 13, color: C.txtPrimary }}>
              New county
              <select
                value={newCountyId}
                onChange={(e) => setNewCountyId(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  color: C.txtPrimary,
                }}
              >
                <option value="">— Select county —</option>
                {counties.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 12.5, color: C.txtMuted }}>
              Updates both Agent and User county.
            </div>
          </div>
        )}
      </AccountModal>
    </>
  );
}
