"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { PrimaryButton, type AccountsThemeColors } from "./accounts-shared";
import api from "@/lib/axios";
import { toast } from "@/components/ui/use-toast";

type ThemeColors = AccountsThemeColors;

type AppRelease = {
  min_version_code: number;
  latest_version_code: number;
  min_major: number;
  min_minor: number;
  min_patch: number;
  latest_major: number;
  latest_minor: number;
  latest_patch: number;
  apk_url: string;
  message: string;
};

type SavedRelease = {
  id: number;
  version_code: number;
  version_major: number;
  version_minor: number;
  version_patch: number;
  min_version_code: number;
  apk_url: string;
  message: string;
  created_at: string;
};

function splitCode(code: number): [number, number, number] {
  const value = Math.max(0, Math.floor(Number(code) || 0));
  if (value >= 10000) {
    const major = Math.floor(value / 10000);
    const rest = value % 10000;
    return [major, Math.floor(rest / 100), rest % 100];
  }
  if (value >= 100) return [Math.floor(value / 100), value % 100, 0];
  return [value, 0, 0];
}

function composeCode(major: number, minor: number, patch: number): number {
  const majorN = Math.max(0, Math.floor(Number(major) || 0));
  const minorN = Math.min(99, Math.max(0, Math.floor(Number(minor) || 0)));
  const patchN = Math.min(99, Math.max(0, Math.floor(Number(patch) || 0)));
  if (minorN === 0 && patchN === 0 && majorN < 100) return majorN;
  return majorN * 10000 + minorN * 100 + patchN;
}

function versionName(major: number, minor: number, patch: number): string {
  const part = (value: number) => Math.max(0, Math.floor(Number(value) || 0));
  return `${part(major)}.${part(minor)}.${part(patch)}`;
}

export function AmnigaAppReleasePage({
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
  const [form, setForm] = useState<AppRelease | null>(null);
  const [releases, setReleases] = useState<SavedRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [versionsReady, setVersionsReady] = useState({ min: true, latest: true });
  const formRef = useRef<AppRelease | null>(null);
  const replaceForm = (next: AppRelease) => {
    formRef.current = next;
    setForm(next);
  };

  const applyRelease = (data: Partial<AppRelease>): AppRelease => {
    const minCode = Number(data.min_version_code) || 0;
    const latestCode = Number(data.latest_version_code) || 0;
    const [splitMinMajor, splitMinMinor, splitMinPatch] = splitCode(minCode);
    const [splitLatestMajor, splitLatestMinor, splitLatestPatch] = splitCode(latestCode);
    return {
      min_version_code: minCode,
      latest_version_code: latestCode,
      min_major: data.min_major == null ? splitMinMajor : Number(data.min_major) || 0,
      min_minor: data.min_minor == null ? splitMinMinor : Number(data.min_minor) || 0,
      min_patch: data.min_patch == null ? splitMinPatch : Number(data.min_patch) || 0,
      latest_major: data.latest_major == null ? splitLatestMajor : Number(data.latest_major) || 0,
      latest_minor: data.latest_minor == null ? splitLatestMinor : Number(data.latest_minor) || 0,
      latest_patch: data.latest_patch == null ? splitLatestPatch : Number(data.latest_patch) || 0,
      apk_url: data.apk_url || "",
      message: data.message || "",
    };
  };

  const loadReleases = () =>
    api.get<{ releases: SavedRelease[]; current?: Partial<AppRelease> }>("/app-releases")
      .then(({ data }) => {
        setReleases(Array.isArray(data.releases) ? data.releases : []);
        if (data.current) {
          setForm((prev) => {
            const next = applyRelease({ ...prev, ...data.current });
            formRef.current = next;
            return next;
          });
        }
      })
      .catch(() => setReleases([]));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<AppRelease>("/app-version")
      .then(({ data }) => {
        if (cancelled) return;
        replaceForm(applyRelease(data));
        setLoadError("");
      })
      .catch(() => {
        if (!cancelled) setLoadError(t.appReleaseFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    loadReleases();
    return () => {
      cancelled = true;
    };
  }, [t.appReleaseFailed]);

  const save = async () => {
    const current = formRef.current;
    if (!current) return;
    setSaving(true);
    try {
      const { data } = await api.patch<AppRelease>("/app-version", {
        min_major: Number(current.min_major),
        min_minor: Number(current.min_minor),
        min_patch: Number(current.min_patch),
        latest_major: Number(current.latest_major),
        latest_minor: Number(current.latest_minor),
        latest_patch: Number(current.latest_patch),
        apk_url: current.apk_url.trim(),
        message: current.message.trim(),
      });
      replaceForm(applyRelease(data));
      toast({ title: t.appReleaseSaved });
      await loadReleases();
    } catch {
      toast({ title: t.appReleaseFailed, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${C.cardBdr}`,
    background: isDark ? "rgba(255,255,255,0.03)" : "#fff",
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    fontSize: 14,
  };

  return (
    <div style={{ paddingBottom: 48, marginTop: 18 }}>
      <div style={{
        maxWidth: 640,
        borderRadius: 14,
        background: C.panelBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.panelShadow,
        padding: 20,
      }}>
        {loading ? (
          <p style={{ margin: 0, color: C.txtMuted }}>…</p>
        ) : loadError || !form ? (
          <p style={{ margin: 0, color: C.txtMuted }}>{loadError || t.appReleaseFailed}</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            <VersionField
              label={t.appReleaseMin}
              codeLabel={t.appReleasePhoneCode}
              major={form.min_major}
              minor={form.min_minor}
              patch={form.min_patch}
              code={composeCode(form.min_major, form.min_minor, form.min_patch)}
              onChange={(major, minor, patch) => {
                const prev = formRef.current;
                if (!prev) return;
                replaceForm({ ...prev, min_major: major, min_minor: minor, min_patch: patch });
              }}
              onReady={(ready) => setVersionsReady((prev) => ({ ...prev, min: ready }))}
              fieldStyle={fieldStyle}
              C={C}
            />
            <VersionField
              label={t.appReleaseLatest}
              codeLabel={t.appReleasePhoneCode}
              major={form.latest_major}
              minor={form.latest_minor}
              patch={form.latest_patch}
              code={composeCode(form.latest_major, form.latest_minor, form.latest_patch)}
              onChange={(major, minor, patch) => {
                const prev = formRef.current;
                if (!prev) return;
                replaceForm({ ...prev, latest_major: major, latest_minor: minor, latest_patch: patch });
              }}
              onReady={(ready) => setVersionsReady((prev) => ({ ...prev, latest: ready }))}
              fieldStyle={fieldStyle}
              C={C}
            />
            <label style={{ fontSize: 13, color: C.txtSecondary, fontWeight: 600 }}>
              {t.appReleaseUrl}
              <input
                type="url"
                value={form.apk_url}
                onChange={(e) => {
                  const prev = formRef.current;
                  if (!prev) return;
                  replaceForm({ ...prev, apk_url: e.target.value });
                }}
                style={fieldStyle}
              />
            </label>
            <label style={{ fontSize: 13, color: C.txtSecondary, fontWeight: 600 }}>
              {t.appReleaseMessage}
              <input
                type="text"
                maxLength={255}
                value={form.message}
                onChange={(e) => {
                  const prev = formRef.current;
                  if (!prev) return;
                  replaceForm({ ...prev, message: e.target.value });
                }}
                style={fieldStyle}
              />
            </label>
            <p style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 10,
              background: hexA(accent, 0.12),
              color: C.txtSecondary,
              fontSize: 13,
              lineHeight: 1.5,
            }}>
              {t.appReleaseHint}
            </p>
            <div>
              <PrimaryButton accent={accent} onClick={save} disabled={saving || !versionsReady.min || !versionsReady.latest}>
                {saving ? t.appReleaseSaving : t.appReleaseSave}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
      {form && !loading ? (
        <VersionHistory
          form={form}
          releases={releases}
          C={C}
          accent={accent}
          isDark={isDark}
          onDeleted={loadReleases}
        />
      ) : null}
    </div>
  );
}

function readVersion(text: string): [number, number, number] | null {
  const match = text.trim().match(/^(\d{1,4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (minor > 99 || patch > 99) return null;
  return [Number(match[1]), minor, patch];
}

function finishVersion(text: string): string | null {
  const parts = text.trim().split(".");
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const parsed = readVersion(`${Number(parts[0])}.${Number(parts[1] ?? 0)}.${Number(parts[2] ?? 0)}`);
  return parsed ? versionName(parsed[0], parsed[1], parsed[2]) : null;
}

function VersionField({
  label,
  codeLabel,
  major,
  minor,
  patch,
  code,
  onChange,
  onReady,
  fieldStyle,
  C,
}: {
  label: string;
  codeLabel: string;
  major: number;
  minor: number;
  patch: number;
  code: number;
  onChange: (major: number, minor: number, patch: number) => void;
  onReady: (ready: boolean) => void;
  fieldStyle: CSSProperties;
  C: ThemeColors;
}) {
  const canonical = versionName(major, minor, patch);
  const [text, setText] = useState(canonical);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(canonical);
  }, [canonical]);

  const commit = (next: string) => {
    const parsed = readVersion(next);
    if (!parsed) {
      onReady(false);
      return;
    }
    const [nextMajor, nextMinor, nextPatch] = parsed;
    if (nextMajor !== major || nextMinor !== minor || nextPatch !== patch) {
      onChange(nextMajor, nextMinor, nextPatch);
    }
    onReady(true);
  };

  return (
    <label style={{ fontSize: 13, color: C.txtSecondary, fontWeight: 600 }}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        placeholder="3.0.0"
        value={text}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => {
          focused.current = false;
          const finished = finishVersion(text);
          if (!finished) {
            setText(canonical);
            onReady(true);
            return;
          }
          setText(finished);
          commit(finished);
        }}
        style={fieldStyle}
      />
      <span style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 500, color: C.txtMuted }}>
        {codeLabel} {code}
      </span>
    </label>
  );
}

function VersionHistory({
  form,
  releases,
  C,
  accent,
  isDark,
  onDeleted,
}: {
  form: AppRelease;
  releases: SavedRelease[];
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  onDeleted: () => Promise<void> | void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const minimum = composeCode(form.min_major, form.min_minor, form.min_patch);
  const latestCode = composeCode(form.latest_major, form.latest_minor, form.latest_patch);
  const rows: Array<{
    key: string;
    name: string;
    code: number;
    apk_url: string;
    message: string;
    created_at: string;
    current: boolean;
    releaseId: number | null;
  }> = [];
  const seen = new Set<number>();
  const push = (row: (typeof rows)[number]) => {
    if (seen.has(row.code)) return;
    seen.add(row.code);
    rows.push(row);
  };
  push({
    key: "current",
    name: versionName(form.latest_major, form.latest_minor, form.latest_patch),
    code: latestCode,
    apk_url: form.apk_url,
    message: form.message,
    created_at: releases.find((row) => row.version_code === form.latest_version_code)?.created_at || "",
    current: true,
    releaseId: null,
  });
  for (const saved of releases) {
    push({
      key: `saved-${saved.id}`,
      name: versionName(
        saved.version_major ?? splitCode(saved.version_code)[0],
        saved.version_minor ?? splitCode(saved.version_code)[1],
        saved.version_patch ?? splitCode(saved.version_code)[2],
      ),
      code: saved.version_code,
      apk_url: saved.apk_url,
      message: saved.message,
      created_at: saved.created_at,
      current: false,
      releaseId: saved.id,
    });
  }
  const oldestMajor = Math.max(form.latest_major, form.min_major, 1);
  for (let major = Math.min(oldestMajor, 99) - 1; major >= 1; major -= 1) {
    push({
      key: `older-${major}`,
      name: versionName(major, 0, 0),
      code: major,
      apk_url: "",
      message: "",
      created_at: "",
      current: false,
      releaseId: null,
    });
  }
  rows.sort((a, b) => b.code - a.code || (a.current ? -1 : 1));

  const cell = {
    padding: "12px 14px",
    borderBottom: `1px solid ${C.tableSep}`,
    fontSize: 13,
    color: C.txtPrimary,
    verticalAlign: "top" as const,
  };

  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{
        margin: "0 0 12px",
        fontFamily: "var(--font-outfit)",
        fontWeight: 650,
        fontSize: 16,
        color: C.txtPrimary,
      }}>
        {t.appReleaseHistory}
      </h2>
      <div style={{
        overflowX: "auto",
        borderRadius: 14,
        background: C.panelBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.panelShadow,
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : C.tableHead }}>
              {[t.appReleaseLatest, t.appReleaseStatus, t.appReleaseUrl, t.appReleaseMessage, t.appReleaseWhen, ""].map((label) => (
                <th key={label || "delete"} style={{ ...cell, textAlign: "left", color: C.txtMuted, fontWeight: 650, fontSize: 12 }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const allowed = row.code >= minimum;
              const status = row.current ? t.appReleaseCurrent : allowed ? t.appReleaseAllowed : t.appReleaseBlocked;
              const when = row.created_at
                ? new Date(row.created_at).toLocaleString(lang === "so" ? "so" : "en")
                : "—";
              return (
                <tr key={row.key}>
                  <td style={{ ...cell, fontWeight: 700 }}>{row.name}</td>
                  <td style={cell}>
                    <span style={{
                      display: "inline-block",
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: allowed ? hexA(accent, 0.16) : "rgba(224,101,90,0.12)",
                      color: allowed ? accent : "#c4504a",
                      fontWeight: 650,
                      fontSize: 12,
                    }}>
                      {status}
                    </span>
                  </td>
                  <td style={{ ...cell, wordBreak: "break-all" }}>{row.apk_url || t.appReleaseNoFile}</td>
                  <td style={cell}>{row.message || "—"}</td>
                  <td style={{ ...cell, whiteSpace: "nowrap", color: C.txtMuted }}>{when}</td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>
                    {row.releaseId && !row.current ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(t.appReleaseDeleteConfirm)) return;
                          try {
                            await api.delete(`/app-releases/${row.releaseId}`);
                            toast({ title: t.appReleaseDeleted });
                            await onDeleted();
                          } catch {
                            toast({ title: t.appReleaseFailed, variant: "destructive" });
                          }
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(224,101,90,0.35)",
                          background: "rgba(224,101,90,0.08)",
                          color: "#c4504a",
                          fontWeight: 650,
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "var(--font-outfit)",
                        }}
                      >
                        {t.appReleaseDelete}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
