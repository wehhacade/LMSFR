"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import type { AmnigaTrackUser } from "@/types/amniga";

type PickerTheme = {
  accent: string;
  isDark: boolean;
  txtPrimary: string;
  txtMuted: string;
  txtSecondary: string;
  inputBg: string;
  inputBdr: string;
  cardBdr: string;
  panelBg: string;
  panelShadow: string;
};

function agentInitials(name: string) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function agentStatusMeta(
  user: Pick<AmnigaTrackUser, "on_duty" | "in_field" | "has_gps" | "has_track" | "track_count">,
  labels: { inField: string; onDuty: string; offDuty: string; lastKnown: string; noGps: string },
) {
  if (user.in_field) {
    return { color: "#22c55e", label: labels.inField, tone: "field" as const };
  }
  if (user.on_duty) {
    return { color: "#e6b25c", label: labels.onDuty, tone: "duty" as const };
  }
  if (user.has_gps || user.has_track) {
    return { color: "#64748b", label: labels.offDuty, tone: "off" as const };
  }
  return { color: "#94a3b8", label: labels.noGps, tone: "none" as const };
}

function AgentAvatar({
  name,
  color,
  size = 36,
  selected,
}: {
  name: string;
  color: string;
  size?: number;
  selected?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 32 ? 11 : 10,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-cinzel)",
        fontWeight: 700,
        fontSize: size * 0.34,
        color: "#fff",
        background: `linear-gradient(135deg, ${color}, ${hexA(color, 0.55)})`,
        boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${hexA(color, 0.45)}` : `0 4px 12px -6px ${hexA(color, 0.55)}`,
      }}
    >
      {agentInitials(name)}
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".03em",
        textTransform: "uppercase",
        background: hexA(color, 0.14),
        color,
        border: `1px solid ${hexA(color, 0.28)}`,
        fontFamily: "var(--font-outfit)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function MetaChip({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 10.5,
        fontWeight: 600,
        background: hexA(accent, 0.1),
        color: accent,
        border: `1px solid ${hexA(accent, 0.2)}`,
        fontFamily: "var(--font-outfit)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function AmnigaAgentPicker({
  users,
  value,
  onChange,
  search,
  onSearchChange,
  theme,
  labels,
}: {
  users: AmnigaTrackUser[];
  value: string;
  onChange: (userCode: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  theme: PickerTheme;
  labels: {
    selectAll: string;
    selectUser: string;
    searchPh: string;
    inField: string;
    onDuty: string;
    offDuty: string;
    lastKnown: string;
    noGps: string;
    noResults: string;
    agentsCount: string;
    idLabel: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => users.find((u) => String(u.user_code) === String(value)),
    [users, value],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AmnigaTrackUser[]>();
    for (const user of users) {
      const county = (user.county_name || "—").trim() || "—";
      if (!map.has(county)) map.set(county, []);
      map.get(county)!.push(user);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const maxHeight = 420;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow);

    setPanelStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 360),
      zIndex: 5000,
      maxHeight: height,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, users.length]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => searchRef.current?.focus(), 40);
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (userCode: string) => {
    onChange(userCode);
    setOpen(false);
  };

  const selectedStatus = selected
    ? agentStatusMeta(selected, labels)
    : null;

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label={labels.selectUser}
      style={{
        ...panelStyle,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        background: theme.panelBg,
        border: `1px solid ${theme.isDark ? hexA(theme.accent, 0.22) : theme.cardBdr}`,
        boxShadow: theme.panelShadow,
        animation: "is-fadeUp .18s ease both",
      }}
    >
      <div style={{
        padding: "12px 12px 10px",
        borderBottom: `1px solid ${theme.isDark ? "rgba(255,255,255,0.06)" : hexA(theme.accent, 0.08)}`,
        background: theme.isDark ? hexA(theme.accent, 0.04) : hexA(theme.accent, 0.03),
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 14, color: theme.txtPrimary }}>
            {labels.selectUser}
          </div>
          <span style={{ fontSize: 11, color: theme.txtMuted, fontFamily: "var(--font-outfit)" }}>
            {users.length.toLocaleString()} {labels.agentsCount}
          </span>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          height: 36,
          borderRadius: 10,
          border: `1px solid ${theme.inputBdr}`,
          background: theme.inputBg,
        }}>
          <span style={{ display: "flex", color: theme.txtMuted }}><Icon name="search" size={15} sw={1.9} /></span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={labels.searchPh}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              width: "100%",
              color: theme.txtPrimary,
              fontFamily: "var(--font-outfit)",
              fontSize: 13,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear"
              style={{ border: "none", background: "transparent", color: theme.txtMuted, cursor: "pointer", display: "flex" }}
            >
              <Icon name="close" size={13} sw={2} />
            </button>
          )}
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: 8, flex: 1 }}>
        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => pick("")}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 11,
            border: `1px solid ${!value ? hexA(theme.accent, 0.35) : "transparent"}`,
            cursor: "pointer",
            background: !value ? hexA(theme.accent, theme.isDark ? 0.16 : 0.1) : "transparent",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: hexA(theme.accent, 0.14),
            color: theme.accent,
            border: `1px solid ${hexA(theme.accent, 0.25)}`,
          }}>
            <Icon name="map" size={17} sw={1.9} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 700, fontSize: 13.5, color: theme.txtPrimary }}>
              {labels.selectAll}
            </div>
            <div style={{ fontSize: 11.5, color: theme.txtMuted, marginTop: 2, fontFamily: "var(--font-outfit)" }}>
              {users.length.toLocaleString()} {labels.agentsCount}
            </div>
          </div>
        </button>

        {users.length === 0 ? (
          <div style={{ padding: "28px 12px", textAlign: "center", color: theme.txtMuted, fontSize: 13, fontFamily: "var(--font-outfit)" }}>
            {labels.noResults}
          </div>
        ) : grouped.map(([county, rows]) => (
          <div key={county} style={{ marginBottom: 10 }}>
            <div style={{
              padding: "6px 10px 8px",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: theme.txtMuted,
              fontFamily: "var(--font-outfit)",
            }}>
              {county}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rows.map((user) => {
                const active = String(user.user_code) === String(value);
                const status = agentStatusMeta(user, labels);
                const trackPts = user.track_count ?? 0;
                return (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(String(user.user_code))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 11,
                      border: `1px solid ${active ? hexA(theme.accent, 0.35) : "transparent"}`,
                      cursor: "pointer",
                      background: active ? hexA(theme.accent, theme.isDark ? 0.16 : 0.1) : "transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      transition: "background .15s, border-color .15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = theme.isDark ? "rgba(255,255,255,0.04)" : hexA(theme.accent, 0.05);
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <AgentAvatar name={user.name} color={status.color} selected={active} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontFamily: "var(--font-outfit)",
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: theme.txtPrimary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}>
                          {user.name}
                        </span>
                        <MetaChip label={`${labels.idLabel} ${user.id_last4 || user.user_code.slice(-4)}`} accent={theme.accent} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <StatusPill label={status.label} color={status.color} />
                        {trackPts > 0 ? (
                          <MetaChip label={`${trackPts.toLocaleString()} pts`} accent="#ef4444" />
                        ) : user.has_gps ? (
                          <MetaChip label={labels.lastKnown} accent="#2563eb" />
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          minHeight: 46,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderRadius: 12,
          border: `1px solid ${open ? hexA(theme.accent, 0.45) : theme.inputBdr}`,
          background: theme.inputBg,
          color: theme.txtPrimary,
          cursor: "pointer",
          fontFamily: "var(--font-outfit)",
          textAlign: "left",
          boxShadow: open ? `0 0 0 3px ${hexA(theme.accent, 0.1)}` : "none",
          transition: "border-color .2s, box-shadow .2s",
        }}
      >
        {!selected ? (
          <>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: hexA(theme.accent, 0.12),
              color: theme.accent,
              border: `1px solid ${hexA(theme.accent, 0.22)}`,
              flexShrink: 0,
            }}>
              <Icon name="map" size={16} sw={1.9} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: theme.txtPrimary }}>{labels.selectAll}</div>
              <div style={{ fontSize: 11.5, color: theme.txtMuted, marginTop: 2 }}>
                {users.length.toLocaleString()} {labels.agentsCount}
              </div>
            </div>
          </>
        ) : (
          <>
            <AgentAvatar name={selected.name} color={selectedStatus!.color} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontWeight: 700,
                fontSize: 13.5,
                color: theme.txtPrimary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {selected.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                {selected.county_name && (
                  <MetaChip label={selected.county_name} accent={theme.accent} />
                )}
                <StatusPill label={selectedStatus!.label} color={selectedStatus!.color} />
              </div>
            </div>
          </>
        )}
        <span style={{
          display: "flex",
          color: open ? theme.accent : theme.txtMuted,
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform .2s, color .2s",
          flexShrink: 0,
        }}>
          <Icon name="chevdown" size={15} sw={2} />
        </span>
      </button>
      {panel}
    </div>
  );
}
