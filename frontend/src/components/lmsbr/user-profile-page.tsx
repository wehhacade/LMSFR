"use client";

import { useRef, useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { resolveMediaUrl } from "@/lib/media-url";
import { Icon } from "./icon";
import {
  useAdminResetPassword,
  useAdminResetPin,
  useAllGroups,
  useAssignGroups,
  useDeleteUser,
  useStaffCheck,
  useTestMobileLogin,
  useUpdateUser,
  useUser,
  useUserDevices,
} from "@/hooks/use-accounts";
import { ShimmerSuspectProfile } from "./shimmer";
import type { UserRole } from "@/types/accounts";
import {
  BackButton,
  ConfirmDialog,
  SecondaryButton,
  type AccountsThemeColors,
} from "./accounts-shared";

type ThemeColors = AccountsThemeColors;
type TabId = "details" | "staff" | "groups" | "security" | "devices";

function roleColor(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: "#ef4444", officer: "#6366f1", agent: "#0ea5e9", user: "#64748b",
  };
  return map[role] ?? "#64748b";
}

function ProfileCard({ children, C, style }: { children: ReactNode; C: ThemeColors; style?: CSSProperties }) {
  return (
    <div style={{
      borderRadius: 16,
      background: C.panelBg,
      border: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SideNav({ active, onChange, accent, C, tabs }: {
  active: TabId;
  onChange: (id: TabId) => void;
  accent: string;
  C: ThemeColors;
  tabs: { id: TabId; label: string; icon: string }[];
}) {
  return (
    <ProfileCard C={C} style={{ padding: 8 }}>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                gap: 10,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-outfit)",
                fontSize: 14,
                fontWeight: on ? 600 : 500,
                background: on ? accent : "transparent",
                color: on ? "#fff" : C.txtSecondary,
                boxShadow: on ? `0 4px 14px -4px ${hexA(accent, 0.55)}` : "none",
                transition: "background .2s, color .2s, box-shadow .2s",
              }}
            >
              <span style={{ display: "flex", opacity: on ? 1 : 0.75 }}>
                <Icon name={tab.icon} size={16} sw={on ? 2.2 : 1.8} />
              </span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </ProfileCard>
  );
}

function SectionHeader({ title, subtitle, mutedColor, action }: { title: string; subtitle?: string; mutedColor?: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <div>
        <h3 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: 20, fontWeight: 600, color: "inherit" }}>{title}</h3>
        {subtitle && (
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: mutedColor ?? "inherit", fontFamily: "var(--font-outfit)", lineHeight: 1.45 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function DetailField({ label, value, C, capitalize }: { label: string; value: string; C: ThemeColors; capitalize?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: C.txtMuted,
        marginBottom: 7,
        fontFamily: "var(--font-outfit)",
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        padding: "11px 14px",
        borderRadius: 10,
        border: `1px solid ${C.inputBdr}`,
        background: C.inputBg,
        color: C.txtPrimary,
        fontFamily: "var(--font-outfit)",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.45,
        textTransform: capitalize ? "capitalize" : undefined,
      }}>
        {value}
      </div>
    </div>
  );
}

function ProfileInput({
  value, onChange, placeholder, type = "text", maxLength, C,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  C: ThemeColors;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        padding: "11px 14px",
        borderRadius: 10,
        border: `1px solid ${focused ? C.inputFocusBdr ?? hexA("#c69049", 0.55) : C.inputBdr}`,
        background: C.inputBg,
        color: C.txtPrimary,
        fontFamily: "var(--font-outfit)",
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color .2s, box-shadow .2s",
        boxShadow: focused ? `0 0 0 3px ${hexA("#c69049", 0.12)}` : "none",
      }}
    />
  );
}

function CheckRow({ label, ok, C }: { label: string; ok: boolean; C: ThemeColors }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderRadius: 10,
      background: C.inputBg,
      border: `1px solid ${C.tableSep}`,
    }}>
      <span style={{ fontSize: 14, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 11px",
        borderRadius: 20,
        fontFamily: "var(--font-outfit)",
        background: ok ? "rgba(70,192,138,0.14)" : "rgba(224,101,90,0.12)",
        color: ok ? "#46c08a" : "#e0655a",
      }}>
        {ok ? "Yes" : "No"}
      </span>
    </div>
  );
}

function MetaItem({ icon, children, C }: { icon: string; children: ReactNode; C: ThemeColors }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontSize: 13.5,
      color: C.txtSecondary,
      fontFamily: "var(--font-outfit)",
    }}>
      <span style={{ display: "flex", color: C.txtMuted }}><Icon name={icon} size={14} sw={1.8} /></span>
      {children}
    </span>
  );
}

export function UserProfilePage({ userId, onBack, onEdit, C, accent, isDark, selfView = false }: {
  userId: string;
  onBack: () => void;
  onEdit?: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  selfView?: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: user, isLoading, isError } = useUser(userId);
  const { data: staff } = useStaffCheck(userId);
  const { data: devices } = useUserDevices(userId);
  const { data: allGroups } = useAllGroups();
  const updateUser = useUpdateUser(userId);
  const assignGroups = useAssignGroups(userId);
  const resetPassword = useAdminResetPassword(userId);
  const resetPin = useAdminResetPin(userId);
  const testMobile = useTestMobileLogin(userId);
  const deleteUser = useDeleteUser();

  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<number[] | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [mobileResult, setMobileResult] = useState<string | null>(null);
  const profileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setSelectedGroups(null);
  }, [userId]);

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !user) {
    return (
      <ProfileCard C={C} style={{ padding: "48px 24px", textAlign: "center", marginTop: 20 }}>
        <p style={{ color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{t.noUsers}</p>
        <button
          onClick={onBack}
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 10,
            border: `1px solid ${hexA(accent, 0.35)}`,
            background: hexA(accent, 0.1),
            color: accent,
            cursor: "pointer",
            fontFamily: "var(--font-outfit)",
          }}
        >
          {t.backToList}
        </button>
      </ProfileCard>
    );
  }

  const rc = roleColor(user.role);
  const displayName = user.full_name || user.username;
  const initials = displayName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const groupIds = selectedGroups ?? user.groups.map((g) => g.id);
  const profileImageUrl = resolveMediaUrl(user.profile_url);
  const statusLabel = user.suspend ? "Suspended" : user.is_active ? "Active" : "Inactive";
  const statusColor = user.suspend ? "#e0655a" : user.is_active ? "#46c08a" : "#9a8a6f";

  const tabs = [
    { id: "details" as const, label: t.userTabDetails, icon: "users" },
    { id: "staff" as const, label: t.userTabStaff, icon: "badge" },
    { id: "groups" as const, label: t.userTabGroups, icon: "shield" },
    { id: "security" as const, label: t.userTabSecurity, icon: "lock" },
    { id: "devices" as const, label: t.userTabDevices, icon: "box" },
  ];

  const tabSubtitles: Record<TabId, string> = {
    details: "Personal details and account information.",
    staff: "Staff privileges and administrative access.",
    groups: "Permission groups assigned to this user.",
    security: "Password, PIN, and mobile login settings.",
    devices: "Registered devices and login history.",
  };

  return (
    <div style={{ animation: "is-fadeUp .45s ease both", marginTop: 20 }}>
      <BackButton label={selfView ? t.backFromProfile : t.backToList} onClick={onBack} C={C} />

      {/* ── Profile hero ── */}
      <ProfileCard C={C} style={{ padding: "28px 32px", marginBottom: 24 }}>
        <div className="user-profile-hero" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${hexA(accent, 0.35)}, ${hexA(accent, 0.12)})`,
              border: `3px solid ${hexA(accent, isDark ? 0.35 : 0.25)}`,
              boxShadow: isDark ? `0 8px 32px -8px ${hexA(accent, 0.4)}` : `0 4px 20px -6px ${hexA(accent, 0.3)}`,
            }}>
              {profileImageUrl ? (
                <img src={profileImageUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "var(--font-cinzel)", fontSize: 32, fontWeight: 700, color: accent }}>{initials}</span>
              )}
            </div>
            <input
              ref={profileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingPhoto(true);
                updateUser.mutate({ profile: file }, { onSettled: () => setUploadingPhoto(false) });
              }}
            />
            <button
              type="button"
              title={t.uploadProfile}
              onClick={() => profileRef.current?.click()}
              disabled={uploadingPhoto || updateUser.isPending}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `2px solid ${C.cardBdr}`,
                background: C.panelBg,
                color: C.txtSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }}
            >
              <Icon name="palette" size={14} sw={2} />
            </button>
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <h2 style={{
                margin: 0,
                fontFamily: "var(--font-cinzel)",
                fontSize: "clamp(22px, 3vw, 28px)",
                fontWeight: 600,
                color: C.txtPrimary,
                lineHeight: 1.2,
              }}>
                {displayName}
              </h2>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 11px",
                borderRadius: 20,
                background: hexA(rc, 0.14),
                color: rc,
                border: `1px solid ${hexA(rc, 0.28)}`,
                fontFamily: "var(--font-outfit)",
                textTransform: "capitalize",
              }}>
                {user.role}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 11px",
                borderRadius: 20,
                background: hexA(statusColor, 0.14),
                color: statusColor,
                border: `1px solid ${hexA(statusColor, 0.28)}`,
                fontFamily: "var(--font-outfit)",
              }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 20px" }}>
              <MetaItem icon="mail" C={C}>{user.email}</MetaItem>
              {user.county_name && <MetaItem icon="map" C={C}>{user.county_name}</MetaItem>}
              <MetaItem icon="shield" C={C}>{user.groups.length} group{user.groups.length !== 1 ? "s" : ""}</MetaItem>
              {user.date_joined && (
                <MetaItem icon="calendar" C={C}>Joined {user.date_joined.slice(0, 10)}</MetaItem>
              )}
            </div>
          </div>

          {/* Actions */}
          {!selfView && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => onEdit?.()}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 14,
                  boxShadow: `0 4px 14px -4px ${hexA(accent, 0.55)}`,
                }}
              >
                {t.editAction}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(224,101,90,0.35)",
                  background: "rgba(224,101,90,0.08)",
                  color: "#e0655a",
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {t.deleteAction}
              </button>
            </div>
          )}
        </div>
      </ProfileCard>

      {/* ── Settings layout: side nav + content ── */}
      <div className="user-profile-layout" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
        <SideNav active={activeTab} onChange={setActiveTab} accent={accent} C={C} tabs={tabs} />

        <ProfileCard C={C} style={{ padding: "28px 32px", color: C.txtPrimary }}>
          <SectionHeader
            title={tabs.find((tab) => tab.id === activeTab)?.label ?? ""}
            subtitle={tabSubtitles[activeTab]}
            mutedColor={C.txtMuted}
            action={
              activeTab === "details" && !selfView ? (
                <button
                  type="button"
                  onClick={() => onEdit?.()}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: accent,
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                    fontSize: 13,
                    boxShadow: `0 4px 12px -4px ${hexA(accent, 0.5)}`,
                  }}
                >
                  {t.editAction}
                </button>
              ) : undefined
            }
          />

          {activeTab === "details" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
              <DetailField label={t.colPhone} value={user.phone || "—"} C={C} />
              <DetailField label={t.colDistrict} value={user.county_name || "—"} C={C} />
              <DetailField label={t.userType} value={user.user_type_name || "—"} C={C} />
              <DetailField label={t.userQeyb} value={user.department_name || "—"} C={C} />
              <DetailField label={t.colRole} value={user.role} C={C} capitalize />
              <DetailField label="Staff" value={user.is_staff ? "Yes" : "No"} C={C} />
              <DetailField label="Mobile" value={user.is_mobile ? "Yes" : "No"} C={C} />
              <DetailField label={t.colEmail} value={user.email} C={C} />
              <div style={{ gridColumn: "1 / -1" }}>
                <DetailField label="Bio" value={user.bio || "—"} C={C} />
              </div>
            </div>
          )}

          {activeTab === "staff" && staff && (
            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <CheckRow label="Staff access" ok={staff.is_staff} C={C} />
              <CheckRow label="Superuser" ok={staff.is_superuser} C={C} />
              <CheckRow label="Admin panel access" ok={staff.can_access_admin} C={C} />
              <CheckRow label="Active account" ok={staff.is_active && !staff.suspend} C={C} />
              <CheckRow label="Officer role" ok={staff.is_officer} C={C} />
              <CheckRow label="Agent role" ok={staff.is_agent} C={C} />
              <button
                type="button"
                onClick={() => updateUser.mutate({ is_staff: !user.is_staff })}
                disabled={updateUser.isPending}
                style={{
                  marginTop: 8,
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.btnBg ?? C.inputBg,
                  color: C.txtPrimary,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontWeight: 600,
                  alignSelf: "flex-start",
                }}
              >
                {user.is_staff ? t.userRevokeStaff : t.userGrantStaff}
              </button>
            </div>
          )}

          {activeTab === "groups" && (
            <div>
              <p style={{ margin: "0 0 16px", color: C.txtMuted, fontSize: 14, fontFamily: "var(--font-outfit)", lineHeight: 1.5 }}>
                {t.userGroupsHelp}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
                {(allGroups ?? []).map((g) => {
                  const checked = groupIds.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1px solid ${checked ? hexA(accent, 0.4) : C.tableSep}`,
                        background: checked ? hexA(accent, 0.08) : C.inputBg,
                        cursor: "pointer",
                        fontFamily: "var(--font-outfit)",
                        fontSize: 14,
                        color: C.txtPrimary,
                        transition: "border-color .2s, background .2s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedGroups((prev) => {
                            const base = prev ?? user.groups.map((x) => x.id);
                            return base.includes(g.id) ? base.filter((id) => id !== g.id) : [...base, g.id];
                          });
                        }}
                        style={{ accentColor: accent }}
                      />
                      {g.name}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => assignGroups.mutate(groupIds)}
                disabled={assignGroups.isPending}
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                  boxShadow: `0 4px 14px -4px ${hexA(accent, 0.5)}`,
                }}
              >
                {assignGroups.isPending ? "Saving…" : t.userAssignGroups}
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div style={{ display: "grid", gap: 20, maxWidth: 480 }}>
              <div style={{ padding: "20px", borderRadius: 12, background: C.inputBg, border: `1px solid ${C.tableSep}` }}>
                <h4 style={{ margin: "0 0 12px", fontFamily: "var(--font-cinzel)", fontSize: 15, color: C.txtPrimary }}>{t.userResetPassword}</h4>
                <ProfileInput value={newPassword} onChange={setNewPassword} placeholder="New password (min 8)" type="password" C={C} />
                <button
                  type="button"
                  onClick={() => { if (newPassword.length >= 8) resetPassword.mutate(newPassword); }}
                  disabled={resetPassword.isPending || newPassword.length < 8}
                  style={{
                    marginTop: 12,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                    fontWeight: 600,
                    opacity: resetPassword.isPending || newPassword.length < 8 ? 0.6 : 1,
                  }}
                >
                  {t.userResetPassword}
                </button>
              </div>
              <div style={{ padding: "20px", borderRadius: 12, background: C.inputBg, border: `1px solid ${C.tableSep}` }}>
                <h4 style={{ margin: "0 0 12px", fontFamily: "var(--font-cinzel)", fontSize: 15, color: C.txtPrimary }}>{t.userResetPin}</h4>
                <ProfileInput value={newPin} onChange={setNewPin} placeholder="4–6 digit PIN" maxLength={6} C={C} />
                <button
                  type="button"
                  onClick={() => { if (newPin.length >= 4) resetPin.mutate(newPin); }}
                  disabled={resetPin.isPending || newPin.length < 4}
                  style={{
                    marginTop: 12,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                    fontWeight: 600,
                    opacity: resetPin.isPending || newPin.length < 4 ? 0.6 : 1,
                  }}
                >
                  {t.userResetPin}
                </button>
              </div>
              <div style={{ padding: "20px", borderRadius: 12, background: C.inputBg, border: `1px solid ${C.tableSep}` }}>
                <h4 style={{ margin: "0 0 12px", fontFamily: "var(--font-cinzel)", fontSize: 15, color: C.txtPrimary }}>{t.userTestMobile}</h4>
                <ProfileInput value={testPassword} onChange={setTestPassword} placeholder="Test password (optional)" type="password" C={C} />
                <button
                  type="button"
                  onClick={() => testMobile.mutate(testPassword, { onSuccess: (r) => setMobileResult(r.can_login ? t.userMobileOk : t.userMobileFail) })}
                  disabled={testMobile.isPending}
                  style={{
                    marginTop: 12,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "var(--font-outfit)",
                    fontWeight: 600,
                  }}
                >
                  {testMobile.isPending ? "Testing…" : t.userTestMobile}
                </button>
                {mobileResult && (
                  <p style={{ marginTop: 12, fontSize: 14, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>{mobileResult}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "devices" && (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.cardBdr}` }}>
              {(devices ?? []).length === 0 ? (
                <p style={{ padding: "40px 24px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)", margin: 0 }}>
                  {t.userNoDevices}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
                  <thead>
                    <tr style={{ background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead }}>
                      {["Device", "OS", "IP", "Date"].map((h) => (
                        <th key={h} style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          color: C.txtMuted,
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          fontWeight: 600,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {devices!.map((d) => (
                      <tr key={d.id} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                        <td style={{ padding: "12px 16px", color: C.txtPrimary, fontSize: 14 }}>{d.device || "—"}</td>
                        <td style={{ padding: "12px 16px", color: C.txtSecondary, fontSize: 14 }}>{d.operating_system || "—"}</td>
                        <td style={{ padding: "12px 16px", color: C.txtSecondary, fontSize: 14 }}>{d.ip_address || "—"}</td>
                        <td style={{ padding: "12px 16px", color: C.txtMuted, fontSize: 13 }}>{d.created_at.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </ProfileCard>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t.confirmDelete}
        message={t.confirmDeleteUser}
        confirmLabel={t.deleteUser}
        cancelLabel={t.cancelAction}
        onConfirm={() => deleteUser.mutate(userId, { onSuccess: () => { setConfirmDelete(false); onBack(); } })}
        onCancel={() => setConfirmDelete(false)}
        C={C}
        accent={accent}
        pending={deleteUser.isPending}
      />

      <style>{`
        @media (max-width: 900px) {
          .user-profile-layout { grid-template-columns: 1fr !important; }
          .user-profile-hero { flex-direction: column; align-items: flex-start !important; }
        }
      `}</style>
    </div>
  );
}
