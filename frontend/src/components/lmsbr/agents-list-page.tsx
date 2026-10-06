"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useAgent,
  useAgentEligibleUsers,
  useAgents,
  useCreateAgent,
  useUpdateAgent,
} from "@/hooks/use-agents";
import { fetchCounties } from "@/lib/accounts-api";
import { useQeybs, useUserTypes } from "@/hooks/use-accounts";
import { STALE_LIST_MS } from "@/lib/query-config";
import { resolveMediaUrl } from "@/lib/media-url";
import { ShimmerForcesTable } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { AgentProfilePage } from "./agent-profile-page";
import {
  AccountModal,
  FormField,
  FormRow,
  FormSection,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextInput,
  nativeFieldStyle,
  type AccountsThemeColors,
} from "./accounts-shared";
import { useTheme } from "./theme-ctx";
import type { AgentEligibleUser, AgentSummary, CreateAgentPayload } from "@/types/agents";

type ThemeColors = AccountsThemeColors & {
  cardShadow?: string;
  panelShadow?: string;
  tableHov?: string;
};

type UserMode = "existing" | "new";

const PRESENT_OPTIONS = [
  { value: "Joogey", label: "Joogey" },
  { value: "Maqan", label: "Maqan" },
  { value: "Xanuunsan", label: "Xanuunsan" },
  { value: "Staff", label: "Staff" },
  { value: "Fakad", label: "Fakad" },
  { value: "Fasax", label: "Fasax" },
];

function RoleBadge({ role }: { role: string }) {
  const color =
    role === "admin" ? "#e0655a"
      : role === "officer" ? "#5b9fd4"
        : role === "agent" ? "#3b82f6"
          : "#9a8a6f";
  const label = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Agent";
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
      background: hexA(color, 0.12), color, border: `1px solid ${hexA(color, 0.25)}`,
      fontFamily: "var(--font-outfit)", textTransform: "capitalize",
    }}>
      {label}
    </span>
  );
}

function ActiveBadge({ active, present }: { active: boolean; present: string }) {
  const color = active ? "#46c08a" : "#9a8a6f";
  const label = active ? "Active" : "Inactive";
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 20,
      background: hexA(color, 0.12), color, border: `1px solid ${hexA(color, 0.25)}`,
      fontFamily: "var(--font-outfit)",
    }} title={present || undefined}>
      {label}
    </span>
  );
}

function PresentBadge({ present }: { present: string }) {
  const color =
    present === "Joogey" ? "#46c08a"
      : present === "Maqan" ? "#e0655a"
        : present === "Xanuunsan" ? "#5b9fd4"
          : "#e6b25c";
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 20,
      background: hexA(color, 0.12), color, border: `1px solid ${hexA(color, 0.25)}`,
      fontFamily: "var(--font-outfit)",
    }}>
      {present || "—"}
    </span>
  );
}

const EMPTY_FORM = {
  first_name: "",
  father_name: "",
  last_name: "",
  fourth_name: "",
  mother_name: "",
  phone: "",
  date_of_birth: "",
  county: "",
  email: "",
  password: "",
  username: "",
  user_type: "",
  department: "",
};

function parseOptId(raw: string) {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isTaliyeQebeed(types: { id: number; name: string }[], typeId: string) {
  const id = parseOptId(typeId);
  if (id == null) return false;
  return (types.find((x) => x.id === id)?.name || "").toLowerCase() === "taliye_qebeed";
}

function applyUserToForm(user: AgentEligibleUser) {
  const parts = user.full_name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "",
    father_name: parts[1] || "",
    last_name: parts[2] || parts[1] || "",
    fourth_name: parts[3] || parts[parts.length - 1] || "",
    mother_name: "",
    phone: user.phone || "",
    date_of_birth: "",
    county: "",
    email: user.email || "",
    password: "",
    username: user.username || "",
    user_type: "",
    department: "",
  };
}

function EditAgentModal({
  agentId,
  onClose,
  C,
  accent,
  isDark,
}: {
  agentId: string | null;
  onClose: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: agent, isLoading } = useAgent(agentId);
  const updateAgent = useUpdateAgent(agentId ?? "");
  const { data: counties = [] } = useQuery({
    queryKey: ["accounts", "counties"],
    queryFn: fetchCounties,
    enabled: !!agentId,
    staleTime: STALE_LIST_MS,
  });
  const { data: userTypes = [] } = useUserTypes();
  const { data: qeybs = [] } = useQeybs();
  const fieldStyle = nativeFieldStyle(C, isDark);
  const [form, setForm] = useState({
    first_name: "",
    father_name: "",
    last_name: "",
    fourth_name: "",
    mother_name: "",
    phone: "",
    date_of_birth: "",
    county: "",
    present: "Joogey",
    user_type: "",
    department: "",
  });

  useEffect(() => {
    if (!agent) return;
    setForm({
      first_name: agent.first_name || "",
      father_name: agent.father_name || "",
      last_name: agent.last_name || "",
      fourth_name: agent.fourth_name || "",
      mother_name: agent.mother_name || "",
      phone: agent.phone || "",
      date_of_birth: agent.date_of_birth || "",
      county: agent.county != null ? String(agent.county) : "",
      present: agent.present || "Joogey",
      user_type: agent.user_type != null ? String(agent.user_type) : "",
      department: agent.department != null ? String(agent.department) : "",
    });
  }, [agent]);

  const qebeedNeedsQeyb = isTaliyeQebeed(userTypes, form.user_type) && !form.department;
  const canSubmit =
    !!form.first_name.trim()
    && !!form.father_name.trim()
    && !!form.last_name.trim()
    && !!form.fourth_name.trim()
    && !!form.mother_name.trim()
    && !!form.phone.trim()
    && !!form.date_of_birth.trim()
    && !qebeedNeedsQeyb;

  const submit = () => {
    if (!agentId || !canSubmit) return;
    updateAgent.mutate(
      {
        first_name: form.first_name.trim(),
        father_name: form.father_name.trim(),
        last_name: form.last_name.trim(),
        fourth_name: form.fourth_name.trim(),
        mother_name: form.mother_name.trim(),
        phone: form.phone.trim(),
        date_of_birth: form.date_of_birth.trim(),
        present: form.present,
        county: form.county ? Number(form.county) : null,
        user_type: parseOptId(form.user_type),
        department: parseOptId(form.department),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <AccountModal
      open={!!agentId}
      onClose={onClose}
      title={t.agentEditTitle}
      C={C}
      accent={accent}
      size="lg"
      zIndex={1200}
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={!canSubmit || updateAgent.isPending || isLoading} accent={accent}>
            {updateAgent.isPending ? "…" : t.saveChanges}
          </PrimaryButton>
        </>
      }
    >
      {isLoading || !agent ? (
        <div style={{ color: C.txtMuted, fontFamily: "var(--font-outfit)", padding: 12 }}>…</div>
      ) : (
        <FormRow>
          <FormField label={t.agentFirstName} required C={C}>
            <TextInput value={form.first_name} onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} C={C} />
          </FormField>
          <FormField label={t.agentFatherName} required C={C}>
            <TextInput value={form.father_name} onChange={(v) => setForm((f) => ({ ...f, father_name: v }))} C={C} />
          </FormField>
          <FormField label={t.agentLastName} required C={C}>
            <TextInput value={form.last_name} onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} C={C} />
          </FormField>
          <FormField label={t.agentFourthName} required C={C}>
            <TextInput value={form.fourth_name} onChange={(v) => setForm((f) => ({ ...f, fourth_name: v }))} C={C} />
          </FormField>
          <FormField label={t.agentMotherName} required C={C}>
            <TextInput value={form.mother_name} onChange={(v) => setForm((f) => ({ ...f, mother_name: v }))} C={C} />
          </FormField>
          <FormField label={t.agentPhone} required C={C}>
            <TextInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} C={C} />
          </FormField>
          <FormField label={t.agentDob} required C={C}>
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} style={fieldStyle} />
          </FormField>
          <FormField label={t.agentCounty} C={C}>
            <select value={form.county} onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))} style={fieldStyle}>
              <option value="">{t.agentSelectCounty}</option>
              {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label={t.userType} C={C}>
            <select
              value={form.user_type}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, user_type: v, department: isTaliyeQebeed(userTypes, v) ? f.department : "" }));
              }}
              style={fieldStyle}
            >
              <option value="">{t.userTypeNone}</option>
              {userTypes.map((ut) => <option key={ut.id} value={String(ut.id)}>{ut.name}</option>)}
            </select>
          </FormField>
          <FormField label={t.userQeyb} required={isTaliyeQebeed(userTypes, form.user_type)} C={C}>
            <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} style={fieldStyle}>
              <option value="">{t.userQeybNone}</option>
              {qeybs.map((q) => <option key={q.id} value={String(q.id)}>{q.name}</option>)}
            </select>
          </FormField>
          <FormField label={t.agentPresent} C={C}>
            <select value={form.present} onChange={(e) => setForm((f) => ({ ...f, present: e.target.value }))} style={fieldStyle}>
              {PRESENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
        </FormRow>
      )}
    </AccountModal>
  );
}

export function AgentsListPage({
  C,
  accent,
  registerAddAction,
  variant = "default",
}: {
  C: ThemeColors;
  accent: string;
  registerAddAction?: (open: () => void) => void;
  variant?: "default" | "ciidan";
}) {
  const router = useRouter();
  const { lang } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = getDict(lang);
  const isCiidan = variant === "ciidan";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [presentFilter, setPresentFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  /** Only used for User Control agents (non-ciidan). Ciidan uses /amniga/ciidan/[id]. */
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [userMode, setUserMode] = useState<UserMode>("existing");
  const [userId, setUserId] = useState<number | "">("");
  const [userSearch, setUserSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const deferred = useDeferredValue(search);
  const deferredUserSearch = useDeferredValue(userSearch);
  const { data, isLoading, isFetching, isPlaceholderData } = useAgents({
    page,
    search: deferred,
    county: countyFilter,
    present: presentFilter,
    active: activeFilter,
    pageSize,
  });
  const showShimmer = isLoading && !data;
  const { data: eligibleUsers = [] } = useAgentEligibleUsers(
    deferredUserSearch,
    showCreate && userMode === "existing",
  );
  const { data: counties = [] } = useQuery({
    queryKey: ["accounts", "counties"],
    queryFn: fetchCounties,
    staleTime: STALE_LIST_MS,
  });
  const { data: userTypes = [] } = useUserTypes();
  const { data: qeybs = [] } = useQeybs();
  const createAgent = useCreateAgent();

  useEffect(() => {
    registerAddAction?.(() => setShowCreate(true));
  }, [registerAddAction]);

  useEffect(() => {
    setPage(1);
  }, [deferred, countyFilter, presentFilter, activeFilter, pageSize]);

  useEffect(() => {
    if (!data) return;
    const max = Math.max(1, Math.ceil(data.count / pageSize));
    if (page > max) setPage(max);
  }, [data?.count, page, pageSize]);

  const rows = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;
  const titleAdd = isCiidan ? t.addForce : t.addAgent;
  const emptyLabel = isCiidan ? t.forcesNoResults : t.agentsNoResults;
  const fieldStyle = nativeFieldStyle(C, isDark);

  const resetCreate = () => {
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setUserId("");
    setUserSearch("");
    setUserMode("existing");
  };

  const selectUser = (id: number | "") => {
    setUserId(id);
    if (id === "") return;
    const user = eligibleUsers.find((u) => u.id === id);
    if (user) setForm((prev) => ({ ...prev, ...applyUserToForm(user) }));
  };

  const switchMode = (mode: UserMode) => {
    setUserMode(mode);
    setUserId("");
    setUserSearch("");
    setForm(EMPTY_FORM);
  };

  const canSubmit =
    !!form.first_name.trim()
    && !!form.father_name.trim()
    && !!form.last_name.trim()
    && !!form.fourth_name.trim()
    && !!form.mother_name.trim()
    && !!form.phone.trim()
    && !!form.date_of_birth.trim()
    && !(isTaliyeQebeed(userTypes, form.user_type) && !form.department)
    && (userMode === "existing"
      ? userId !== ""
      : !!form.email.trim() && form.password.length >= 8);

  const submitCreate = () => {
    if (!canSubmit) return;
    const payload: CreateAgentPayload = {
      first_name: form.first_name.trim(),
      father_name: form.father_name.trim(),
      last_name: form.last_name.trim(),
      fourth_name: form.fourth_name.trim(),
      mother_name: form.mother_name.trim(),
      phone: form.phone.trim(),
      date_of_birth: form.date_of_birth.trim(),
    };
    if (form.county) payload.county = Number(form.county);
    payload.user_type = parseOptId(form.user_type);
    payload.department = parseOptId(form.department);
    if (userMode === "existing") {
      payload.user = Number(userId);
      if (form.email.trim()) payload.email = form.email.trim();
    } else {
      payload.email = form.email.trim();
      payload.password = form.password;
      if (form.username.trim()) payload.username = form.username.trim();
    }
    createAgent.mutate(payload, {
      onSuccess: (created) => {
        resetCreate();
        if (created?.id == null) return;
        if (isCiidan) {
          router.push(`/dashboard/amniga/ciidan/${created.id}`);
        } else {
          setProfileId(String(created.id));
        }
      },
    });
  };

  const openAgent = (id: string | number) => {
    if (isCiidan) {
      router.push(`/dashboard/amniga/ciidan/${id}`);
      return;
    }
    setProfileId(String(id));
  };

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const createModal = (
    <AccountModal
      open={showCreate}
      onClose={resetCreate}
      title={titleAdd}
      subtitle={t.agentMustBeUser}
      C={C}
      accent={accent}
      size="lg"
      zIndex={1200}
      footer={
        <>
          <SecondaryButton onClick={resetCreate} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton onClick={submitCreate} disabled={createAgent.isPending || !canSubmit} accent={accent}>
            {createAgent.isPending ? "…" : titleAdd}
          </PrimaryButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {([
          { id: "existing" as const, label: t.agentLinkExistingUser },
          { id: "new" as const, label: t.agentCreateNewUser },
        ]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => switchMode(opt.id)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${userMode === opt.id ? hexA(accent, 0.45) : C.inputBdr}`,
              background: userMode === opt.id ? hexA(accent, 0.12) : C.inputBg,
              color: userMode === opt.id ? accent : C.txtSecondary,
              fontFamily: "var(--font-outfit)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <FormSection
        title={t.agentUserAccount}
        description={userMode === "existing" ? t.agentSelectUserHint : t.agentNewUserHint}
        C={C}
      >
        {userMode === "existing" ? (
          <FormRow columns={1}>
            <FormField label={t.agentSearchUsers} C={C}>
              <TextInput
                value={userSearch}
                onChange={(v) => setUserSearch(v)}
                placeholder={t.agentSearchUsers}
                C={C}
              />
            </FormField>
            <FormField label={t.agentSelectUser} required C={C}>
              <select
                value={userId}
                onChange={(e) => selectUser(e.target.value ? Number(e.target.value) : "")}
                style={fieldStyle}
              >
                <option value="">{t.agentSelectUser}</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.email}
                  </option>
                ))}
              </select>
            </FormField>
          </FormRow>
        ) : (
          <FormRow>
            <FormField label={t.agentUserEmail} required C={C}>
              <TextInput value={form.email} onChange={(v) => setField("email", v)} placeholder="name@example.com" type="email" C={C} />
            </FormField>
            <FormField label={t.agentUsernameOptional} C={C}>
              <TextInput value={form.username} onChange={(v) => setField("username", v)} placeholder="username" C={C} />
            </FormField>
            <FormField label={t.agentUserPassword} required C={C}>
              <TextInput value={form.password} onChange={(v) => setField("password", v)} placeholder="••••••••" type="password" C={C} />
            </FormField>
          </FormRow>
        )}
      </FormSection>

      <FormSection title={t.agentProfileSection} description={t.agentProfileSectionSub} C={C}>
        <FormRow>
          <FormField label={t.agentFirstName} required C={C}>
            <TextInput value={form.first_name} onChange={(v) => setField("first_name", v)} C={C} />
          </FormField>
          <FormField label={t.agentFatherName} required C={C}>
            <TextInput value={form.father_name} onChange={(v) => setField("father_name", v)} C={C} />
          </FormField>
          <FormField label={t.agentLastName} required C={C}>
            <TextInput value={form.last_name} onChange={(v) => setField("last_name", v)} C={C} />
          </FormField>
          <FormField label={t.agentFourthName} required C={C}>
            <TextInput value={form.fourth_name} onChange={(v) => setField("fourth_name", v)} C={C} />
          </FormField>
          <FormField label={t.agentMotherName} required C={C}>
            <TextInput value={form.mother_name} onChange={(v) => setField("mother_name", v)} C={C} />
          </FormField>
          <FormField label={t.agentPhone} required C={C}>
            <TextInput value={form.phone} onChange={(v) => setField("phone", v)} C={C} />
          </FormField>
          <FormField label={t.agentDob} required C={C}>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setField("date_of_birth", e.target.value)}
              style={fieldStyle}
            />
          </FormField>
          <FormField label={t.agentCounty} C={C}>
            <select
              value={form.county}
              onChange={(e) => setField("county", e.target.value)}
              style={fieldStyle}
            >
              <option value="">{t.agentSelectCounty}</option>
              {counties.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t.userType} C={C}>
            <select
              value={form.user_type}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, user_type: v, department: isTaliyeQebeed(userTypes, v) ? f.department : "" }));
              }}
              style={fieldStyle}
            >
              <option value="">{t.userTypeNone}</option>
              {userTypes.map((ut) => <option key={ut.id} value={String(ut.id)}>{ut.name}</option>)}
            </select>
          </FormField>
          <FormField label={t.userQeyb} required={isTaliyeQebeed(userTypes, form.user_type)} C={C}>
            <select
              value={form.department}
              onChange={(e) => setField("department", e.target.value)}
              style={fieldStyle}
            >
              <option value="">{t.userQeybNone}</option>
              {qeybs.map((q) => <option key={q.id} value={String(q.id)}>{q.name}</option>)}
            </select>
          </FormField>
        </FormRow>
      </FormSection>
    </AccountModal>
  );

  if (!isCiidan && profileId) {
    return (
      <>
        {createModal}
        <AgentProfilePage
          agentId={profileId}
          onBack={() => setProfileId(null)}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      </>
    );
  }
  const actionLabels = { view: t.viewAction, edit: t.editAction, delete: t.deleteAction };

  const handleRowAction = (row: AgentSummary, action: "view" | "edit" | "delete") => {
    if (action === "view") openAgent(row.id);
    if (action === "edit") setEditId(String(row.id));
  };

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      {!isCiidan && createModal}
      {!isCiidan && (
      <EditAgentModal
        agentId={editId}
        onClose={() => setEditId(null)}
        C={C}
        accent={accent}
        isDark={isDark}
      />
      )}

      <div style={{
        marginBottom: "14px",
        display: "flex",
        gap: "10px",
        flexWrap: "nowrap",
        alignItems: "center",
        overflowX: "auto",
        paddingBottom: 2,
      }}>
        <div style={{ flex: "1 1 200px", minWidth: 180, display: "flex", alignItems: "center", gap: "9px", padding: "10px 14px", borderRadius: "10px", background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
          <Icon name="search" size={16} sw={1.8} />
          <input
            placeholder={isCiidan ? t.searchForces : t.searchAgents}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", color: C.txtPrimary, fontFamily: "var(--font-outfit)", flex: 1, minWidth: 0 }}
          />
        </div>
        <select
          value={countyFilter}
          onChange={(e) => setCountyFilter(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: `1px solid ${countyFilter ? hexA(accent, 0.4) : C.inputBdr}`,
            background: countyFilter ? hexA(accent, isDark ? 0.12 : 0.08) : C.inputBg,
            color: countyFilter ? accent : C.txtPrimary,
            fontFamily: "var(--font-outfit)",
            fontSize: "14px",
            minWidth: 140,
            flex: "0 0 auto",
          }}
        >
          <option value="">{t.filterDistrict}</option>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={presentFilter}
          onChange={(e) => setPresentFilter(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: `1px solid ${presentFilter ? hexA(accent, 0.4) : C.inputBdr}`,
            background: presentFilter ? hexA(accent, isDark ? 0.12 : 0.08) : C.inputBg,
            color: presentFilter ? accent : C.txtPrimary,
            fontFamily: "var(--font-outfit)",
            fontSize: "14px",
            minWidth: 130,
            flex: "0 0 auto",
          }}
        >
          <option value="">{t.filterAllPresent}</option>
          {PRESENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: `1px solid ${activeFilter ? hexA(accent, 0.4) : C.inputBdr}`,
            background: activeFilter ? hexA(accent, isDark ? 0.12 : 0.08) : C.inputBg,
            color: activeFilter ? accent : C.txtPrimary,
            fontFamily: "var(--font-outfit)",
            fontSize: "14px",
            minWidth: 120,
            flex: "0 0 auto",
          }}
        >
          <option value="">{t.filterAllActive}</option>
          <option value="true">{t.statusActive}</option>
          <option value="false">{t.statusInactive}</option>
        </select>
        {!registerAddAction && !isCiidan && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: "10px",
              border: "none",
              background: accent,
              color: "#1c1917",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-outfit)",
              fontSize: "14px",
              whiteSpace: "nowrap",
              flex: "0 0 auto",
            }}
          >
            <Icon name="plus" size={16} sw={2.2} />
            {titleAdd}
          </button>
        )}
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden", opacity: isPlaceholderData && isFetching ? 0.85 : 1, transition: "opacity .2s" }}>
        {showShimmer ? <ShimmerForcesTable /> : rows.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: C.txtMuted }}>
              <Icon name="search" size={28} sw={1.6} />
            </div>
            {emptyLabel}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", minWidth: 900 }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.colName, t.colPhone, t.colDistrict, t.colRole, t.colStatus, t.agentPresent, t.colAction].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: C.txtMuted,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const photo = resolveMediaUrl(row.profile_url);
                  const displayName =
                    [row.first_name, row.father_name, row.last_name]
                      .filter(Boolean)
                      .join(" ")
                      .trim()
                    || row.user_email
                    || row.user_username
                    || "—";
                  const initials = displayName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase() || "?";
                  return (
                    <tr
                      key={row.id}
                      onClick={() => openAgent(row.id)}
                      style={{ borderBottom: `1px solid ${C.tableSep}`, cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.tableHov ?? "transparent"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.5)})`,
                            color: "#1c1917", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-cinzel)",
                          }}>
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: C.txtPrimary, fontWeight: 600, fontSize: 14 }}>{displayName}</div>
                            <div style={{ color: C.txtMuted, fontSize: 12, marginTop: 2 }}>
                              {row.user_email || row.user_username || row.service_id || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary, whiteSpace: "nowrap" }}>{row.phone || "—"}</td>
                      <td style={{ padding: "14px 16px", color: C.txtSecondary }}>{row.county_name || "—"}</td>
                      <td style={{ padding: "14px 16px" }}><RoleBadge role={row.user_role || "agent"} /></td>
                      <td style={{ padding: "14px 16px" }}><ActiveBadge active={row.user_is_active !== false} present={row.present} /></td>
                      <td style={{ padding: "14px 16px" }}><PresentBadge present={row.present || row.status} /></td>
                      <td style={{ padding: "14px 16px" }}>
                        <RowActions
                          actions={isCiidan ? ["view"] : ["view", "edit"]}
                          onAction={(action) => handleRowAction(row, action)}
                          C={C}
                          accent={accent}
                          labels={actionLabels}
                        />
                      </td>
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
          isDark={isDark}
          isFetching={isFetching}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
          total={data?.count ?? 0}
          totalLabel={`${data?.count ?? 0} ${isCiidan ? t.forcesCountLabel : t.agentsCountLabel} · ${t.page} ${page} ${t.of} ${totalPages}`}
        />
      </div>
    </div>
  );
}
