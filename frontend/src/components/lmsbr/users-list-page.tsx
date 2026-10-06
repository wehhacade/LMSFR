"use client";

import { useEffect, useLayoutEffect, useRef, useState, useDeferredValue } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import {
  useCounties,
  useCreateUser,
  useDeleteUser,
  useAllGroups,
  useAllPermissions,
  useQeybs,
  useUpdateUser,
  useUser,
  useUserTypes,
  useUsers,
  useUserStats,
} from "@/hooks/use-accounts";
import { ShimmerForcesTable, ShimmerKPI } from "./shimmer";
import { UserProfilePage } from "./user-profile-page";
import { resolveMediaUrl } from "@/lib/media-url";
import type { AccountUser, UserRole } from "@/types/accounts";
import {
  AccountModal,
  ConfirmDialog,
  FormField,
  FormRow,
  FormSection,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";

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

function UserListAvatar({ name, url, accent }: { name: string; url?: string | null; accent: string }) {
  const src = resolveMediaUrl(url);
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.5)})`,
        color: "#1c1917",
        fontWeight: 700,
        fontSize: 13,
        fontFamily: "var(--font-cinzel)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials
      )}
    </div>
  );
}

function roleColor(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: "#ef4444", officer: "#6366f1", agent: "#0ea5e9", user: "#64748b",
  };
  return map[role] ?? "#64748b";
}

function RoleBadge({ role }: { role: UserRole }) {
  const color = roleColor(role);
  return (
    <span style={{ fontSize:"12px", fontWeight:600, padding:"4px 10px", borderRadius:"20px", background:hexA(color,0.14), color, border:`1px solid ${hexA(color,0.28)}`, fontFamily:"var(--font-outfit)", textTransform:"capitalize" }}>
      {role}
    </span>
  );
}

function StatusBadge({ active, suspended }: { active: boolean; suspended: boolean }) {
  const color = suspended ? "#e0655a" : active ? "#46c08a" : "#9a8a6f";
  const label = suspended ? "Suspended" : active ? "Active" : "Inactive";
  return (
    <span style={{ fontSize:"12px", fontWeight:500, padding:"4px 10px", borderRadius:"20px", background:hexA(color,0.12), color, border:`1px solid ${hexA(color,0.25)}`, fontFamily:"var(--font-outfit)" }}>
      {label}
    </span>
  );
}

function CountyFilter({ value, options, onChange, placeholder, accent, C, isDark }: {
  value: string; options: { id: string; name: string }[]; onChange: (v: string) => void;
  placeholder: string; accent: string; C: AccountsThemeColors; isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const label = value ? options.find(o => o.id === value)?.name ?? placeholder : placeholder;
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px", borderRadius:"10px", border:`1px solid ${value ? hexA(accent,0.4) : C.inputBdr}`, background: value ? hexA(accent, isDark ? 0.12 : 0.08) : C.inputBg, color: value ? accent : C.txtSecondary, cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"14px", minWidth:"160px" }}>
        <Icon name="map" size={16} sw={1.8} />
        <span style={{ flex:1, textAlign:"left", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:40, minWidth:"200px", maxHeight:"240px", overflowY:"auto", borderRadius:"12px", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow }}>
          <button onClick={() => { onChange(""); setOpen(false); }} style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 14px", border:"none", background:"transparent", color:C.txtMuted, cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"14px" }}>{placeholder}</button>
          {options.map(o => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 14px", border:"none", background: value === o.id ? hexA(accent,0.1) : "transparent", color: value === o.id ? accent : C.txtPrimary, cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"14px" }}>{o.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ open, onClose, C, accent, counties, groups }: {
  open: boolean; onClose: () => void; C: AccountsThemeColors; accent: string;
  counties: { id: string; name: string }[];
  groups: { id: number; name: string }[];
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const create = useCreateUser();
  const { data: userTypes = [] } = useUserTypes();
  const { data: qeybs = [] } = useQeybs();
  const [form, setForm] = useState({ email: "", username: "", password: "", first_name: "", last_name: "", phone: "", county: "", user_type: "", department: "" });
  const [profile, setProfile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setForm({ email: "", username: "", password: "", first_name: "", last_name: "", phone: "", county: "", user_type: "", department: "" });
      setProfile(null);
      setPreview(null);
      setGroupIds([]);
    }
  }, [open]);

  const onFile = (file: File | null) => {
    setProfile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  if (!open) return null;

  const qebeedNeedsQeyb = isTaliyeQebeed(userTypes, form.user_type) && !form.department;
  const valid = Boolean(form.email && form.username && form.password.length >= 8 && !qebeedNeedsQeyb);

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={t.addUser}
      subtitle={t.userCreateSub}
      C={C}
      accent={accent}
      size="xl"
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton
            onClick={() => create.mutate({
              email: form.email,
              username: form.username,
              password: form.password,
              first_name: form.first_name,
              last_name: form.last_name,
              phone: form.phone,
              county: form.county || undefined,
              user_type: parseOptId(form.user_type),
              department: parseOptId(form.department),
              profile: profile ?? undefined,
              group_ids: groupIds.length ? groupIds : undefined,
            }, { onSuccess: () => onClose() })}
            disabled={create.isPending || !valid}
            accent={accent}
          >
            {create.isPending ? t.permSaving : t.addUser}
          </PrimaryButton>
        </>
      }
    >
      <FormSection title={t.profilePhoto} C={C}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "88px", height: "88px", borderRadius: "14px", overflow: "hidden", background: hexA(accent, 0.12), border: `1px solid ${hexA(accent, 0.25)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="users" size={32} sw={1.8} />}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            <SecondaryButton onClick={() => fileRef.current?.click()} C={C}>{t.uploadProfile}</SecondaryButton>
          </div>
        </div>
      </FormSection>

      <FormSection title={t.userCreateAccount} C={C}>
        <FormRow>
          <FormField label={t.colEmail} required C={C}>
            <TextInput value={form.email} onChange={set("email")} placeholder="user@example.com" type="email" C={C} />
          </FormField>
          <FormField label="Username" required C={C}>
            <TextInput value={form.username} onChange={set("username")} placeholder="username" C={C} />
          </FormField>
        </FormRow>
        <FormRow columns={1}>
          <FormField label="Password" required C={C}>
            <TextInput value={form.password} onChange={set("password")} placeholder="Minimum 8 characters" type="password" C={C} />
          </FormField>
        </FormRow>
      </FormSection>

      <FormSection title={t.userCreatePersonal} C={C}>
        <FormRow>
          <FormField label="First name" C={C}>
            <TextInput value={form.first_name} onChange={set("first_name")} placeholder="First name" C={C} />
          </FormField>
          <FormField label="Last name" C={C}>
            <TextInput value={form.last_name} onChange={set("last_name")} placeholder="Last name" C={C} />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t.colPhone} C={C}>
            <TextInput value={form.phone} onChange={set("phone")} placeholder={t.colPhone} C={C} />
          </FormField>
          <FormField label={t.colDistrict} C={C}>
            <select value={form.county} onChange={(e) => set("county")(e.target.value)}
              style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box" }}>
              <option value="">{t.filterDistrict}</option>
              {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label={t.userType} C={C}>
            <select value={form.user_type} onChange={(e) => {
              const v = e.target.value;
              set("user_type")(v);
              if (!isTaliyeQebeed(userTypes, v)) set("department")("");
            }}
              style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box" }}>
              <option value="">{t.userTypeNone}</option>
              {userTypes.map((ut) => <option key={ut.id} value={String(ut.id)}>{ut.name}</option>)}
            </select>
          </FormField>
          <FormField label={t.userQeyb} required={isTaliyeQebeed(userTypes, form.user_type)} C={C}>
            <select value={form.department} onChange={(e) => set("department")(e.target.value)}
              style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box" }}>
              <option value="">{t.userQeybNone}</option>
              {qeybs.map((q) => <option key={q.id} value={String(q.id)}>{q.name}</option>)}
            </select>
          </FormField>
        </FormRow>
      </FormSection>

      {groups.length > 0 && (
        <FormSection title={t.userTabGroups} description={t.userGroupsHelp} C={C}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", maxHeight: "220px", overflowY: "auto", padding: "12px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg }}>
            {groups.map((g) => {
              const checked = groupIds.includes(g.id);
              return (
                <label key={g.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "14px", color: C.txtPrimary, background: checked ? hexA(accent, 0.1) : "transparent", border: `1px solid ${checked ? hexA(accent, 0.3) : "transparent"}` }}>
                  <input type="checkbox" checked={checked} onChange={() => setGroupIds((prev) => prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id])} />
                  {g.name}
                </label>
              );
            })}
          </div>
        </FormSection>
      )}
    </AccountModal>
  );
}

function RoleCheckbox({
  label,
  description,
  checked,
  onChange,
  C,
  accent,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  C: AccountsThemeColors;
  accent: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "var(--font-outfit)",
        background: checked ? hexA(accent, 0.1) : C.inputBg,
        border: `1px solid ${checked ? hexA(accent, 0.35) : C.inputBdr}`,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: accent }}
      />
      <span>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.txtPrimary }}>{label}</span>
        {description ? (
          <span style={{ display: "block", marginTop: 4, fontSize: 12.5, color: C.txtMuted, lineHeight: 1.45 }}>{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function EditUserModal({ userId, open, onClose, C, accent, counties, groups }: {
  userId: string; open: boolean; onClose: () => void; C: AccountsThemeColors; accent: string;
  counties: { id: string; name: string }[];
  groups: { id: number; name: string }[];
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: user, isLoading } = useUser(open ? userId : null);
  const update = useUpdateUser(userId);
  const { data: userTypes = [] } = useUserTypes();
  const { data: qeybs = [] } = useQeybs();
  const { data: allPermissions = [] } = useAllPermissions("");
  const surveyPermissions = allPermissions.filter((p) => p.app_label === "surveys");
  const [form, setForm] = useState({ email: "", username: "", first_name: "", last_name: "", phone: "", county: "", bio: "", user_type: "", department: "" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissionIds, setPermissionIds] = useState<number[]>([]);
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [profile, setProfile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setProfile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      return;
    }
    if (user) {
      setForm({
        email: user.email ?? "",
        username: user.username ?? "",
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        phone: user.phone ?? "",
        county: user.county != null ? String(user.county) : "",
        bio: user.bio ?? "",
        user_type: user.user_type != null ? String(user.user_type) : "",
        department: user.department != null ? String(user.department) : "",
      });
      setGroupIds(user.groups.map((g) => g.id));
      setIsAdmin(!!user.is_admin);
      setPermissionIds(user.permissions.map((p) => p.id));
    }
  }, [open, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = (file: File | null) => {
    setProfile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  if (!open) return null;

  const avatarSrc = preview ?? resolveMediaUrl(user?.profile_url) ?? null;

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={t.editUser}
      subtitle={t.userEditSub}
      C={C}
      accent={accent}
      size="xl"
      footer={
        isLoading || !user ? undefined : (
          <>
            <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
            <PrimaryButton
              onClick={() => update.mutate({
                email: form.email.trim(),
                username: form.username.trim(),
                first_name: form.first_name,
                last_name: form.last_name,
                phone: form.phone,
                bio: form.bio,
                county: form.county || null,
                user_type: parseOptId(form.user_type),
                department: parseOptId(form.department),
                profile: profile ?? undefined,
                group_ids: groupIds,
                is_admin: isAdmin,
                permission_ids: permissionIds,
              }, { onSuccess: () => onClose() })}
              disabled={update.isPending || !form.email.trim() || !form.username.trim() || (isTaliyeQebeed(userTypes, form.user_type) && !form.department)}
              accent={accent}
            >
              {update.isPending ? t.permSaving : t.userSave}
            </PrimaryButton>
          </>
        )
      }
    >
      {isLoading || !user ? (
        <div style={{ padding: "32px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>Loading…</div>
      ) : (
        <>
          <FormSection title={t.profilePhoto} C={C}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "88px", height: "88px", borderRadius: "14px", overflow: "hidden", background: hexA(accent, 0.12), border: `1px solid ${hexA(accent, 0.25)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {avatarSrc ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="users" size={32} sw={1.8} />}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                <SecondaryButton onClick={() => fileRef.current?.click()} C={C}>{t.uploadProfile}</SecondaryButton>
              </div>
            </div>
          </FormSection>

          <FormSection title={t.userCreateAccount} C={C}>
            <FormRow>
              <FormField label={t.colEmail} required C={C}>
                <TextInput value={form.email} onChange={set("email")} placeholder="user@example.com" type="email" C={C} />
              </FormField>
              <FormField label="Username" required C={C}>
                <TextInput value={form.username} onChange={set("username")} placeholder="username" C={C} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title={t.userCreatePersonal} C={C}>
            <FormRow>
              <FormField label="First name" C={C}>
                <TextInput value={form.first_name} onChange={set("first_name")} placeholder="First name" C={C} />
              </FormField>
              <FormField label="Last name" C={C}>
                <TextInput value={form.last_name} onChange={set("last_name")} placeholder="Last name" C={C} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={t.colPhone} C={C}>
                <TextInput value={form.phone} onChange={set("phone")} placeholder={t.colPhone} C={C} />
              </FormField>
              <FormField label={t.colDistrict} C={C}>
                <select value={form.county} onChange={(e) => set("county")(e.target.value)}
                  style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box" }}>
                  <option value="">{t.filterDistrict}</option>
                  {counties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label={t.userType} C={C}>
                <select value={form.user_type} onChange={(e) => {
                  const v = e.target.value;
                  set("user_type")(v);
                  if (!isTaliyeQebeed(userTypes, v)) set("department")("");
                }}
                  style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box" }}>
                  <option value="">{t.userTypeNone}</option>
                  {userTypes.map((ut) => <option key={ut.id} value={String(ut.id)}>{ut.name}</option>)}
                </select>
              </FormField>
              <FormField label={t.userQeyb} required={isTaliyeQebeed(userTypes, form.user_type)} C={C}>
                <select value={form.department} onChange={(e) => set("department")(e.target.value)}
                  style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box" }}>
                  <option value="">{t.userQeybNone}</option>
                  {qeybs.map((q) => <option key={q.id} value={String(q.id)}>{q.name}</option>)}
                </select>
              </FormField>
            </FormRow>
            <FormRow columns={1}>
              <FormField label="Bio" C={C}>
                <textarea value={form.bio} onChange={(e) => set("bio")(e.target.value)} rows={3}
                  style={{ padding: "11px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary, fontFamily: "var(--font-outfit)", width: "100%", boxSizing: "border-box", resize: "vertical" }} />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title={t.userEditRoles} C={C}>
            <RoleCheckbox
              label={t.userAdminAccess}
              description={t.userAdminHelp}
              checked={isAdmin}
              onChange={setIsAdmin}
              C={C}
              accent={accent}
            />
          </FormSection>

          {surveyPermissions.length > 0 && (
            <FormSection title={t.userSurveyPermissions} description={t.userSurveyPermHelp} C={C}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, maxHeight: 220, overflowY: "auto", padding: 12, borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg }}>
                {surveyPermissions.map((perm) => {
                  const checked = permissionIds.includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontFamily: "var(--font-outfit)",
                        fontSize: 13.5,
                        color: C.txtPrimary,
                        background: checked ? hexA(accent, 0.1) : "transparent",
                        border: `1px solid ${checked ? hexA(accent, 0.3) : "transparent"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setPermissionIds((prev) => (
                          prev.includes(perm.id) ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                        ))}
                        style={{ accentColor: accent }}
                      />
                      <span>{perm.name}</span>
                    </label>
                  );
                })}
              </div>
            </FormSection>
          )}

          {groups.length > 0 && (
            <FormSection title={t.userTabGroups} description={t.userGroupsHelp} C={C}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", maxHeight: "220px", overflowY: "auto", padding: "12px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.inputBg }}>
                {groups.map((g) => {
                  const checked = groupIds.includes(g.id);
                  return (
                    <label key={g.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "14px", color: C.txtPrimary, background: checked ? hexA(accent, 0.1) : "transparent", border: `1px solid ${checked ? hexA(accent, 0.3) : "transparent"}` }}>
                      <input type="checkbox" checked={checked} onChange={() => setGroupIds((prev) => prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id])} />
                      {g.name}
                    </label>
                  );
                })}
              </div>
            </FormSection>
          )}
        </>
      )}
    </AccountModal>
  );
}

export function UsersListPage({ C, accent, isDark, persistKey, profileId, setProfileId, registerAddAction }: {
  C: AccountsThemeColors; accent: string; isDark: boolean; persistKey: string;
  profileId: string | null; setProfileId: (id: string | null) => void;
  registerAddAction?: (open: () => void) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);

  const pageKey = `${persistKey}:page`;
  const searchKey = `${persistKey}:search`;
  const countyKey = `${persistKey}:county`;
  const roleKey = `${persistKey}:role`;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [countyFilter, setCountyFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountUser | null>(null);
  const deleteUser = useDeleteUser();

  useLayoutEffect(() => {
    setPage(Number(localStorage.getItem(pageKey) ?? 1));
    setSearch(localStorage.getItem(searchKey) ?? "");
    setCountyFilter(localStorage.getItem(countyKey) ?? "");
    setRoleFilter(localStorage.getItem(roleKey) ?? "");
  }, [pageKey, searchKey, countyKey, roleKey]);

  const deferredSearch = useDeferredValue(search);
  const { data, isLoading, isFetching, isPlaceholderData } = useUsers({
    page, search: deferredSearch, county: countyFilter || undefined, role: roleFilter || undefined, pageSize,
  });
  const { data: stats, isLoading: statsLoading } = useUserStats();
  const { data: counties = [] } = useCounties();
  const { data: allGroups = [] } = useAllGroups();

  useEffect(() => {
    registerAddAction?.(() => setShowCreate(true));
  }, [registerAddAction]);

  useEffect(() => { setPage(1); }, [deferredSearch, countyFilter, roleFilter, pageSize]);
  useEffect(() => { localStorage.setItem(pageKey, String(page)); }, [pageKey, page]);
  useEffect(() => { localStorage.setItem(searchKey, search); }, [searchKey, search]);
  useEffect(() => { localStorage.setItem(countyKey, countyFilter); }, [countyKey, countyFilter]);
  useEffect(() => { localStorage.setItem(roleKey, roleFilter); }, [roleKey, roleFilter]);

  const actionLabels = { view: t.viewAction, edit: t.editAction, delete: t.deleteAction };

  const handleRowAction = (user: AccountUser, action: "view" | "edit" | "delete") => {
    if (action === "delete") {
      setDeleteTarget(user);
      return;
    }
    if (action === "edit") {
      setEditUserId(user.id);
      return;
    }
    setProfileId(user.id);
  };

  const users = data?.results ?? [];
  const showShimmer = isLoading && !data;
  const totalPages = data ? Math.ceil(data.count / pageSize) : 1;

  const kpis = [
    { label: t.usersTotal, value: stats?.total ?? 0, icon: "users" },
    { label: t.usersActive, value: stats?.active ?? 0, icon: "check" },
    { label: t.usersStaff, value: stats?.staff ?? 0, icon: "badge" },
    { label: t.usersMobile, value: stats?.mobile ?? 0, icon: "box" },
  ];

  const modals = (
    <>
      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} C={C} accent={accent} counties={counties} groups={allGroups} />
      {editUserId && (
        <EditUserModal
          userId={editUserId}
          open={!!editUserId}
          onClose={() => setEditUserId(null)}
          C={C}
          accent={accent}
          counties={counties}
          groups={allGroups}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t.confirmDelete}
        message={t.confirmDeleteUser}
        confirmLabel={t.deleteUser}
        cancelLabel={t.cancelAction}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteUser.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={deleteUser.isPending}
      />
    </>
  );

  if (profileId) {
    return (
      <>
        {modals}
        <UserProfilePage
          userId={profileId}
          onBack={() => setProfileId(null)}
          onEdit={() => setEditUserId(profileId)}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      </>
    );
  }

  return (
    <div style={{ marginTop:"24px", animation:"is-fadeUp .5s ease both" }}>
      {modals}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"14px", marginBottom:"22px" }}>
        {statsLoading ? kpis.map((_, i) => <ShimmerKPI key={i} />) : kpis.map((k, i) => (
          <div key={i} style={{ padding:"18px", borderRadius:"14px", background:C.cardBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.cardShadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"40px", height:"40px", borderRadius:"11px", display:"flex", alignItems:"center", justifyContent:"center", background:hexA(accent,0.14), color:accent }}>
                <Icon name={k.icon} size={20} sw={1.8} />
              </div>
              <div>
                <div style={{ fontSize:"12px", color:C.txtMuted, fontFamily:"var(--font-outfit)" }}>{k.label}</div>
                <div style={{ fontSize:"24px", fontWeight:700, color:C.txtPrimary, fontFamily:"var(--font-cinzel)" }}>{k.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"18px" }}>
        <div style={{ flex:1, minWidth:"220px", display:"flex", alignItems:"center", gap:"9px", padding:"10px 14px", borderRadius:"10px", background:C.inputBg, border:`1px solid ${C.inputBdr}` }}>
          <Icon name="search" size={16} sw={1.8} />
          <input placeholder={t.searchStaff} value={search} onChange={e => setSearch(e.target.value)}
            style={{ border:"none", outline:"none", background:"transparent", color:C.txtPrimary, fontFamily:"var(--font-outfit)", fontSize:"14px", flex:1 }} />
        </div>
        <CountyFilter value={countyFilter} options={counties} onChange={setCountyFilter} placeholder={t.filterDistrict} accent={accent} C={C} isDark={isDark} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ padding:"10px 14px", borderRadius:"10px", border:`1px solid ${C.inputBdr}`, background:C.inputBg, color:C.txtPrimary, fontFamily:"var(--font-outfit)", fontSize:"14px" }}>
          <option value="">{t.filterAllRoles}</option>
          <option value="admin">Admin</option>
          <option value="officer">Officer</option>
          <option value="agent">Agent</option>
        </select>
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={lang === "so" ? "Tiro" : "Rows"}
      />

      <div style={{ borderRadius:"14px", background:C.panelBg, border:`1px solid ${C.cardBdr}`, boxShadow:C.panelShadow, overflow:"hidden", opacity: isPlaceholderData && isFetching ? 0.85 : 1, transition:"opacity .2s" }}>
        {showShimmer ? <ShimmerForcesTable /> : users.length === 0 ? (
          <div style={{ padding:"48px", textAlign:"center", color:C.txtMuted, fontFamily:"var(--font-outfit)" }}>
            <Icon name="search" size={26} sw={1.8} />
            <p style={{ marginTop:"12px" }}>{t.noUsers}</p>
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"var(--font-outfit)" }}>
              <thead>
                <tr style={{ background:C.tableHead, borderBottom:`1px solid ${C.tableSep}` }}>
                  {[t.colName, t.colEmail, t.colPhone, t.colDistrict, t.colRole, t.colStatus, t.colAction].map((h, i) => (
                    <th key={i} style={{ padding:"14px 16px", textAlign:"left", fontSize:"12px", fontWeight:600, color:C.txtMuted, letterSpacing:".06em", textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user: AccountUser) => (
                  <tr key={user.id} onClick={() => handleRowAction(user, "view")} style={{ borderBottom:`1px solid ${C.tableSep}`, cursor:"pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <UserListAvatar
                          name={user.full_name || user.username}
                          url={user.profile_url}
                          accent={accent}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: C.txtPrimary, fontWeight: 500 }}>
                            {user.full_name || user.username}
                          </div>
                          <div style={{ color: C.txtMuted, fontSize: 12, marginTop: 2 }}>
                            {user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"14px 16px", color:C.txtSecondary }}>{user.email}</td>
                    <td style={{ padding:"14px 16px", color:C.txtSecondary }}>{user.phone || "—"}</td>
                    <td style={{ padding:"14px 16px", color:C.txtSecondary }}>{user.county_name || "—"}</td>
                    <td style={{ padding:"14px 16px" }}><RoleBadge role={user.role} /></td>
                    <td style={{ padding:"14px 16px" }}><StatusBadge active={user.is_active} suspended={user.suspend} /></td>
                    <td style={{ padding:"14px 16px" }}>
                      <RowActions
                        actions={["view", "edit", "delete"]}
                        onAction={(action) => handleRowAction(user, action)}
                        C={C}
                        accent={accent}
                        labels={actionLabels}
                      />
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
          isDark={isDark}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
          totalLabel={`${data?.count ?? 0} staff · ${t.page} ${page} ${t.of} ${totalPages}`}
          hideWhenSinglePage
        />
      </div>
    </div>
  );
}
