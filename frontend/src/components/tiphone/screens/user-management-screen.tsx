"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Search,
  ShieldCheck,
} from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { so } from "@/lib/tiphone/i18n";
import type {
  AppInstallationDepartment,
  AppInstallationStatus,
  AppInstallationSummary,
  AppInstallationUserRow,
  AppPermissionGroup,
  NotInstalledReason,
} from "@/lib/tiphone/types";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "../theme-provider";
import { ScreenAppBar } from "../app-bar";
import { GoldButton } from "../gold-button";
import { TipToast } from "../toast";
import { ListRowShimmer } from "../shimmer";

const VIOLET = "#5B6FD6";
const VIOLET_RGB = "91, 111, 214";
const GREEN = "#28966F";
const IPHONE = "#E07A5F";

const INSTALLATION_META: Record<
  AppInstallationStatus,
  { label: AppInstallationUserRow["installationLabel"]; color: string }
> = {
  not_installed: { label: "Looguma shubin", color: VIOLET },
  completed: { label: "Loogu shubay", color: GREEN },
  iphone: { label: "iPhone", color: IPHONE },
};

const NOT_INSTALLED_REASONS: Array<{ value: NotInstalledReason; label: string }> = [
  { value: "did_not_attend", label: "Ma imaanin" },
  { value: "basic_phone", label: "Telefoon button/Nokia wata" },
  { value: "no_phone", label: "Mobile ma wato" },
  { value: "unsupported_phone", label: "Mobile-ku ma taageerayo" },
  { value: "no_internet", label: "Internet/xog ma leh" },
  { value: "login_issue", label: "Password/login cilad" },
  { value: "refused", label: "Wuu diiday" },
  { value: "other", label: "Sabab kale" },
];

export function UserManagementScreen({
  onBack,
  onMenu,
}: {
  onBack: () => void;
  onMenu: () => void;
}) {
  const { colors } = useTipTheme();
  const [users, setUsers] = useState<AppInstallationUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentId, setDepartmentId] = useState(0);
  const [countyId, setCountyId] = useState(0);
  const [departments, setDepartments] = useState<AppInstallationDepartment[]>([]);
  const [installationStatus, setInstallationStatus] = useState<
    "all" | AppInstallationStatus
  >("all");
  const [notInstalledReason, setReasonFilter] = useState<
    "all" | NotInstalledReason
  >("all");
  const [summary, setSummary] = useState<AppInstallationSummary>({
    total: 0,
    completed: 0,
    iphone: 0,
    installed: 0,
    notInstalled: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    kind?: "success" | "error" | "info";
    title: string;
    message?: string;
  } | null>(null);
  const [resetUser, setResetUser] = useState<AppInstallationUserRow | null>(null);
  const [resetResult, setResetResult] = useState<{
    username?: string;
    password?: string;
  } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [permissionUser, setPermissionUser] = useState<AppInstallationUserRow | null>(null);
  const [permissionGroups, setPermissionGroups] = useState<AppPermissionGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const counties =
    departments.find((department) => department.id === departmentId)?.counties ?? [];
  const filtersReady = departmentId > 0 && countyId > 0;

  const fetchPage = useCallback(
    async (p: number) => {
      if (!departmentId || !countyId) {
        setUsers([]);
        setSummary({
          total: 0,
          completed: 0,
          iphone: 0,
          installed: 0,
          notInstalled: 0,
        });
        setPage(1);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      const id = ++requestId.current;
      setLoading(true);
      try {
        const result = await TipApi.fetchAppInstallationUsers({
          departmentId,
          countyId,
          searchQuery,
          installationStatus,
          notInstalledReason,
          page: p,
        });
        if (id !== requestId.current) return;
        setUsers(result.users);
        setSummary(result.summary);
        setPage(result.currentPage);
        setTotalPages(result.totalPages);
      } catch {
        if (id !== requestId.current) return;
        setUsers([]);
        setToast({ kind: "error", title: so.errorGeneric });
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [departmentId, countyId, searchQuery, installationStatus, notInstalledReason],
  );

  useEffect(() => {
    TipApi.fetchAppInstallationDepartments().then(setDepartments).catch(() => {
      setToast({ kind: "error", title: so.errorGeneric });
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchPage]);

  async function toggleStatus(user: AppInstallationUserRow) {
    const next = !user.isActive;
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: next } : u)));
    try {
      await TipApi.updateUserStatus(user.id, next);
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: user.isActive } : u)));
      setToast({ kind: "error", title: so.maareyntaStatusFailed });
    }
  }

  async function setChecklistStatus(
    user: AppInstallationUserRow,
    nextStatus: AppInstallationStatus,
  ) {
    if (savingIds.has(user.id)) return;
    if (user.installationStatus === nextStatus) return;
    const oldStatus = user.installationStatus;
    const nextMeta = INSTALLATION_META[nextStatus];
    setSavingIds((prev) => new Set(prev).add(user.id));
    setUsers((prev) =>
      prev.map((row) =>
        row.id === user.id
          ? {
              ...row,
              appInstalled: nextStatus === "completed",
              installationStatus: nextStatus,
              installationLabel: nextMeta.label,
              notInstalledReason: "",
              notInstalledReasonLabel: "",
              notInstalledReasonDetail: "",
            }
          : row,
      ),
    );
    setSummary((prev) => ({
      ...prev,
      completed:
        prev.completed -
        (oldStatus === "completed" ? 1 : 0) +
        (nextStatus === "completed" ? 1 : 0),
      installed:
        prev.installed -
        (oldStatus === "completed" ? 1 : 0) +
        (nextStatus === "completed" ? 1 : 0),
      iphone:
        prev.iphone -
        (oldStatus === "iphone" ? 1 : 0) +
        (nextStatus === "iphone" ? 1 : 0),
      notInstalled:
        prev.notInstalled -
        (oldStatus === "not_installed" ? 1 : 0) +
        (nextStatus === "not_installed" ? 1 : 0),
    }));
    try {
      await TipApi.updateAppInstallation(user.id, nextStatus);
      await fetchPage(page);
    } catch {
      setUsers((prev) => prev.map((row) => (row.id === user.id ? user : row)));
      await fetchPage(page);
      setToast({ kind: "error", title: "Xaaladda lama kaydin." });
    } finally {
      setSavingIds((prev) => {
        const nextIds = new Set(prev);
        nextIds.delete(user.id);
        return nextIds;
      });
    }
  }

  async function setNotInstalledReason(
    user: AppInstallationUserRow,
    reason: NotInstalledReason | "",
    detail = "",
  ) {
    if (savingIds.has(user.id)) return;
    setSavingIds((prev) => new Set(prev).add(user.id));
    const label = NOT_INSTALLED_REASONS.find((item) => item.value === reason)?.label ?? "";
    setUsers((prev) =>
      prev.map((row) =>
        row.id === user.id
          ? {
              ...row,
              notInstalledReason: reason,
              notInstalledReasonLabel: label,
              notInstalledReasonDetail: reason === "other" ? detail : "",
            }
          : row,
      ),
    );
    try {
      await TipApi.updateAppInstallation(user.id, "not_installed", reason, detail);
      await fetchPage(page);
    } catch {
      setUsers((prev) => prev.map((row) => (row.id === user.id ? user : row)));
      setToast({ kind: "error", title: "Sababta lama kaydin." });
    } finally {
      setSavingIds((prev) => {
        const nextIds = new Set(prev);
        nextIds.delete(user.id);
        return nextIds;
      });
    }
  }

  async function confirmReset() {
    if (!resetUser) return;
    setResetBusy(true);
    try {
      const res = await TipApi.resetUserPassword(resetUser.id);
      setResetResult(res);
      setToast({ kind: "success", title: so.maareyntaResetSuccess });
    } catch {
      setToast({ kind: "error", title: so.maareyntaResetFailed });
    } finally {
      setResetBusy(false);
    }
  }

  async function openPermissions(user: AppInstallationUserRow) {
    setPermissionUser(user);
    setSelectedGroupIds(user.groups.map((group) => group.id));
    if (permissionGroups.length) return;
    setPermissionBusy(true);
    try {
      setPermissionGroups(await TipApi.fetchPermissionGroups());
    } catch {
      setPermissionUser(null);
      setToast({ kind: "error", title: "Permissions-ka lama soo qaadi karin." });
    } finally {
      setPermissionBusy(false);
    }
  }

  async function savePermissions() {
    if (!permissionUser) return;
    setPermissionBusy(true);
    try {
      await TipApi.assignPermissionGroups(permissionUser.id, selectedGroupIds);
      const assigned = permissionGroups
        .filter((group) => selectedGroupIds.includes(group.id))
        .map(({ id, name }) => ({ id, name }));
      setUsers((current) =>
        current.map((user) =>
          user.id === permissionUser.id ? { ...user, groups: assigned } : user,
        ),
      );
      setPermissionUser(null);
      setToast({ kind: "success", title: "Permissions-ka waa la kaydiyey." });
    } catch {
      setToast({ kind: "error", title: "Permissions-ka lama kaydin." });
    } finally {
      setPermissionBusy(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setToast({ kind: "success", title: "Waa la koobiyey" });
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {toast ? <TipToast {...toast} onClose={() => setToast(null)} /> : null}
      <ScreenAppBar title={so.maareyntaUserMgmt} onBack={onBack} onMenu={onMenu} />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-8 pt-2">
        {/* Stats */}
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {[
            { label: "Agents", value: summary.total, color: colors.gold },
            { label: "Loogu shubay", value: summary.completed, color: GREEN },
            { label: "iPhone", value: summary.iphone, color: IPHONE },
            { label: "Looguma shubin", value: summary.notInstalled, color: VIOLET },
          ].map((s) => (
            <div
              key={s.label}
              className="min-w-0 rounded-xl border px-2 py-2"
              style={{
                background: rgba(colors.surfRgb, 0.6),
                borderColor: rgba(colors.lineRgb, 0.1),
              }}
            >
              <p className="truncate text-[9px]" style={{ color: colors.inkMut }}>
                {s.label}
              </p>
              <p className="text-lg font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div
          className="mb-2.5 flex h-12 items-center gap-2 rounded-2xl border px-3"
          style={{
            background: rgba(colors.lineRgb, 0.04),
            borderColor: rgba(colors.lineRgb, 0.1),
          }}
        >
          <Search size={16} style={{ color: colors.gold }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Magac, phone ama 4-ta lambar ee EMP…"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: colors.ink0 }}
          />
        </div>

        {/* Compact Qeyb → Degmo filters */}
        <div
          className="mb-2.5 grid grid-cols-2 gap-2 rounded-xl border p-2"
          style={{
            background: `rgba(${VIOLET_RGB}, 0.1)`,
            borderColor: `rgba(${VIOLET_RGB}, 0.28)`,
          }}
        >
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(Number(e.target.value));
              setCountyId(0);
            }}
            className="min-w-0 rounded-lg border bg-transparent px-2 py-2 text-xs outline-none"
            style={{ color: colors.ink0, borderColor: rgba(colors.lineRgb, 0.12) }}
          >
            <option value={0}>Dooro Qeyb</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={countyId}
            disabled={!departmentId}
            onChange={(e) => {
              setCountyId(Number(e.target.value));
            }}
            className="min-w-0 rounded-lg border bg-transparent px-2 py-2 text-xs outline-none disabled:opacity-45"
            style={{ color: colors.ink0, borderColor: rgba(colors.lineRgb, 0.12) }}
          >
            <option value={0}>Dooro Degmo</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-1">
          {[
            { key: "all" as const, label: "Dhammaan" },
            { key: "completed" as const, label: "Loogu shubay" },
            { key: "iphone" as const, label: "iPhone" },
            { key: "not_installed" as const, label: "Looguma shubin" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setInstallationStatus(item.key);
                if (item.key !== "not_installed") setReasonFilter("all");
              }}
              className="truncate rounded-lg border px-1.5 py-1.5 text-[10px] font-bold"
              style={{
                color: installationStatus === item.key ? "#fff" : colors.inkMut,
                background: installationStatus === item.key ? VIOLET : "transparent",
                borderColor:
                  installationStatus === item.key
                    ? VIOLET
                    : rgba(colors.lineRgb, 0.1),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {installationStatus === "not_installed" ? (
          <select
            value={notInstalledReason}
            onChange={(event) =>
              setReasonFilter(event.target.value as "all" | NotInstalledReason)
            }
            className="mb-3 w-full rounded-xl border bg-transparent px-3 py-2 text-xs outline-none"
            style={{ color: colors.ink0, borderColor: rgba(colors.lineRgb, 0.14) }}
          >
            <option value="all">Dhammaan sababaha</option>
            {NOT_INSTALLED_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        ) : null}

        {/* Table head */}
        <div
          className="mb-2 grid grid-cols-[40px_1fr_72px_70px] gap-1 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: `rgba(${VIOLET_RGB}, 0.18)`, color: VIOLET }}
        >
          <span>App</span>
          <span>Magac</span>
          <span>L.login</span>
          <span className="text-right">Ficil</span>
        </div>

        {!filtersReady ? (
          <p className="py-12 text-center text-sm" style={{ color: colors.inkMut }}>
            Dooro Qeyb iyo Degmo si agents-ku u soo baxaan.
          </p>
        ) : loading ? (
          <ListRowShimmer count={8} />
        ) : users.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: colors.inkMut }}>
            {so.maareyntaNoUsers}
          </p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const statusMeta = INSTALLATION_META[u.installationStatus];
              const selected = u.installationStatus !== "not_installed";
              return (
                <div
                  key={u.id}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    background: selected
                      ? `linear-gradient(135deg, ${rgba(colors.goldRgb, 0.08)}, ${statusMeta.color}18)`
                      : rgba(colors.surfRgb, 0.7),
                    borderColor: selected
                      ? `${statusMeta.color}66`
                      : rgba(colors.lineRgb, 0.1),
                  }}
                >
                  <div className="flex items-center gap-2.5 px-3 pt-3">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border disabled:opacity-45"
                      style={{
                        borderColor: selected ? statusMeta.color : rgba(colors.lineRgb, 0.2),
                        background: selected ? statusMeta.color : "transparent",
                        color: "#fff",
                      }}
                      aria-label={u.installationLabel}
                    >
                      {u.installationStatus === "completed" ? (
                        <Check size={12} />
                      ) : u.installationStatus === "iphone" ? (
                        <span className="text-[9px] font-black">iP</span>
                      ) : null}
                    </div>
                    <div
                      className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-sm font-bold"
                      style={{ background: `rgba(${VIOLET_RGB}, 0.15)`, color: VIOLET }}
                    >
                      {u.username.slice(0, 1).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.username || "—"}</p>
                      <p className="truncate text-[11px]" style={{ color: colors.inkMut }}>
                        {[u.employeeNumber ? `#${u.employeeNumber}` : "", u.phone, u.county]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="truncate text-[10px]" style={{ color: "#16A34A" }}>
                        {u.groups.length
                          ? u.groups.map((group) => group.name).join(", ")
                          : "Permission lama assign-gareyn"}
                      </p>
                    </div>
                    <select
                      value={u.installationStatus}
                      disabled={savingIds.has(u.id)}
                      onChange={(event) =>
                        void setChecklistStatus(
                          u,
                          event.target.value as AppInstallationStatus,
                        )
                      }
                      className="max-w-[112px] shrink-0 rounded-full border-0 px-2 py-1 text-[9px] font-bold outline-none disabled:opacity-50"
                      style={{
                        background: `${statusMeta.color}22`,
                        color: statusMeta.color,
                      }}
                    >
                      <option value="not_installed">Looguma shubin</option>
                      <option value="completed">Loogu shubay</option>
                      <option value="iphone">iPhone</option>
                    </select>
                  </div>
                  {u.installationStatus === "not_installed" ? (
                    <div
                      className="mx-3 mt-2 rounded-xl border p-2"
                      style={{
                        background: `rgba(${VIOLET_RGB}, 0.07)`,
                        borderColor: `rgba(${VIOLET_RGB}, 0.2)`,
                      }}
                    >
                      <select
                        value={u.notInstalledReason}
                        disabled={savingIds.has(u.id)}
                        onChange={(event) =>
                          void setNotInstalledReason(
                            u,
                            event.target.value as NotInstalledReason | "",
                          )
                        }
                        className="w-full bg-transparent text-[11px] font-semibold outline-none disabled:opacity-50"
                        style={{ color: VIOLET }}
                        aria-label="Sababta loogu shubin"
                      >
                        <option value="">Dooro sababta loogu shubin</option>
                        {NOT_INSTALLED_REASONS.map((reason) => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                      {u.notInstalledReason === "other" ? (
                        <input
                          value={u.notInstalledReasonDetail}
                          disabled={savingIds.has(u.id)}
                          maxLength={255}
                          placeholder="Qor sababta kale…"
                          onChange={(event) => {
                            const detail = event.target.value;
                            setUsers((prev) =>
                              prev.map((row) =>
                                row.id === u.id
                                  ? { ...row, notInstalledReasonDetail: detail }
                                  : row,
                              ),
                            );
                          }}
                          onBlur={(event) =>
                            void setNotInstalledReason(u, "other", event.target.value.trim())
                          }
                          className="mt-2 w-full rounded-lg border bg-transparent px-2 py-1.5 text-[11px] outline-none"
                          style={{
                            color: colors.ink0,
                            borderColor: rgba(colors.lineRgb, 0.14),
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2 border-t px-3 py-2.5 pl-[94px]" style={{ borderColor: rgba(colors.lineRgb, 0.08) }}>
                    <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: VIOLET }}>
                      {u.lastlogin || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void openPermissions(u)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: "rgba(22,163,74,0.14)", color: "#16A34A" }}
                      aria-label="Assign permissions"
                    >
                      <ShieldCheck size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetUser(u);
                        setResetResult(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: "rgba(224,122,95,0.15)", color: "#E07A5F" }}
                      aria-label="Reset password"
                    >
                      <AlertTriangle size={14} />
                    </button>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: u.isActive ? "rgba(40,150,111,0.15)" : rgba(colors.roseRgb, 0.12),
                        color: u.isActive ? GREEN : colors.rose,
                      }}
                    >
                      {u.isActive ? so.maareyntaActive : so.maareyntaInactive}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.isActive}
                      onClick={() => toggleStatus(u)}
                      className="relative h-6 w-10 shrink-0 rounded-full"
                      style={{ background: u.isActive ? VIOLET : rgba(colors.lineRgb, 0.2) }}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${u.isActive ? "left-[18px]" : "left-0.5"}`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => fetchPage(page - 1)}
              className="disabled:opacity-40"
              style={{ color: VIOLET }}
            >
              ‹
            </button>
            <span className="text-sm font-bold" style={{ color: VIOLET }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => fetchPage(page + 1)}
              className="disabled:opacity-40"
              style={{ color: VIOLET }}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {/* Assign permission groups — same group model as the Amniga App Users page. */}
      {permissionUser ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 sm:items-center">
          <div
            className="w-full max-w-md overflow-hidden rounded-[22px] border shadow-2xl"
            style={{
              background: colors.bg1,
              borderColor: rgba(colors.lineRgb, 0.12),
            }}
          >
            <div className="px-5 pb-3 pt-5" style={{ background: "rgba(22,163,74,0.1)" }}>
              <p className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck size={18} style={{ color: "#16A34A" }} />
                Assign permission
              </p>
              <p className="mt-1 truncate text-sm" style={{ color: colors.inkMut }}>
                {permissionUser.username}
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="max-h-[46vh] space-y-2 overflow-y-auto">
                {permissionBusy && permissionGroups.length === 0 ? (
                  <ListRowShimmer count={4} />
                ) : permissionGroups.length === 0 ? (
                  <p className="py-6 text-center text-sm" style={{ color: colors.inkMut }}>
                    Permission groups lama helin.
                  </p>
                ) : (
                  permissionGroups.map((group) => {
                    const checked = selectedGroupIds.includes(group.id);
                    return (
                      <label
                        key={group.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5"
                        style={{
                          borderColor: checked
                            ? "rgba(22,163,74,0.4)"
                            : rgba(colors.lineRgb, 0.1),
                          background: checked
                            ? "rgba(22,163,74,0.09)"
                            : rgba(colors.surfRgb, 0.45),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedGroupIds((current) =>
                              checked
                                ? current.filter((id) => id !== group.id)
                                : [...current, group.id],
                            )
                          }
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 flex-1 text-sm font-semibold">
                          {group.name}
                        </span>
                        {group.permissionCount ? (
                          <span className="text-[10px]" style={{ color: colors.inkMut }}>
                            {group.permissionCount}
                          </span>
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
              <div className="mt-4 space-y-2">
                <GoldButton
                  loading={permissionBusy}
                  disabled={permissionGroups.length === 0}
                  onClick={savePermissions}
                >
                  Kaydi permissions
                </GoldButton>
                <button
                  type="button"
                  onClick={() => setPermissionUser(null)}
                  className="w-full py-2 text-sm"
                  style={{ color: colors.inkMut }}
                >
                  {so.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reset password dialog */}
      {resetUser ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 sm:items-center">
          <div
            className="w-full max-w-md overflow-hidden rounded-[22px] border shadow-2xl"
            style={{
              background: colors.bg1,
              borderColor: rgba(colors.lineRgb, 0.12),
            }}
          >
            <div
              className="px-5 pb-3 pt-5"
              style={{
                background: resetResult
                  ? "rgba(40,150,111,0.12)"
                  : "rgba(224,122,95,0.12)",
              }}
            >
              <p className="text-base font-bold">
                {resetResult ? so.maareyntaResetSuccess : so.maareyntaResetPassword}
              </p>
              <p className="mt-1 text-sm" style={{ color: colors.inkMut }}>
                {resetResult
                  ? so.maareyntaResetSuccessMsg
                  : `${so.maareyntaResetPasswordMsg} — ${resetUser.username}`}
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {(() => {
                const previewUser =
                  resetUser.email?.trim() ||
                  resetUser.loginUsername?.trim() ||
                  resetUser.username;
                const rawPhone = (resetUser.phone || "").trim();
                const previewPassword = rawPhone.startsWith("0")
                  ? rawPhone.slice(1)
                  : rawPhone;
                const shownUser = resetResult?.username || previewUser;
                const shownPassword = resetResult?.password || previewPassword;
                return (
                  <>
              {[
                {
                  label: "User",
                  value: shownUser,
                },
                {
                  label: "Password",
                  value: shownPassword,
                },
              ].map((field) => (
                <div
                  key={field.label}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                  style={{ borderColor: rgba(colors.lineRgb, 0.1) }}
                >
                  <div>
                    <p className="text-[10px] uppercase" style={{ color: colors.ink3 }}>
                      {field.label}
                    </p>
                    <p className="text-sm font-semibold break-all">{field.value || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(field.value)}
                    style={{ color: VIOLET }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  copyText(`User: ${shownUser}\nPassword: ${shownPassword}`)
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold"
                style={{ borderColor: `rgba(${VIOLET_RGB}, 0.3)`, color: VIOLET }}
              >
                <Copy size={14} /> {so.maareyntaCopyAll}
              </button>
              {resetResult ? (
                <GoldButton
                  onClick={() => {
                    setResetUser(null);
                    setResetResult(null);
                  }}
                >
                  {so.maareyntaDone}
                </GoldButton>
              ) : (
                <>
                  <GoldButton loading={resetBusy} onClick={confirmReset}>
                    {so.maareyntaConfirm}
                  </GoldButton>
                  <button
                    type="button"
                    onClick={() => setResetUser(null)}
                    className="w-full py-2 text-sm"
                    style={{ color: colors.inkMut }}
                  >
                    {so.cancel}
                  </button>
                </>
              )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
