"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { fetchCounties, fetchStaffCheck, testMobileLogin, testMobileLogins } from "@/lib/accounts-api";
import { fetchAppUsersReport } from "@/lib/agents-api";
import { buildAppUsersQeybReportHtml, printHtmlDocument, type AppUsersPrintMode } from "@/lib/app-users-report";
import { STALE_LIST_MS } from "@/lib/query-config";
import { resolveMediaUrl } from "@/lib/media-url";
import {
  useAppUsers,
  useAgent,
  useAgentLoginActivity,
  useBulkResetAgentPasswords,
  useResetAgentPasswordToPhone,
} from "@/hooks/use-agents";
import {
  useAssignGroups,
  useAllGroups,
  useQeybs,
  useResetAppPinToDefault,
} from "@/hooks/use-accounts";
import { usePermissions } from "@/hooks/use-permissions";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { ShimmerForcesTable } from "./shimmer";
import { UserProfilePage } from "./user-profile-page";
import { AmnigaStaffSearchModal } from "./amniga-staff-search-modal";
import {
  AccountModal,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  type AccountsThemeColors,
} from "./accounts-shared";
import type { AgentAppUser } from "@/types/agents";
import type { BulkMobileLoginTestRow } from "@/types/accounts";
import { toast } from "@/components/ui/use-toast";

type ThemeColors = AccountsThemeColors & {
  cardBg?: string;
  cardShadow?: string;
};

const NOT_INSTALLED_REASONS = [
  ["did_not_attend", "Ma imaanin"],
  ["basic_phone", "Telefoon button/Nokia wata"],
  ["no_phone", "Mobile ma wato"],
  ["unsupported_phone", "Mobile-ku ma taageerayo"],
  ["no_internet", "Internet/xog ma leh"],
  ["login_issue", "Password/login cilad"],
  ["refused", "Wuu diiday"],
  ["other", "Sabab kale"],
] as const;

const MULTI_ID_PAGE_SIZE = 100;
const MULTI_ID_LIMIT = 80;

function parseAppUserSearchIds(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (/[,;\n\r|/]/.test(trimmed)) {
    const parts: string[] = [];
    for (const chunk of trimmed.split(/[,;\n\r|/]+/)) {
      for (const token of chunk.trim().split(/\s+/)) {
        const term = token.trim();
        if (term && !parts.includes(term)) parts.push(term);
      }
    }
    return parts.slice(0, MULTI_ID_LIMIT);
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && tokens.every((token) => /^\d+$/.test(token))) {
    return tokens.slice(0, MULTI_ID_LIMIT);
  }
  return [];
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-outfit)",
        background: hexA(color, 0.12),
        color,
        border: `1px solid ${hexA(color, 0.22)}`,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

function Avatar({ name, url, accent }: { name: string; url?: string | null; accent: string }) {
  const src = resolveMediaUrl(url);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          objectFit: "cover",
          border: `1px solid ${hexA(accent, 0.2)}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: `linear-gradient(145deg, ${hexA(accent, 0.85)}, ${accent})`,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: 14,
        fontFamily: "var(--font-outfit)",
        boxShadow: `0 2px 8px ${hexA(accent, 0.28)}`,
      }}
    >
      {initial}
    </div>
  );
}

function MoreActionsMenu({
  items,
  C,
  accent,
  isDark,
}: {
  items: { label: string; icon: string; onClick: () => void; danger?: boolean }[];
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 220;
      const left = Math.min(Math.max(8, r.right - menuW), window.innerWidth - menuW - 8);
      const estimatedH = items.length * 44 + 16;
      let top = r.bottom + 6;
      if (top + estimatedH > window.innerHeight - 8) {
        top = Math.max(8, r.top - estimatedH - 6);
      }
      setPos({ top, left });
    };
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, items.length]);

  if (!items.length) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: `1px solid ${open ? hexA(accent, 0.45) : C.inputBdr}`,
          background: open ? hexA(accent, 0.1) : C.inputBg,
          color: open ? accent : C.txtMuted,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Icon name="more" size={16} sw={2} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 1400,
              minWidth: 220,
              padding: 6,
              borderRadius: 12,
              background: C.panelBg,
              border: `1px solid ${C.cardBdr}`,
              boxShadow: isDark
                ? "0 12px 32px rgba(0,0,0,0.45)"
                : "0 12px 28px rgba(15,23,42,0.14)",
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: item.danger ? "#e0655a" : C.txtPrimary,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = item.danger
                    ? hexA("#e0655a", 0.1)
                    : hexA(accent, 0.1);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: item.danger ? hexA("#e0655a", 0.12) : hexA(accent, 0.12),
                    color: item.danger ? "#e0655a" : accent,
                    flexShrink: 0,
                  }}
                >
                  <Icon name={item.icon} size={13} sw={2} />
                </span>
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function ToolBtn({
  label,
  color,
  icon,
  onClick,
  outline,
  disabled,
  title,
}: {
  label: string;
  color: string;
  icon: string;
  onClick: () => void;
  outline?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        borderRadius: 9,
        border: outline ? `1px solid ${hexA(color, 0.45)}` : "none",
        background: outline ? hexA(color, 0.08) : color,
        color: outline ? color : "#fff",
        fontFamily: "var(--font-outfit)",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        boxShadow: outline ? "none" : `0 1px 3px ${hexA(color, 0.28)}`,
        transition: "background .15s, border-color .15s, opacity .15s",
      }}
    >
      <Icon name={icon} size={14} sw={2} />
      {label}
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  C,
  accent,
  isDark,
  minWidth = 150,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  minWidth?: number;
  children: ReactNode;
}) {
  const active = !!value;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "9px 12px",
        borderRadius: 9,
        border: `1px solid ${active ? hexA(accent, 0.45) : C.inputBdr}`,
        background: active ? hexA(accent, isDark ? 0.14 : 0.07) : C.inputBg,
        color: active ? accent : C.txtPrimary,
        fontFamily: "var(--font-outfit)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        minWidth,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function GroupsModal({
  open,
  onClose,
  userId,
  C,
  accent,
  initialIds,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  C: ThemeColors;
  accent: string;
  initialIds: number[];
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const qc = useQueryClient();
  const { data: groups = [] } = useAllGroups();
  const assign = useAssignGroups(userId);
  const [ids, setIds] = useState<number[]>(initialIds);

  useEffect(() => {
    if (open) setIds(initialIds);
  }, [open, initialIds]);

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={t.appUsersAssignGroups}
      C={C}
      accent={accent}
      size="md"
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton
            onClick={() => assign.mutate(ids, {
              onSuccess: () => {
                onClose();
                void qc.invalidateQueries({ queryKey: ["agents", "app-users"] });
              },
            })}
            disabled={assign.isPending}
            accent={accent}
          >
            {assign.isPending ? t.permSaving : t.saveChanges}
          </PrimaryButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
        {groups.map((g) => {
          const on = ids.includes(g.id);
          return (
            <label
              key={g.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${on ? hexA(accent, 0.4) : C.inputBdr}`,
                background: on ? hexA(accent, 0.08) : C.inputBg,
                cursor: "pointer",
                fontFamily: "var(--font-outfit)",
                fontSize: 14,
                color: C.txtPrimary,
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => setIds((prev) => (on ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
              />
              {g.name}
            </label>
          );
        })}
      </div>
    </AccountModal>
  );
}

function th(C: ThemeColors): CSSProperties {
  return {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".05em",
    textTransform: "uppercase",
    color: C.txtMuted,
    fontFamily: "var(--font-outfit)",
    whiteSpace: "nowrap",
  };
}

function td(C: ThemeColors, extra?: CSSProperties): CSSProperties {
  return {
    padding: "12px 14px",
    fontSize: 13,
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    verticalAlign: "middle",
    ...extra,
  };
}

function relativeTime(value: string | null, lang: "so" | "en") {
  if (!value) return lang === "so" ? "Weligii ma soo galin" : "Never logged in";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return lang === "so" ? "Hadda" : "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === "so" ? `${minutes} daqiiqo ka hor` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "so" ? `${hours} saac ka hor` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return lang === "so" ? `${days} maalmood ka hor` : `${days} days ago`;
}

function exactTime(value: string | null, lang: "so" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "so" ? "so-SO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Mogadishu",
  }).format(new Date(value));
}

function activityMeta(status: AgentAppUser["activity_status"], lang: "so" | "en") {
  if (status === "active") return { label: lang === "so" ? "Firfircoon" : "Active", color: "#46c08a" };
  if (status === "warning") return { label: lang === "so" ? "Digniin" : "Warning", color: "#e6b25c" };
  if (status === "inactive") return { label: lang === "so" ? "Firfircooni la’aan" : "Inactive", color: "#e0655a" };
  return { label: lang === "so" ? "Weligii ma gelin" : "Never logged in", color: "#9a8a6f" };
}

function InfoTile({
  label,
  value,
  C,
}: {
  label: string;
  value: ReactNode;
  C: ThemeColors;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${C.cardBdr}`,
        background: C.inputBg,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: C.txtMuted,
          fontFamily: "var(--font-outfit)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: C.txtPrimary,
          fontFamily: "var(--font-outfit)",
          lineHeight: 1.35,
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function AgentDetailModal({
  row,
  onClose,
  C,
  accent,
  isDark,
  isSuper,
  onOpenProfile,
  onLogins,
  onStaffCheck,
  onMobileTest,
  onGroups,
  onResetPhone,
  onResetPin,
}: {
  row: AgentAppUser | null;
  onClose: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  isSuper: boolean;
  onOpenProfile: () => void;
  onLogins: () => void;
  onStaffCheck: () => void;
  onMobileTest: () => void;
  onGroups: () => void;
  onResetPhone: () => void;
  onResetPin: () => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: detail, isLoading } = useAgent(row?.id ?? null);
  const act = row ? activityMeta(row.activity_status, lang) : null;
  const displayName =
    detail
      ? [detail.first_name, detail.father_name, detail.last_name, detail.fourth_name].filter(Boolean).join(" ").trim()
        || row?.full_name
      : row?.full_name;
  const photo = detail?.profile_url || row?.profile_url;
  const installColor =
    row?.installation_status === "completed"
      ? "#28966f"
      : row?.installation_status === "iphone"
        ? "#e6b25c"
        : "#e0655a";

  return (
    <AccountModal
      open={!!row}
      onClose={onClose}
      title={lang === "so" ? "Faahfaahinta agent-ka" : "Agent details"}
      subtitle={row ? `${row.county_name || "—"} · ${row.nickname || row.service_id || row.id}` : ""}
      C={C}
      accent={accent}
      size="xl"
      footer={
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%", justifyContent: "flex-end" }}>
          <SecondaryButton onClick={onClose} C={C}>{lang === "so" ? "Xir" : "Close"}</SecondaryButton>
          {row?.user_id != null && (
            <PrimaryButton
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              accent={accent}
            >
              {lang === "so" ? "Fur profile buuxa" : "Open full profile"}
            </PrimaryButton>
          )}
        </div>
      }
    >
      {!row ? null : isLoading && !detail ? (
        <ShimmerForcesTable rows={5} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: "var(--font-outfit)" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              padding: 16,
              borderRadius: 16,
              border: `1px solid ${hexA(accent, 0.22)}`,
              background: `linear-gradient(135deg, ${hexA(accent, isDark ? 0.16 : 0.1)} 0%, ${C.panelBg} 62%)`,
            }}
          >
            <div style={{ transform: "scale(1.35)", transformOrigin: "left center" }}>
              <Avatar name={displayName || "?"} url={photo} accent={accent} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.txtPrimary, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                {displayName || "—"}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: C.txtMuted }}>
                {[row.nickname || row.service_id, row.phone].filter(Boolean).join(" · ") || "—"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <Badge
                  label={row.user_suspend ? "Suspended" : row.user_is_active ? t.statusActive : t.statusInactive}
                  color={row.user_suspend ? "#e0655a" : row.user_is_active ? "#46c08a" : "#9a8a6f"}
                />
                <Badge
                  label={row.installation_label || (row.app_installed ? "Loogu shubay" : "Looguma shubin")}
                  color={installColor}
                />
                {act && <Badge label={act.label} color={act.color} />}
                {row.department_name && <Badge label={row.department_name} color={accent} />}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <InfoTile label={t.colDistrict} value={detail?.county_name || row.county_name} C={C} />
            <InfoTile label={lang === "so" ? "Qeebta" : "Qeebta"} value={detail?.department_name || row.department_name} C={C} />
            <InfoTile label={t.colPhone} value={detail?.phone || row.phone} C={C} />
            <InfoTile
              label={t.cishLastLogin}
              value={
                <button
                  type="button"
                  onClick={onLogins}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    color: accent,
                    fontWeight: 600,
                    fontFamily: "var(--font-outfit)",
                    fontSize: 14,
                    textAlign: "left",
                  }}
                >
                  {relativeTime(row.last_login, lang)}
                  <div style={{ color: C.txtMuted, fontSize: 11.5, fontWeight: 500, marginTop: 2 }}>
                    {exactTime(row.last_login, lang)}
                  </div>
                </button>
              }
              C={C}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txtMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {lang === "so" ? "Xogta aqoonsiga" : "Identity"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <InfoTile label={lang === "so" ? "Lambarka shaqsiga" : "Service ID"} value={detail?.service_id || row.service_id} C={C} />
              <InfoTile label={t.appUsersNickname} value={detail?.nickname || row.nickname} C={C} />
              <InfoTile label={lang === "so" ? "Jinsi" : "Gender"} value={detail?.gender} C={C} />
              <InfoTile label={lang === "so" ? "Taariikhda dhalashada" : "Date of birth"} value={detail?.date_of_birth} C={C} />
              <InfoTile label={lang === "so" ? "Hooyo" : "Mother"} value={detail?.mother_name} C={C} />
              <InfoTile label={lang === "so" ? "Qabiil" : "Tribe"} value={detail?.tribe_name} C={C} />
              <InfoTile label={lang === "so" ? "Gobol" : "Region"} value={detail?.region_name} C={C} />
              <InfoTile label={lang === "so" ? "Waax" : "Sub-county"} value={detail?.sub_county_name} C={C} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txtMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
              {lang === "so" ? "Akoonka app-ka" : "App account"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <InfoTile label={t.colEmail} value={detail?.email || row.email || row.user_email} C={C} />
              <InfoTile label={lang === "so" ? "Username" : "Username"} value={row.user_username} C={C} />
              <InfoTile label={lang === "so" ? "Nooca isticmaalaha" : "User type"} value={detail?.user_type_name || row.user_type_name} C={C} />
              <InfoTile label={t.appUsersPassPin} value={`${row.password_changed ? "Password Yes" : "Password No"} · ${row.has_app_pin ? "PIN Set" : "No PIN"}`} C={C} />
              <InfoTile
                label="App-ka"
                value={row.installation_label || (row.app_installed ? "Loogu shubay" : "Looguma shubin")}
                C={C}
              />
              <InfoTile
                label={lang === "so" ? "Sababta loogu shubin" : "Install reason"}
                value={
                  row.installation_status === "not_installed"
                    ? row.not_installed_reason_detail || row.not_installed_reason_label || "Sabab lama sheegin"
                    : "—"
                }
                C={C}
              />
              <InfoTile
                label={t.appUsersGroups}
                value={
                  row.groups.length
                    ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {row.groups.map((g) => <Badge key={g.id} label={g.name} color={accent} />)}
                      </div>
                    )
                    : "—"
                }
                C={C}
              />
              <InfoTile
                label={lang === "so" ? "Tirakoobka" : "Related counts"}
                value={
                  detail
                    ? `${detail.access_count} access · ${detail.relatives_count} relatives · ${detail.files_count} files · ${detail.captured_suspects_count} suspects`
                    : "…"
                }
                C={C}
              />
            </div>
          </div>

          {detail?.biography ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${C.cardBdr}`,
                background: C.inputBg,
                fontSize: 13.5,
                color: C.txtSecondary,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.txtMuted, marginBottom: 6 }}>
                {lang === "so" ? "Taariikh / Biography" : "Biography"}
              </div>
              {detail.biography}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              paddingTop: 4,
              borderTop: `1px solid ${C.tableSep}`,
            }}
          >
            <ToolBtn label={lang === "so" ? "Gelitaanno" : "Logins"} color={accent} icon="clock" onClick={onLogins} outline />
            {row.user_id != null && (
              <ToolBtn label={t.appUsersStaffCheck} color={accent} icon="search" onClick={onStaffCheck} outline />
            )}
            {row.user_id != null && (
              <ToolBtn label={t.userTestMobile} color={accent} icon="mail" onClick={onMobileTest} outline />
            )}
            {row.user_id != null && (
              <ToolBtn label={t.appUsersAssignGroups} color={accent} icon="users" onClick={onGroups} outline />
            )}
            {row.user_id != null && (
              <ToolBtn label={t.appUsersResetToPhone} color="#e0655a" icon="lock" onClick={onResetPhone} />
            )}
            {row.user_id != null && isSuper && row.has_app_pin && (
              <ToolBtn label={t.appUsersResetPin} color="#e0655a" icon="lock" onClick={onResetPin} outline />
            )}
          </div>
        </div>
      )}
    </AccountModal>
  );
}

function LoginActivityModal({
  row,
  onClose,
  C,
  accent,
}: {
  row: AgentAppUser | null;
  onClose: () => void;
  C: ThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const { data, isLoading } = useAgentLoginActivity(row?.id ?? null);
  return (
    <AccountModal
      open={!!row}
      onClose={onClose}
      title={lang === "so" ? "Faahfaahinta gelitaanka app-ka" : "App login details"}
      subtitle={row ? `${row.full_name} · ${row.county_name || "—"}` : ""}
      C={C}
      accent={accent}
      size="lg"
      zIndex={1350}
      footer={<SecondaryButton onClick={onClose} C={C}>{lang === "so" ? "Xir" : "Close"}</SecondaryButton>}
    >
      {isLoading ? (
        <ShimmerForcesTable rows={4} />
      ) : !data?.results.length ? (
        <div style={{ padding: 28, textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
          {lang === "so" ? "Wax gelitaan app ah lama helin." : "No app login activity found."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.cardBdr}`, borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ background: C.tableHead }}>
                <th style={th(C)}>{lang === "so" ? "Waqtiga" : "Time"}</th>
                <th style={th(C)}>{lang === "so" ? "Qalabka" : "Device"}</th>
                <th style={th(C)}>OS</th>
                <th style={th(C)}>IP</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((entry) => (
                <tr key={entry.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                  <td style={td(C)}>
                    <div style={{ fontWeight: 600 }}>{relativeTime(entry.created_at, lang)}</div>
                    <div style={{ color: C.txtMuted, fontSize: 11.5, marginTop: 2 }}>{exactTime(entry.created_at, lang)}</div>
                  </td>
                  <td style={td(C)}>{entry.device || "—"}</td>
                  <td style={td(C)}>{entry.operating_system || "—"}</td>
                  <td style={td(C)}>{entry.ip_address || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountModal>
  );
}

export function AmnigaAppUsersPage({
  C,
  accent,
  isDark,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { user: me } = usePermissions();
  const qc = useQueryClient();
  const isSuper = !!me?.is_superuser;

  const invalidateAppUsers = () => {
    void qc.invalidateQueries({ queryKey: ["agents", "app-users"] });
  };

  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("");
  const [department, setDepartment] = useState("");
  const [activityStatus, setActivityStatus] = useState("");
  const [installationStatus, setInstallationStatus] = useState("");
  const [notInstalledReason, setNotInstalledReason] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [loginDetailsFor, setLoginDetailsFor] = useState<AgentAppUser | null>(null);
  const [detailFor, setDetailFor] = useState<AgentAppUser | null>(null);
  const [printing, setPrinting] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [hrmOpen, setHrmOpen] = useState(false);
  const [groupsFor, setGroupsFor] = useState<AgentAppUser | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmResetPhone, setConfirmResetPhone] = useState<AgentAppUser | null>(null);
  const [confirmResetPin, setConfirmResetPin] = useState<AgentAppUser | null>(null);
  const [staffCheckMsg, setStaffCheckMsg] = useState<string | null>(null);
  const [loginCreds, setLoginCreds] = useState<{
    name: string;
    email: string;
    password: string;
    ok: boolean;
    message?: string;
  } | null>(null);
  const [bulkLoginRows, setBulkLoginRows] = useState<BulkMobileLoginTestRow[] | null>(null);
  const [bulkLoginBusy, setBulkLoginBusy] = useState(false);

  const deferred = useDeferredValue(search);
  const { data: counties = [] } = useQuery({
    queryKey: ["counties"],
    queryFn: fetchCounties,
    staleTime: STALE_LIST_MS,
  });
  const { data: qeybs = [] } = useQeybs();

  const multiIds = useMemo(() => parseAppUserSearchIds(deferred), [deferred]);
  const isMultiIdSearch = multiIds.length >= 2;
  const listPageSize = isMultiIdSearch ? Math.max(pageSize, MULTI_ID_PAGE_SIZE) : pageSize;

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [deferred, county, department, activityStatus, installationStatus, notInstalledReason, pageSize]);

  const filteredCounties = useMemo(() => {
    if (!department) return counties;
    const selectedQeyb = qeybs.find((q) => String(q.id) === department);
    return selectedQeyb?.counties ?? [];
  }, [counties, department, qeybs]);

  useEffect(() => {
    if (county && !filteredCounties.some((item) => String(item.id) === county)) {
      setCounty("");
    }
  }, [county, filteredCounties]);

  const { data, isLoading, isFetching } = useAppUsers({
    page,
    pageSize: listPageSize,
    search: deferred,
    county,
    department,
    activityStatus,
    installationStatus,
    notInstalledReason,
  });

  const bulkReset = useBulkResetAgentPasswords();
  const resetToPhone = useResetAgentPasswordToPhone();
  const resetAppPin = useResetAppPinToDefault();

  const rows = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.count / listPageSize)) : 1;
  const hasActiveFilters = !!(
    deferred || county || department || activityStatus || installationStatus || notInstalledReason
  );
  const selectedQeybName = qeybs.find((q) => String(q.id) === department)?.name;
  const selectedCountyName = counties.find((c) => String(c.id) === county)?.name;

  const clearFilters = () => {
    setSearch("");
    setCounty("");
    setDepartment("");
    setActivityStatus("");
    setInstallationStatus("");
    setNotInstalledReason("");
    setPage(1);
  };
  const pageUserIds = useMemo(
    () => rows.map((r) => r.user_id).filter((id): id is number => id != null),
    [rows],
  );
  const allPageSelected = pageUserIds.length > 0 && pageUserIds.every((id) => selected.has(id));
  const hasSelection = selected.size > 0;
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageUserIds.forEach((id) => next.delete(id));
      else pageUserIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  useEffect(() => {
    if (!isMultiIdSearch || isFetching || !pageUserIds.length) return;
    setSelected(new Set(pageUserIds));
  }, [isMultiIdSearch, isFetching, pageUserIds]);

  const onPrint = async (mode: AppUsersPrintMode = "full") => {
    if (!department) {
      toast({
        title: lang === "so" ? "Dooro Qeebta marka hore" : "Select a Qeebta first",
        variant: "destructive",
      });
      return;
    }

    setPrinting(true);
    let printRows: AgentAppUser[] = [];
    try {
      printRows = await fetchAppUsersReport({
        search: deferred,
        county,
        department,
        activityStatus,
        installationStatus: mode === "not_installed" ? "not_installed" : "",
        notInstalledReason: mode === "not_installed" ? notInstalledReason : "",
      });
    } catch {
      toast({ title: lang === "so" ? "Report-ka lama soo saari karin" : "Could not load report", variant: "destructive" });
      setPrinting(false);
      return;
    }

    if (mode === "not_installed") {
      printRows = printRows.filter((r) => r.installation_status === "not_installed");
    }

    if (!printRows.length) {
      setPrinting(false);
      toast({ title: lang === "so" ? "Xog la daabaco lama helin" : "No data to print" });
      return;
    }

    const selectedQeyb = qeybs.find((q) => String(q.id) === department);
    const countyLabel =
      counties.find((c) => String(c.id) === county)?.name
      || (lang === "so" ? "Dhammaan degmooyinka" : "All districts");

    try {
      const html = buildAppUsersQeybReportHtml({
        mode,
        rows: printRows,
        lang,
        qeyb: selectedQeyb,
        countyLabel,
        countyFilterActive: !!county,
        emblemSrc: `${window.location.origin}/emblem.png`,
        relativeTime,
        exactTime,
      });
      await printHtmlDocument(html);
    } catch {
      toast({ title: lang === "so" ? "Print waa fashilmay" : "Print failed", variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  const runStaffCheck = async (row: AgentAppUser) => {
    if (!row.user_id) return;
    try {
      const res = await fetchStaffCheck(String(row.user_id));
      setStaffCheckMsg(
        `${row.full_name}: ${res.role} · ${res.is_active ? "Active" : "Inactive"} · staff=${res.is_staff ? "yes" : "no"} · admin=${res.can_access_admin ? "yes" : "no"}`,
      );
    } catch {
      toast({ title: "Staff check failed", variant: "destructive" });
    }
  };

  const runMobileTest = async (row: AgentAppUser) => {
    if (!row.user_id) return;
    try {
      const phonePass = (row.phone || "").replace(/ /g, "");
      const res = await testMobileLogin(String(row.user_id), phonePass || undefined);
      const email = res.tested_with?.email || row.email || row.user_email || "";
      const password = res.tested_with?.password || phonePass;
      setLoginCreds({
        name: row.full_name,
        email,
        password,
        ok: !!res.can_login,
        message: res.detail || (res.can_login ? t.userMobileOk : t.userMobileFail),
      });
    } catch {
      toast({ title: t.userMobileFail, variant: "destructive" });
    }
  };

  const runBulkMobileTest = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkLoginBusy(true);
    try {
      const res = await testMobileLogins(ids);
      setBulkLoginRows(res.results);
    } catch {
      toast({ title: t.userMobileFail, variant: "destructive" });
    } finally {
      setBulkLoginBusy(false);
    }
  };

  if (profileUserId) {
    return (
      <UserProfilePage
        userId={profileUserId}
        onBack={() => setProfileUserId(null)}
        C={C}
        accent={accent}
        isDark={isDark}
      />
    );
  }

  return (
    <div style={{ marginTop: 4, animation: "is-fadeUp .35s ease both" }} className="amniga-app-users-print">
      {staffCheckMsg && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: hexA(accent, 0.1),
            border: `1px solid ${hexA(accent, 0.25)}`,
            color: C.txtPrimary,
            fontSize: 13,
            fontFamily: "var(--font-outfit)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{staffCheckMsg}</span>
          <button type="button" onClick={() => setStaffCheckMsg(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.txtMuted }}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <div
        className="no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          padding: "14px 16px",
          borderRadius: 14,
          background: `linear-gradient(135deg, ${hexA(accent, isDark ? 0.14 : 0.08)} 0%, ${C.panelBg} 55%)`,
          border: `1px solid ${hexA(accent, 0.18)}`,
          boxShadow: C.panelShadow,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtMuted, marginBottom: 4 }}>
            {lang === "so" ? "Natiijooyinka hadda" : "Current results"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-outfit)", fontSize: 26, fontWeight: 700, color: C.txtPrimary, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {isLoading && !data ? "…" : totalCount.toLocaleString()}
            </span>
            <span style={{ fontFamily: "var(--font-outfit)", fontSize: 13.5, color: C.txtMuted }}>
              {lang === "so" ? "agent" : "agents"}
              {selectedQeybName ? ` · ${selectedQeybName}` : ""}
              {selectedCountyName ? ` · ${selectedCountyName}` : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {installationStatus === "completed" && <Badge label="Loogu shubay" color="#28966f" />}
          {installationStatus === "iphone" && <Badge label="iPhone" color="#e6b25c" />}
          {installationStatus === "not_installed" && <Badge label="Looguma shubin" color="#e0655a" />}
          {activityStatus && (
            <Badge
              label={
                activityStatus === "active" ? (lang === "so" ? "Firfircoon" : "Active")
                  : activityStatus === "warning" ? (lang === "so" ? "Digniin" : "Warning")
                    : activityStatus === "inactive" ? (lang === "so" ? "Firfircooni la’aan" : "Inactive")
                      : (lang === "so" ? "Weligii ma gelin" : "Never")
              }
              color={
                activityStatus === "active" ? "#46c08a"
                  : activityStatus === "warning" ? "#e6b25c"
                    : activityStatus === "inactive" ? "#e0655a"
                      : "#9a8a6f"
              }
            />
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                border: `1px solid ${C.inputBdr}`,
                background: C.inputBg,
                color: C.txtMuted,
                borderRadius: 8,
                padding: "6px 10px",
                fontFamily: "var(--font-outfit)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {lang === "so" ? "Nadiifi filters" : "Clear filters"}
            </button>
          )}
        </div>
      </div>

      <div
        className="no-print"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: 14,
          padding: 14,
          borderRadius: 14,
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <FilterSelect value={department} onChange={setDepartment} C={C} accent={accent} isDark={isDark} minWidth={170}>
            <option value="">{lang === "so" ? "Dhammaan qeebta" : "All qeebta"}</option>
            {qeybs.map((q) => (
              <option key={q.id} value={String(q.id)}>{q.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={county} onChange={setCounty} C={C} accent={accent} isDark={isDark} minWidth={160}>
            <option value="">{t.filterDistrict}</option>
            {filteredCounties.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            value={installationStatus}
            onChange={(v) => {
              setInstallationStatus(v);
              if (v !== "not_installed") setNotInstalledReason("");
            }}
            C={C}
            accent={accent}
            isDark={isDark}
            minWidth={160}
          >
            <option value="">Dhammaan rakibidda</option>
            <option value="completed">Loogu shubay</option>
            <option value="iphone">iPhone</option>
            <option value="not_installed">Looguma shubin</option>
          </FilterSelect>

          {installationStatus === "not_installed" && (
            <FilterSelect value={notInstalledReason} onChange={setNotInstalledReason} C={C} accent={accent} isDark={isDark} minWidth={190}>
              <option value="">Dhammaan sababaha</option>
              {NOT_INSTALLED_REASONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </FilterSelect>
          )}

          <FilterSelect value={activityStatus} onChange={setActivityStatus} C={C} accent={accent} isDark={isDark} minWidth={170}>
            <option value="">{lang === "so" ? "Dhammaan firfircoonida" : "All activity"}</option>
            <option value="active">{lang === "so" ? "Firfircoon (24 saac)" : "Active (24 hours)"}</option>
            <option value="warning">{lang === "so" ? "Digniin (1–3 maalmood)" : "Warning (1–3 days)"}</option>
            <option value="inactive">{lang === "so" ? "Firfircooni la’aan (3+)" : "Inactive (3+ days)"}</option>
            <option value="never">{lang === "so" ? "Weligii ma gelin" : "Never logged in"}</option>
          </FilterSelect>

          <div style={{ flex: 1, minWidth: 240, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: 12,
                  color: C.txtMuted,
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <Icon name="search" size={14} sw={2} />
              </span>
              <textarea
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchAgentsIds}
                rows={isMultiIdSearch || search.includes("\n") ? 3 : 1}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: 9,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  color: C.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13.5,
                  outline: "none",
                  boxSizing: "border-box",
                  resize: "vertical",
                  minHeight: 38,
                  maxHeight: 120,
                  lineHeight: 1.35,
                }}
              />
              {isMultiIdSearch && (
                <div style={{ marginTop: 4, fontSize: 11.5, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  {lang === "so"
                    ? `${multiIds.length} ID — calaamadee kadib Tijaabi mobile`
                    : `${multiIds.length} IDs — select them, then test mobile`}
                </div>
              )}
            </div>
            <TableRowsSelect
              pageSize={pageSize}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              C={C}
              label={lang === "so" ? "Tiro" : "Rows"}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            borderTop: `1px solid ${hexA(C.tableSep || C.cardBdr, 0.9)}`,
            paddingTop: 10,
          }}
        >
          <ToolBtn label={t.appUsersSearchStaff} color={accent} icon="search" onClick={() => setStaffOpen(true)} />
          <ToolBtn label={t.appUsersHrmSearch} color={accent} icon="badge" onClick={() => setHrmOpen(true)} outline />
          <ToolBtn
            label={
              printing
                ? (lang === "so" ? "Soo saaraya…" : "Preparing…")
                : (lang === "so" ? "PDF — Warbixin buuxda" : "PDF — Full report")
            }
            color={accent}
            icon="file"
            onClick={() => void onPrint("full")}
            disabled={printing || !department}
            title={!department ? (lang === "so" ? "Dooro Qeebta marka hore" : "Select a Qeebta first") : undefined}
          />
          <ToolBtn
            label={
              printing
                ? (lang === "so" ? "Soo saaraya…" : "Preparing…")
                : (lang === "so" ? "PDF — Looguma shubin" : "PDF — Not installed")
            }
            color={accent}
            icon="file"
            onClick={() => void onPrint("not_installed")}
            disabled={printing || !department}
            outline
            title={!department ? (lang === "so" ? "Dooro Qeebta marka hore" : "Select a Qeebta first") : undefined}
          />
          {hasSelection && (
            <ToolBtn
              label={
                bulkLoginBusy
                  ? (lang === "so" ? "Tijaabinaya…" : "Testing…")
                  : `${t.userTestMobileBulk} (${selected.size})`
              }
              color={accent}
              icon="mail"
              onClick={() => void runBulkMobileTest()}
              disabled={bulkLoginBusy || selected.size > 80}
              title={selected.size > 80 ? (lang === "so" ? "Ugu badnaan 80" : "Max 80") : undefined}
            />
          )}
          {isSuper && hasSelection && (
            <ToolBtn
              label={`${t.appUsersResetPass} (${selected.size})`}
              color="#e0655a"
              icon="lock"
              onClick={() => setConfirmBulk(true)}
              disabled={!county}
              title={!county ? (lang === "so" ? "Dooro degmo marka hore" : "Select a district first") : undefined}
            />
          )}
        </div>
      </div>

      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          background: C.panelBg,
          border: `1px solid ${C.cardBdr}`,
          boxShadow: C.panelShadow,
          opacity: isFetching && !isLoading ? 0.88 : 1,
          transition: "opacity .15s",
        }}
      >
        {isLoading && !data ? (
          <ShimmerForcesTable rows={8} />
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: "56px 28px",
              textAlign: "center",
              fontFamily: "var(--font-outfit)",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                margin: "0 auto 14px",
                display: "grid",
                placeItems: "center",
                background: hexA(accent, 0.12),
                color: accent,
              }}
            >
              <Icon name="users" size={22} sw={2} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.txtPrimary, marginBottom: 6 }}>
              {t.agentsNoResults}
            </div>
            <div style={{ fontSize: 13.5, color: C.txtMuted, maxWidth: 360, margin: "0 auto" }}>
              {hasActiveFilters
                ? (lang === "so"
                  ? "Isku day inaad nadiifiso filters ama dooro qeeb/degmo kale."
                  : "Try clearing filters or pick another qeebta / district.")
                : (lang === "so"
                  ? "Wali lama helin agents lagu soo bandhigo."
                  : "No agents to show yet.")}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  marginTop: 16,
                  border: `1px solid ${hexA(accent, 0.35)}`,
                  background: hexA(accent, 0.1),
                  color: accent,
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {lang === "so" ? "Nadiifi filters" : "Clear filters"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr
                  style={{
                    background: isDark ? hexA(accent, 0.1) : hexA(accent, 0.06),
                    borderBottom: `1px solid ${C.tableSep}`,
                  }}
                >
                  {isSuper && (
                    <th style={{ ...th(C), width: 40 }} className="no-print">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleAll} />
                    </th>
                  )}
                  <th style={{ ...th(C), width: 44 }}>#</th>
                  <th style={th(C)}>{t.colName}</th>
                  <th style={th(C)}>{t.colPhone}</th>
                  <th style={th(C)}>{t.colDistrict}</th>
                  <th style={th(C)}>App</th>
                  <th style={th(C)}>{t.colStatus}</th>
                  <th style={th(C)}>{t.cishLastLogin}</th>
                  <th style={{ ...th(C), textAlign: "center", width: 56 }} className="no-print">{t.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const no = (page - 1) * listPageSize + idx + 1;
                  const uid = row.user_id;
                  const act = activityMeta(row.activity_status, lang);
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: `1px solid ${C.tableSep}`,
                        opacity: row.user_is_active ? 1 : 0.55,
                        background: idx % 2 ? hexA(accent, isDark ? 0.035 : 0.025) : "transparent",
                        transition: "background .12s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = hexA(accent, isDark ? 0.09 : 0.06);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = idx % 2
                          ? hexA(accent, isDark ? 0.035 : 0.025)
                          : "transparent";
                      }}
                    >
                      {isSuper && (
                        <td style={td(C)} className="no-print">
                          {uid != null && (
                            <input
                              type="checkbox"
                              checked={selected.has(uid)}
                              onChange={() => toggleOne(uid)}
                            />
                          )}
                        </td>
                      )}
                      <td style={{ ...td(C), color: C.txtMuted, fontWeight: 500 }}>{no}.</td>
                      <td style={td(C)}>
                        <button
                          type="button"
                          onClick={() => setDetailFor(row)}
                          title={lang === "so" ? "Fur faahfaahinta" : "View details"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            textAlign: "left",
                            maxWidth: 280,
                          }}
                        >
                          <Avatar name={row.full_name} url={row.profile_url} accent={accent} />
                          <span style={{ minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontWeight: 600,
                                fontSize: 13.5,
                                color: accent,
                                fontFamily: "var(--font-outfit)",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.full_name || "—"}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11.5,
                                color: C.txtMuted,
                                fontFamily: "var(--font-outfit)",
                                marginTop: 2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.nickname || row.service_id || "—"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td style={{ ...td(C), whiteSpace: "nowrap" }}>{row.phone || "—"}</td>
                      <td style={{ ...td(C), whiteSpace: "nowrap" }}>{row.county_name || "—"}</td>
                      <td style={td(C)}>
                        <Badge
                          label={row.installation_label || (row.app_installed ? "Loogu shubay" : "Looguma shubin")}
                          color={
                            row.installation_status === "completed"
                              ? "#28966f"
                              : row.installation_status === "iphone"
                                ? "#e6b25c"
                                : "#e0655a"
                          }
                        />
                      </td>
                      <td style={td(C)}>
                        <Badge
                          label={row.user_suspend ? "Suspended" : row.user_is_active ? t.statusActive : t.statusInactive}
                          color={row.user_suspend ? "#e0655a" : row.user_is_active ? "#46c08a" : "#9a8a6f"}
                        />
                      </td>
                      <td style={td(C)}>
                        <button
                          type="button"
                          onClick={() => setLoginDetailsFor(row)}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            color: C.txtPrimary,
                            fontFamily: "var(--font-outfit)",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" }}>
                            {relativeTime(row.last_login, lang)}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <Badge label={act.label} color={act.color} />
                          </div>
                        </button>
                      </td>
                      <td style={{ ...td(C), textAlign: "center", width: 56 }} className="no-print">
                        {uid != null ? (
                          <MoreActionsMenu
                            C={C}
                            accent={accent}
                            isDark={isDark}
                            items={[
                              {
                                label: lang === "so" ? "Faahfaahin" : "View details",
                                icon: "open",
                                onClick: () => setDetailFor(row),
                              },
                              {
                                label: t.viewAction,
                                icon: "users",
                                onClick: () => setProfileUserId(String(uid)),
                              },
                              {
                                label: lang === "so" ? "Gelitaannadii dhowaa" : "Recent logins",
                                icon: "clock",
                                onClick: () => setLoginDetailsFor(row),
                              },
                              {
                                label: t.appUsersStaffCheck,
                                icon: "search",
                                onClick: () => void runStaffCheck(row),
                              },
                              {
                                label: t.userTestMobile,
                                icon: "mail",
                                onClick: () => void runMobileTest(row),
                              },
                              {
                                label: t.appUsersAssignGroups,
                                icon: "users",
                                onClick: () => setGroupsFor(row),
                              },
                              {
                                label: t.appUsersResetToPhone,
                                icon: "lock",
                                danger: true,
                                onClick: () => setConfirmResetPhone(row),
                              },
                              ...(isSuper && row.has_app_pin
                                ? [{
                                    label: t.appUsersResetPin,
                                    icon: "lock" as const,
                                    danger: true,
                                    onClick: () => setConfirmResetPin(row),
                                  }]
                                : []),
                            ]}
                          />
                        ) : (
                          <MoreActionsMenu
                            C={C}
                            accent={accent}
                            isDark={isDark}
                            items={[
                              {
                                label: lang === "so" ? "Faahfaahin" : "View details",
                                icon: "open",
                                onClick: () => setDetailFor(row),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="no-print" style={{ marginTop: 14 }}>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          totalLabel={`${totalCount} · ${t.page} ${page} ${t.of} ${totalPages}`}
          C={C}
          accent={accent}
          isDark={isDark}
          isFetching={isFetching}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
        />
      </div>

      <AgentDetailModal
        row={detailFor}
        onClose={() => setDetailFor(null)}
        C={C}
        accent={accent}
        isDark={isDark}
        isSuper={isSuper}
        onOpenProfile={() => {
          if (detailFor?.user_id != null) setProfileUserId(String(detailFor.user_id));
        }}
        onLogins={() => {
          if (detailFor) setLoginDetailsFor(detailFor);
        }}
        onStaffCheck={() => {
          if (detailFor) void runStaffCheck(detailFor);
        }}
        onMobileTest={() => {
          if (detailFor) void runMobileTest(detailFor);
        }}
        onGroups={() => {
          if (detailFor) setGroupsFor(detailFor);
        }}
        onResetPhone={() => {
          if (detailFor) setConfirmResetPhone(detailFor);
        }}
        onResetPin={() => {
          if (detailFor) setConfirmResetPin(detailFor);
        }}
      />

      <LoginActivityModal
        row={loginDetailsFor}
        onClose={() => setLoginDetailsFor(null)}
        C={C}
        accent={accent}
      />

      <AmnigaStaffSearchModal
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        title={t.appUsersSearchStaff}
        C={C}
        accent={accent}
        mode="staff"
        onCreated={invalidateAppUsers}
      />
      <AmnigaStaffSearchModal
        open={hrmOpen}
        onClose={() => setHrmOpen(false)}
        title={t.appUsersHrmSearch}
        C={C}
        accent={accent}
        mode="hrm"
      />

      <AccountModal
        open={!!loginCreds}
        onClose={() => setLoginCreds(null)}
        title={loginCreds?.ok ? t.userMobileOk : t.userMobileFail}
        subtitle={loginCreds?.name}
        C={C}
        accent={loginCreds?.ok ? "#46c08a" : "#e0655a"}
        size="sm"
        footer={
          <PrimaryButton onClick={() => setLoginCreds(null)} accent={accent}>
            OK
          </PrimaryButton>
        }
      >
        {loginCreds && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--font-outfit)" }}>
            {!loginCreds.ok && loginCreds.message && (
              <div style={{ fontSize: 13, color: "#e0655a" }}>{loginCreds.message}</div>
            )}
            <div style={{ padding: 14, borderRadius: 12, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
              <div style={{ fontSize: 11.5, color: C.txtMuted, marginBottom: 4 }}>Email</div>
              <code style={{ fontSize: 14, color: C.txtPrimary, userSelect: "all", wordBreak: "break-all" }}>
                {loginCreds.email || "—"}
              </code>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
              <div style={{ fontSize: 11.5, color: C.txtMuted, marginBottom: 4 }}>Password (phone)</div>
              <code style={{ fontSize: 14, color: C.txtPrimary, userSelect: "all", wordBreak: "break-all" }}>
                {loginCreds.password || "—"}
              </code>
            </div>
          </div>
        )}
      </AccountModal>

      <AccountModal
        open={!!bulkLoginRows}
        onClose={() => setBulkLoginRows(null)}
        title={lang === "so" ? "Tijaabada mobile login" : "Mobile login tests"}
        subtitle={
          bulkLoginRows
            ? `${bulkLoginRows.filter((row) => row.can_login).length} / ${bulkLoginRows.length} OK`
            : ""
        }
        C={C}
        accent={accent}
        size="lg"
        footer={
          <PrimaryButton onClick={() => setBulkLoginRows(null)} accent={accent}>
            OK
          </PrimaryButton>
        }
      >
        {bulkLoginRows && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
              <thead>
                <tr>
                  {(lang === "so"
                    ? ["Magac", "4-digit", "User", "Password", "4-login", "Email", "Natiijo"]
                    : ["Name", "4-digit", "User", "Password", "4-login", "Email", "Result"]
                  ).map((label) => (
                    <th key={label} style={{ ...th(C), textAlign: "left", whiteSpace: "nowrap" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bulkLoginRows.map((row) => (
                  <tr key={row.user_id} style={{ borderBottom: `1px solid ${C.tableSep}` }}>
                    <td style={td(C)}>{row.name || "—"}</td>
                    <td style={td(C)}>
                      <code style={{ userSelect: "all" }}>{row.last4 || "—"}</code>
                    </td>
                    <td style={td(C)}>
                      <code style={{ userSelect: "all" }}>{row.email || "—"}</code>
                    </td>
                    <td style={td(C)}>
                      <code style={{ userSelect: "all" }}>
                        {row.password || (lang === "so" ? "lama ogaan" : "unknown")}
                      </code>
                    </td>
                    <td style={td(C)}>
                      <Badge label={row.last4_ok ? "OK" : "FAIL"} color={row.last4_ok ? "#46c08a" : "#e0655a"} />
                    </td>
                    <td style={td(C)}>
                      <Badge label={row.email_ok ? "OK" : "FAIL"} color={row.email_ok ? "#46c08a" : "#e0655a"} />
                    </td>
                    <td style={td(C)}>
                      <Badge
                        label={row.detail || (row.can_login ? "OK" : "FAIL")}
                        color={row.can_login ? "#46c08a" : "#e0655a"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AccountModal>

      {groupsFor?.user_id != null && (
        <GroupsModal
          open={!!groupsFor}
          onClose={() => setGroupsFor(null)}
          userId={String(groupsFor.user_id)}
          C={C}
          accent={accent}
          initialIds={groupsFor.groups.map((g) => g.id)}
        />
      )}

      <ConfirmDialog
        open={confirmBulk}
        title={t.appUsersResetPass}
        message={t.appUsersBulkResetConfirm.replace("{n}", String(selected.size)).replace("{county}", counties.find((c) => String(c.id) === county)?.name ?? "")}
        confirmLabel={lang === "so" ? "Xaqiiji" : "Confirm"}
        cancelLabel={t.cancelAction}
        pending={bulkReset.isPending}
        onCancel={() => setConfirmBulk(false)}
        onConfirm={() => {
          bulkReset.mutate(
            { county_id: county, user_ids: Array.from(selected) },
            { onSuccess: () => { setConfirmBulk(false); setSelected(new Set()); } },
          );
        }}
        C={C}
        accent="#e0655a"
      />

      <ConfirmDialog
        open={!!confirmResetPhone}
        title={t.appUsersResetToPhone}
        message={confirmResetPhone?.full_name ?? ""}
        confirmLabel={lang === "so" ? "Xaqiiji" : "Confirm"}
        cancelLabel={t.cancelAction}
        pending={resetToPhone.isPending}
        onCancel={() => setConfirmResetPhone(null)}
        onConfirm={() => {
          if (!confirmResetPhone) return;
          resetToPhone.mutate(confirmResetPhone.id, { onSuccess: () => setConfirmResetPhone(null) });
        }}
        C={C}
        accent="#e0655a"
      />

      <ConfirmDialog
        open={!!confirmResetPin}
        title={t.appUsersResetPin}
        message={
          confirmResetPin
            ? `${confirmResetPin.full_name || "—"} — ${t.appUsersResetPinConfirm}`
            : t.appUsersResetPinConfirm
        }
        confirmLabel={lang === "so" ? "Reset 0000" : "Reset to 0000"}
        cancelLabel={t.cancelAction}
        pending={resetAppPin.isPending}
        onCancel={() => setConfirmResetPin(null)}
        onConfirm={() => {
          if (!confirmResetPin?.user_id) return;
          resetAppPin.mutate(String(confirmResetPin.user_id), {
            onSuccess: () => {
              setConfirmResetPin(null);
              invalidateAppUsers();
            },
          });
        }}
        C={C}
        accent={accent}
      />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .amniga-app-users-print { color: #000 !important; }
        }
      `}</style>
    </div>
  );
}
