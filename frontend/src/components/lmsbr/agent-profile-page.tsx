"use client";

import { memo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";
import {
  useAddAgentFile,
  useAddAgentRelative,
  useAgent,
  useAgentCapturedSuspects,
  useAgentFiles,
  useAgentRelatives,
  useUpdateAgent,
  useUpdateAgentRelative,
} from "@/hooks/use-agents";
import { statusLabel } from "@/lib/lmsbr/suspect-utils";
import { ShimmerSuspectProfile } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";

const EventLocationMap = dynamic(
  () => import("./event-location-map").then((m) => m.EventLocationMap),
  { ssr: false },
);
import {
  AccountModal,
  FormField,
  FormRow,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import type { AgentRelative, AgentUserLocation } from "@/types/agents";
import type { SuspectStatus } from "@/types/suspect";
import {
  AgentAttendanceTab,
  AgentRestrictionsTab,
  AgentStatusHistoryTab,
  AgentTransfersTab,
} from "./personnel/agent-profile-personnel-tabs";
import { TransferFormModal } from "./personnel/transfer-form-modal";
import { RestrictionFormModal } from "./personnel/restriction-form-modal";
import { useReleaseRestriction } from "@/hooks/use-personnel";
import { useQueryClient } from "@tanstack/react-query";
import { personnelKeys } from "@/lib/personnel-api";

type ThemeColors = AccountsThemeColors & {
  cardShadow?: string;
  panelShadow?: string;
  tableSep: string;
  tableHead?: string;
  tableHov?: string;
};

type TabId = "overview" | "attendance" | "transfers" | "restrictions" | "statushistory" | "location" | "suspects" | "relatives" | "files";

function TabBar({
  active,
  onChange,
  accent,
  C,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  accent: string;
  C: ThemeColors;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "overview", label: t.agentTabOverview, icon: "users" },
    { id: "attendance", label: lang === "so" ? "Imaanshaha" : "Attendance", icon: "check" },
    { id: "transfers", label: lang === "so" ? "Badalka" : "Transfers", icon: "send" },
    { id: "restrictions", label: lang === "so" ? "Xayiraad" : "Restrictions", icon: "alert" },
    { id: "statushistory", label: lang === "so" ? "Xaalad" : "Status", icon: "list" },
    { id: "location", label: t.agentTabLocation, icon: "map" },
    { id: "suspects", label: t.agentTabSuspects, icon: "badge" },
    { id: "relatives", label: t.agentTabRelatives, icon: "users" },
    { id: "files", label: t.agentTabFiles, icon: "file" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", borderBottom: `1px solid ${C.tableSep}`, marginBottom: "24px", overflowX: "auto" }}>
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "11px 16px",
              border: "none",
              cursor: "pointer",
              background: "transparent",
              fontFamily: "var(--font-outfit)",
              fontSize: "13.5px",
              fontWeight: on ? 600 : 400,
              color: on ? accent : C.txtMuted,
              borderBottom: on ? `2px solid ${accent}` : "2px solid transparent",
              marginBottom: "-1px",
              transition: "color .2s, border-color .2s",
              whiteSpace: "nowrap",
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
    <div style={{ padding: "22px 24px", borderRadius: "16px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow }}>
      {children}
    </div>
  );
}

function EmptyState({ message, C }: { message: string; C: ThemeColors }) {
  return (
    <p style={{ margin: 0, fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", textAlign: "center", padding: "24px 0" }}>
      {message}
    </p>
  );
}

function DetailCard({
  label,
  value,
  highlight,
  color,
  C,
  isDark,
}: {
  label: string;
  value: string;
  highlight?: string;
  color?: string;
  C: ThemeColors;
  isDark: boolean;
}) {
  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: "12px",
      background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead,
      border: `1px solid ${C.tableSep}`,
    }}>
      <div style={{ fontSize: "11px", letterSpacing: ".08em", textTransform: "uppercase", color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{
        fontSize: "15px",
        fontWeight: highlight || color ? 600 : 500,
        color: color ?? highlight ?? C.txtPrimary,
        fontFamily: "var(--font-outfit)",
        wordBreak: "break-word",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function LocationTab({
  location,
  C,
  accent,
}: {
  location: AgentUserLocation | null | undefined;
  C: ThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

  return (
    <Panel C={C}>
      {hasCoords ? (
        <EventLocationMap latitude={lat} longitude={lng} accent={accent} />
      ) : (
        <EmptyState message={t.agentNoLocation} C={C} />
      )}
    </Panel>
  );
}

const SuspectsTab = memo(function SuspectsTab({
  agentId,
  C,
  accent,
  onOpenSuspect,
}: {
  agentId: string;
  C: ThemeColors;
  accent: string;
  onOpenSuspect?: (id: number) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const { data, isLoading } = useAgentCapturedSuspects(agentId, page, true, pageSize);
  const rows = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;

  return (
    <Panel C={C}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary }}>
          {t.agentTabSuspects}
        </div>
        <div style={{ fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
          {data?.count ?? 0}
        </div>
      </div>
      {isLoading ? (
        <EmptyState message="…" C={C} />
      ) : rows.length === 0 ? (
        <EmptyState message={t.agentNoSuspects} C={C} />
      ) : (
        <>
          <TableRowsSelect
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            C={C}
            label={lang === "so" ? "Tiro" : "Rows"}
          />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
              <thead>
                <tr>
                  {[t.colName, t.colDistrict, t.colCase, t.colStatus, t.colLastSeen].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        color: C.txtMuted,
                        borderBottom: `1px solid ${C.tableSep}`,
                        fontFamily: "var(--font-outfit)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onOpenSuspect?.(row.id)}
                    style={{
                      cursor: onOpenSuspect ? "pointer" : "default",
                      borderTop: `1px solid ${C.tableSep}`,
                    }}
                    onMouseEnter={(e) => {
                      if (onOpenSuspect) e.currentTarget.style.background = C.tableHov ?? "transparent";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13.5px", color: C.txtPrimary, fontWeight: 500 }}>
                      {row.name}
                    </td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary }}>
                      {row.district || "—"}
                    </td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: accent, fontWeight: 600 }}>
                      {row.case_ref}
                    </td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary }}>
                      {statusLabel(row.status as SuspectStatus, t) || row.status}
                    </td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtMuted }}>
                      {row.last_seen || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            C={C}
            accent={accent}
            labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
            hideWhenSinglePage
          />
        </>
      )}
    </Panel>
  );
});

const EMPTY_RELATIVE = {
  full_name: "",
  relationship: "",
  district: "",
  phone: "",
  description: "",
};

const RelativesTab = memo(function RelativesTab({
  agentId,
  C,
  accent,
}: {
  agentId: string;
  C: ThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: relatives = [], isLoading } = useAgentRelatives(agentId);
  const addRelative = useAddAgentRelative(agentId);
  const updateRelative = useUpdateAgentRelative(agentId);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_RELATIVE);

  const canSubmit =
    !!form.full_name.trim()
    && !!form.relationship.trim()
    && !!form.district.trim()
    && !!form.phone.trim();

  const close = () => {
    setOpen(false);
    setEditId(null);
    setForm(EMPTY_RELATIVE);
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_RELATIVE);
    setOpen(true);
  };

  const openEdit = (row: AgentRelative) => {
    setEditId(String(row.id));
    setForm({
      full_name: row.full_name || "",
      relationship: row.relationship || "",
      district: row.district || "",
      phone: row.phone || "",
      description: row.description || "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      full_name: form.full_name.trim(),
      relationship: form.relationship.trim(),
      district: form.district.trim(),
      phone: form.phone.trim(),
      description: form.description.trim(),
    };
    if (editId) {
      updateRelative.mutate({ relativeId: editId, payload }, { onSuccess: close });
      return;
    }
    addRelative.mutate(payload, { onSuccess: close });
  };

  const pending = addRelative.isPending || updateRelative.isPending;

  return (
    <>
      <AccountModal
        open={open}
        onClose={close}
        title={editId ? t.agentEditRelative : t.agentAddRelative}
        C={C}
        accent={accent}
        size="md"
        zIndex={1300}
        footer={
          <>
            <SecondaryButton onClick={close} C={C}>{t.cancelAction}</SecondaryButton>
            <PrimaryButton onClick={submit} disabled={!canSubmit || pending} accent={accent}>
              {pending ? "…" : editId ? t.saveChanges : t.agentAddRelative}
            </PrimaryButton>
          </>
        }
      >
        <FormRow columns={1}>
          <FormField label={t.colName} required C={C}>
            <TextInput value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} C={C} />
          </FormField>
          <FormField label={t.agentRelationship} required C={C}>
            <TextInput value={form.relationship} onChange={(v) => setForm((f) => ({ ...f, relationship: v }))} C={C} />
          </FormField>
          <FormField label={t.agentCounty} required C={C}>
            <TextInput value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} C={C} />
          </FormField>
          <FormField label={t.colPhone} required C={C}>
            <TextInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} C={C} />
          </FormField>
          <FormField label={t.notes} C={C}>
            <TextInput value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} C={C} />
          </FormField>
        </FormRow>
      </AccountModal>

      <Panel C={C}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "16px", flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary }}>
            {t.agentTabRelatives}
          </div>
          <button
            type="button"
            onClick={openCreate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: `1px solid ${hexA(accent, 0.4)}`,
              background: hexA(accent, 0.1),
              color: accent,
              cursor: "pointer",
              fontFamily: "var(--font-outfit)",
              fontSize: "13.5px",
              fontWeight: 500,
            }}
          >
            + {t.agentAddRelative}
          </button>
        </div>
        {isLoading ? (
          <EmptyState message="…" C={C} />
        ) : relatives.length === 0 ? (
          <EmptyState message={t.agentNoRelatives} C={C} />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
              <thead>
                <tr>
                  {[t.colName, t.agentRelationship, t.agentCounty, t.colPhone, ""].map((h, i) => (
                    <th
                      key={h || `action-${i}`}
                      style={{
                        textAlign: i === 4 ? "right" : "left",
                        padding: "10px 12px",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        color: C.txtMuted,
                        borderBottom: `1px solid ${C.tableSep}`,
                        fontFamily: "var(--font-outfit)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relatives.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13.5px", color: C.txtPrimary, fontWeight: 500, borderTop: `1px solid ${C.tableSep}` }}>{r.full_name}</td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary, borderTop: `1px solid ${C.tableSep}` }}>{r.relationship}</td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary, borderTop: `1px solid ${C.tableSep}` }}>{r.district}</td>
                    <td style={{ padding: "12px", fontFamily: "var(--font-outfit)", fontSize: "13px", color: C.txtSecondary, borderTop: `1px solid ${C.tableSep}` }}>{r.phone}</td>
                    <td style={{ padding: "12px", borderTop: `1px solid ${C.tableSep}`, textAlign: "right" }}>
                      <button
                        type="button"
                        title={t.editAction}
                        onClick={() => openEdit(r)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          border: `1px solid ${hexA(accent, 0.35)}`,
                          background: hexA(accent, 0.1),
                          color: accent,
                          cursor: "pointer",
                        }}
                      >
                        <Icon name="edit" size={15} sw={1.9} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
});

const FilesTab = memo(function FilesTab({
  agentId,
  C,
  accent,
  isDark,
}: {
  agentId: string;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: files = [], isLoading } = useAgentFiles(agentId);
  const addFile = useAddAgentFile(agentId);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const close = () => {
    setOpen(false);
    setFileName("");
    setFile(null);
  };

  const submit = () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("file_name", fileName.trim() || file.name);
    addFile.mutate(fd, { onSuccess: close });
  };

  return (
    <>
      <AccountModal
        open={open}
        onClose={close}
        title={t.agentAddFile}
        C={C}
        accent={accent}
        size="md"
        zIndex={1300}
        footer={
          <>
            <SecondaryButton onClick={close} C={C}>{t.cancelAction}</SecondaryButton>
            <PrimaryButton onClick={submit} disabled={!file || addFile.isPending} accent={accent}>
              {addFile.isPending ? "…" : t.agentAddFile}
            </PrimaryButton>
          </>
        }
      >
        <FormRow columns={1}>
          <FormField label={t.agentFileName} C={C}>
            <TextInput
              value={fileName}
              onChange={setFileName}
              placeholder={file?.name || t.agentFileName}
              C={C}
            />
          </FormField>
          <FormField label={t.agentChooseFile} required C={C}>
            <input
              type="file"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                if (next && !fileName) setFileName(next.name);
              }}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "10px",
                border: `1px solid ${C.inputBdr}`,
                background: C.inputBg,
                color: C.txtPrimary,
                fontFamily: "var(--font-outfit)",
              }}
            />
          </FormField>
        </FormRow>
      </AccountModal>

      <Panel C={C}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "16px", flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "17px", color: C.txtPrimary }}>
            {t.agentTabFiles}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: `1px solid ${hexA(accent, 0.4)}`,
              background: hexA(accent, 0.1),
              color: accent,
              cursor: "pointer",
              fontFamily: "var(--font-outfit)",
              fontSize: "13.5px",
              fontWeight: 500,
            }}
          >
            + {t.agentAddFile}
          </button>
        </div>
        {isLoading ? (
          <EmptyState message="…" C={C} />
        ) : files.length === 0 ? (
          <EmptyState message={t.agentNoFiles} C={C} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {files.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead,
                  border: `1px solid ${C.tableSep}`,
                  fontFamily: "var(--font-outfit)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: C.txtPrimary }}>{f.file_name}</div>
                  {f.file_code && (
                    <div style={{ fontSize: "12px", color: C.txtMuted, marginTop: 2 }}>{f.file_code}</div>
                  )}
                </div>
                {f.file_url && (
                  <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color: accent, fontSize: "13px", fontWeight: 600 }}>
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
});

export function AgentProfilePage({
  agentId,
  onBack,
  onOpenSuspect,
  C,
  accent,
  isDark,
}: {
  agentId: string;
  onBack?: () => void;
  onOpenSuspect?: (id: number) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: agent, isLoading, isError } = useAgent(agentId);
  const updateAgent = useUpdateAgent(agentId);
  const profileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRestriction, setShowRestriction] = useState(false);
  const releaseRestriction = useReleaseRestriction();
  const qc = useQueryClient();

  const handleBack = onBack ?? (() => router.push("/dashboard/amniga"));

  const uploadProfile = (file: File) => {
    const fd = new FormData();
    fd.append("profile", file);
    setUploadingPhoto(true);
    updateAgent.mutate(fd, { onSettled: () => setUploadingPhoto(false) });
  };

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !agent) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
        <p style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{t.noResults}</p>
        <button
          type="button"
          onClick={handleBack}
          style={{
            marginTop: "16px",
            padding: "10px 18px",
            borderRadius: "10px",
            border: `1px solid ${hexA(accent, 0.35)}`,
            background: hexA(accent, 0.1),
            color: accent,
            cursor: "pointer",
            fontFamily: "var(--font-outfit)",
          }}
        >
          {t.backToList}
        </button>
      </div>
    );
  }

  const presentColor = agent.present === "Joogey" || agent.status === "Active"
    ? "#46c08a"
    : agent.present === "Maqan"
      ? "#e0655a"
      : accent;
  const profileImageUrl = resolveMediaUrl(agent.profile_url);
  const displayName = (
    agent.personal_number
    || [agent.first_name, agent.father_name, agent.last_name, agent.fourth_name].filter(Boolean).join(" ")
    || agent.user_email
    || agent.user_username
    || "—"
  ).trim();

  return (
    <div style={{ animation: "is-fadeUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "10px",
            border: `1px solid ${C.inputBdr}`,
            background: C.cardBg,
            color: C.txtSecondary,
            cursor: "pointer",
            fontFamily: "var(--font-outfit)",
            fontSize: "13.5px",
            transition: ".2s",
          }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}>
            <Icon name="arrow" size={15} sw={2} />
          </span>
          {t.backToList}
        </button>
      </div>

      <div className="lmsbr-split-aside" style={{ display: "grid", gridTemplateColumns: "minmax(240px,300px) 1fr", gap: "24px", alignItems: "start" }}>
        <div style={{ borderRadius: "18px", overflow: "hidden", background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow }}>
          <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden" }}>
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileImageUrl}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                background: `linear-gradient(160deg,${hexA(accent, 0.35)},${hexA(accent, 0.08)})`,
                padding: 20,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/emblem.png" alt="" style={{ width: 72, height: 72, opacity: 0.45, objectFit: "contain" }} />
                <button
                  type="button"
                  onClick={() => profileRef.current?.click()}
                  disabled={uploadingPhoto || updateAgent.isPending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${hexA(accent, 0.45)}`,
                    background: hexA(accent, isDark ? 0.18 : 0.14),
                    color: isDark ? accent : "#92400e",
                    cursor: uploadingPhoto ? "wait" : "pointer",
                    fontFamily: "var(--font-outfit)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Icon name="edit" size={14} sw={2} />
                  {uploadingPhoto ? "…" : t.uploadProfile}
                </button>
              </div>
            )}
            <div style={{ position: "absolute", inset: 0, background: profileImageUrl ? "linear-gradient(180deg,transparent 55%,rgba(0,0,0,0.85) 100%)" : "none", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "5px 11px",
                borderRadius: "20px",
                background: hexA(presentColor, 0.92),
                color: "#fff",
                fontFamily: "var(--font-outfit)",
                letterSpacing: ".05em",
              }}>
                {agent.present || agent.status}
              </span>
            </div>
            <input
              ref={profileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                uploadProfile(file);
                e.target.value = "";
              }}
            />
            {profileImageUrl && (
              <button
                type="button"
                title={t.uploadProfile}
                onClick={() => profileRef.current?.click()}
                disabled={uploadingPhoto || updateAgent.isPending}
                style={{
                  position: "absolute",
                  right: 14,
                  bottom: 14,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: `2px solid ${C.cardBdr}`,
                  background: C.panelBg,
                  color: C.txtSecondary,
                  cursor: uploadingPhoto ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                <Icon name="edit" size={15} sw={2} />
              </button>
            )}
          </div>
          <div style={{ padding: "20px 22px 24px" }}>
            <div style={{ marginBottom: "12px", textAlign: "center" }}>
              <span style={{
                display: "inline-block",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                padding: "6px 12px",
                borderRadius: "20px",
                fontFamily: "var(--font-outfit)",
                background: hexA(presentColor, 0.15),
                color: presentColor,
                border: `1px solid ${hexA(presentColor, 0.35)}`,
              }}>
                {agent.present || agent.status}
              </span>
            </div>
            <h2 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "16px", color: C.txtPrimary, margin: "0 0 4px", lineHeight: 1.3, textAlign: "center" }}>
              {displayName}
            </h2>
            <p style={{ margin: 0, fontSize: "12.5px", color: C.txtMuted, fontFamily: "var(--font-outfit)", textAlign: "center", wordBreak: "break-word" }}>
              {agent.user_email || agent.user_username || t.agentUserAccount}
            </p>
            <div style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: `1px solid ${C.tableSep}`,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13.5px",
              color: C.txtSecondary,
              fontFamily: "var(--font-outfit)",
            }}>
              <span style={{ display: "flex", color: accent }}><Icon name="map" size={16} sw={1.8} /></span>
              {agent.county_name || "—"}
            </div>
            <div style={{
              marginTop: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13.5px",
              color: C.txtSecondary,
              fontFamily: "var(--font-outfit)",
            }}>
              <span style={{ display: "flex", color: accent }}><Icon name="badge" size={16} sw={1.8} /></span>
              {agent.phone || "—"}
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <TabBar active={activeTab} onChange={setActiveTab} accent={accent} C={C} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SecondaryButton onClick={() => setShowTransfer(true)} C={C}>{lang === "so" ? "Badal Degmo" : "Transfer"}</SecondaryButton>
              <SecondaryButton onClick={() => setShowRestriction(true)} C={C}>{lang === "so" ? "Xayiraad" : "Restriction"}</SecondaryButton>
            </div>
          </div>

          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Panel C={C}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "18px", color: C.txtPrimary, marginBottom: "20px" }}>
                  {t.agentProfileSection}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "18px" }}>
                  <DetailCard label={t.agentUserAccount} value={agent.user_email || agent.user_username || "—"} highlight={accent} C={C} isDark={isDark} />
                  <DetailCard label={t.agentPhone} value={agent.phone} C={C} isDark={isDark} />
                  <DetailCard label={t.agentCounty} value={agent.county_name || "—"} C={C} isDark={isDark} />
                  <DetailCard label={t.userType} value={agent.user_type_name || "—"} C={C} isDark={isDark} />
                  <DetailCard label={t.userQeyb} value={agent.department_name || "—"} C={C} isDark={isDark} />
                  <DetailCard label={t.colStatus} value={agent.present || agent.status} color={presentColor} C={C} isDark={isDark} />
                  <DetailCard label={t.agentDob} value={agent.date_of_birth || "—"} C={C} isDark={isDark} />
                  <DetailCard label={t.agentMotherName} value={agent.mother_name || "—"} C={C} isDark={isDark} />
                  <DetailCard label="Service ID" value={agent.service_id || "—"} C={C} isDark={isDark} />
                  <DetailCard label="Directorate" value={agent.directorate_name || "—"} C={C} isDark={isDark} />
                </div>
                <div style={{ display: "flex", gap: "20px", marginTop: "20px", flexWrap: "wrap", fontSize: "12.5px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  <span>{t.registered}: {agent.created_at?.slice(0, 10)}</span>
                  <span>{t.updated}: {agent.updated_at?.slice(0, 10)}</span>
                </div>
              </Panel>
              {agent.biography && (
                <Panel C={C}>
                  <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: "18px", color: C.txtPrimary, marginBottom: "14px" }}>
                    {t.notes}
                  </div>
                  <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.7, color: C.txtSecondary, fontFamily: "var(--font-outfit)", whiteSpace: "pre-wrap" }}>
                    {agent.biography}
                  </p>
                </Panel>
              )}
            </div>
          )}

          {activeTab === "attendance" && <AgentAttendanceTab agentId={agentId} C={C} />}
          {activeTab === "transfers" && <AgentTransfersTab agentId={agentId} C={C} accent={accent} />}
          {activeTab === "restrictions" && (
            <AgentRestrictionsTab
              agentId={agentId}
              C={C}
              onRelease={async (id) => {
                await releaseRestriction.mutateAsync({ id });
                qc.invalidateQueries({ queryKey: personnelKeys.agentSummary(agentId) });
              }}
            />
          )}
          {activeTab === "statushistory" && <AgentStatusHistoryTab agentId={agentId} C={C} />}
          {activeTab === "location" && (
            <LocationTab location={agent.user_location} C={C} accent={accent} />
          )}
          {activeTab === "suspects" && (
            <SuspectsTab agentId={agentId} C={C} accent={accent} onOpenSuspect={onOpenSuspect} />
          )}
          {activeTab === "relatives" && <RelativesTab agentId={agentId} C={C} accent={accent} />}
          {activeTab === "files" && <FilesTab agentId={agentId} C={C} accent={accent} isDark={isDark} />}
        </div>
      </div>

      <TransferFormModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        agent={agent}
        C={C}
        accent={accent}
      />
      <RestrictionFormModal
        open={showRestriction}
        onClose={() => setShowRestriction(false)}
        agent={agent}
        C={C}
        accent={accent}
      />
    </div>
  );
}
