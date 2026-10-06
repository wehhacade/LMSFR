"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { formatCaptureDateTime } from "@/lib/lmsbr/suspect-utils";
import { Icon } from "./icon";
import {
  useCreateVisitor,
  useDeleteVisitor,
  useUpdateVisitor,
  useVisitAllegations,
  useVisitDestinations,
  useVisitors,
  useVisitorsStats,
} from "@/hooks/use-visitors";
import { VISITORS_PAGE_SIZE } from "@/lib/visitors-api";
import { ShimmerKPI, ShimmerSuspectGrid, ShimmerSuspectList } from "./shimmer";
import {
  AccountModal,
  ConfirmDialog,
  RowActions,
  type AccountsThemeColors,
} from "./accounts-shared";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import { usePermissions } from "@/hooks/use-permissions";
import type { Visitor, VisitorWritePayload } from "@/types/visitors";
import { VisitorsProfilePage } from "./visitors-profile-page";

type ThemeColors = AccountsThemeColors & {
  cardBg: string;
  cardBdrHov: string;
  cardShadow: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  tableHead: string;
  tableHov: string;
  inputBg: string;
  inputBdr: string;
  txtMuted: string;
  txtSecondary: string;
  txtPrimary: string;
  btnBg: string;
  btnBdr: string;
};

type ViewMode = "grid" | "list";
const VIEW_STORAGE_KEY = "lmsbr-visitors-view";

function toLocalInputValue(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string) {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function relativeVisitTime(value: string | null | undefined, so: boolean, now: number): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return so ? "Hadda" : "Just now";
  if (minutes < 60) return so ? `${minutes} daqiiqo ka hor` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return so ? `${hours} saac ka hor` : `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return so ? `${days} maalin ka hor` : `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return so ? `${weeks} isbuuc ka hor` : `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return so ? `${months} bil ka hor` : `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return so ? `${years} sano ka hor` : `${years} year${years === 1 ? "" : "s"} ago`;
}

function ViewToggle({
  mode, setMode, C, accent, isDark, t,
}: {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  t: ReturnType<typeof getDict>;
}) {
  const btn = (m: ViewMode, label: string, icon: string) => {
    const on = mode === m;
    return (
      <button type="button" onClick={() => setMode(m)} title={label}
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
          border: "none", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 500, transition: ".2s",
          background: on ? (isDark ? hexA(accent, 0.22) : hexA(accent, 0.12)) : "transparent",
          color: on ? (isDark ? "#f3ead9" : accent) : C.txtMuted,
          boxShadow: on ? `inset 0 0 0 1px ${hexA(accent, 0.35)}` : "none",
        }}
      >
        <span style={{ display: "flex" }}><Icon name={icon} size={16} sw={1.9} /></span>
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", padding: 4, borderRadius: 11, background: C.inputBg, border: `1px solid ${C.inputBdr}` }}>
      {btn("grid", t.gridView, "grid")}
      {btn("list", t.listView, "list")}
    </div>
  );
}

function FilterSelect({
  value, onChange, options, placeholder, C, accent, isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${value ? hexA(accent, 0.45) : C.inputBdr}`,
        background: C.inputBg,
        color: value ? C.txtPrimary : C.txtSecondary,
        fontFamily: "var(--font-outfit)",
        fontSize: 14,
        minWidth: 170,
        cursor: "pointer",
        boxShadow: value && !isDark ? `0 0 0 3px ${hexA(accent, 0.08)}` : undefined,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function NameSearchInput({
  value, onChange, placeholder, C, accent, isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flex: "1 1 220px", minWidth: 220,
      padding: "9px 14px", borderRadius: 10, border: `1px solid ${value ? hexA(accent, 0.45) : C.inputBdr}`,
      background: C.inputBg, boxShadow: value && !isDark ? `0 0 0 3px ${hexA(accent, 0.08)}` : undefined,
    }}>
      <span style={{ display: "flex", color: value ? accent : C.txtMuted }}><Icon name="search" size={16} sw={1.9} /></span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: "none", outline: "none", background: "transparent", width: "100%",
          color: C.txtPrimary, fontFamily: "var(--font-outfit)", fontSize: 14,
        }}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          style={{ border: "none", background: "transparent", color: C.txtMuted, cursor: "pointer", display: "flex" }}>
          <Icon name="close" size={14} sw={2} />
        </button>
      )}
    </div>
  );
}

function VisitorPhoto({
  url, alt, accent, fallback,
}: {
  url?: string | null;
  alt: string;
  accent: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function VisitorGridCard({
  visitor, C, accent, isDark, so, now, onOpen, onEdit, onDelete, onPreview, canEditRow, canDeleteRow,
}: {
  visitor: Visitor;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  so: boolean;
  now: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: (e: React.MouseEvent) => void;
  canEditRow: boolean;
  canDeleteRow: boolean;
}) {
  const initials = visitor.full_name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  const captured = formatCaptureDateTime(visitor.visited_at);

  return (
    <article
      onClick={onOpen}
      style={{
        borderRadius: 18, overflow: "hidden", background: isDark ? hexA(accent, 0.05) : "#fff",
        border: `1px solid ${C.cardBdr}`,
        boxShadow: isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)",
        transition: "transform .22s ease, box-shadow .22s ease, border-color .22s ease",
        animation: "is-fadeUp .45s ease both",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLElement).style.borderColor = hexA(accent, 0.42);
        (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 40px -18px ${hexA(accent, 0.38)}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.borderColor = C.cardBdr;
        (e.currentTarget as HTMLElement).style.boxShadow = isDark ? "none" : "0 12px 32px -20px rgba(15,23,42,0.22)";
      }}
    >
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "5/6", overflow: "hidden", cursor: visitor.image_url ? "zoom-in" : "default", background: isDark ? "#1e293b" : "#f8fafc" }}
        onClick={visitor.image_url ? onPreview : undefined}
      >
        <VisitorPhoto
          url={visitor.image_url}
          alt={visitor.full_name}
          accent={accent}
          fallback={
            <div style={{
              width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              background: `linear-gradient(165deg, ${hexA(accent, 0.14)} 0%, ${hexA(accent, 0.05)} 100%)`,
            }}>
              <span style={{ fontFamily: "var(--font-cinzel)", fontSize: 36, fontWeight: 700, color: hexA(accent, 0.55) }}>{initials}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/emblem.png" alt="" style={{ width: 56, height: 56, opacity: 0.4, objectFit: "contain" }} />
            </div>
          }
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 42%, rgba(0,0,0,0.78) 100%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          {visitor.verified ? (
            <span
              title="Verified"
              aria-label="Verified"
              style={{
                width: 25, height: 25, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "#1877F2", color: "#fff", fontSize: 17, fontWeight: 800, lineHeight: 1,
                boxShadow: "0 3px 10px rgba(24,119,242,0.45)",
              }}
            >✓</span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
              background: hexA(accent, 0.92), color: "#fff", fontFamily: "var(--font-outfit)", letterSpacing: ".04em",
            }}>{so ? "Pending" : "Pending"}</span>
          )}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px", pointerEvents: "none" }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: "#fff", lineHeight: 1.3 }}>
            {visitor.full_name}
          </div>
          {(visitor.visiting || (visitor.visit_count ?? 0) > 1) && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, fontFamily: "var(--font-outfit)" }}>
              {visitor.visiting ? `${so ? "Booqanaya" : "Visiting"}: ${visitor.visiting}` : ""}
              {(visitor.visit_count ?? 0) > 1 ? ` · ${so ? "Booqday" : "Visited"} ×${visitor.visit_count}` : ""}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "14px 16px 16px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : hexA(accent, 0.08)}` }}>
        <div style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 10 }}>
          {[visitor.phone, visitor.nira, visitor.gender === "m" ? (so ? "Lab" : "Male") : visitor.gender === "f" ? (so ? "Dhedig" : "Female") : ""].filter(Boolean).join(" · ") || "—"}
        </div>
        {captured && (
          <div style={{ fontSize: 12, color: C.txtMuted, fontVariantNumeric: "tabular-nums", marginBottom: 8 }}>
            <span style={{ color: C.txtSecondary, fontWeight: 500 }}>{captured.date}</span>
            <span style={{ opacity: 0.45, margin: "0 5px" }}>·</span>
            <span>{captured.time}</span>
            <span style={{ color: accent, fontWeight: 600 }}> · {relativeVisitTime(visitor.visited_at, so, now)}</span>
          </div>
        )}
        {visitor.created_by_name && (
          <div style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {so ? "Diiwaangeliye" : "Registered by"}: {visitor.created_by_name}
          </div>
        )}
        <div style={{ marginTop: 14, display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {canEditRow && (
            <button
              type="button"
              onClick={onEdit}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 9, borderRadius: 9,
                border: `1px solid ${hexA(accent, 0.35)}`, background: hexA(accent, 0.08), color: accent,
                fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              {so ? "Wax ka beddel" : "Edit"}
            </button>
          )}
          {canDeleteRow && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                padding: "9px 12px", borderRadius: 9, border: `1px solid ${hexA("#e0655a", 0.35)}`,
                background: hexA("#e0655a", 0.08), color: "#e0655a", cursor: "pointer",
              }}
            >
              <Icon name="delete" size={14} sw={2} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function VisitorFormModal({
  open, onClose, initial, C, accent, isDark, lang,
}: {
  open: boolean;
  onClose: () => void;
  initial: Visitor | null;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  lang: "en" | "so";
}) {
  const createMut = useCreateVisitor();
  const updateMut = useUpdateVisitor();
  const { data: destinations = [] } = useVisitDestinations(open);
  const { data: allegations = [] } = useVisitAllegations(open);
  const so = lang === "so";
  const [fullName, setFullName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [nira, setNira] = useState("");
  const [visiting, setVisiting] = useState("");
  const [contactName, setContactName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [allegationId, setAllegationId] = useState<number | null>(null);
  const [sentence, setSentence] = useState("");
  const [visitedAt, setVisitedAt] = useState(toLocalInputValue());
  const [verified, setVerified] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    if (!open) return;
    setFullName(initial?.full_name ?? "");
    setMotherName(initial?.mother_name ?? "");
    setGender(initial?.gender ?? "");
    setPhone(initial?.phone ?? "");
    setNira(initial?.nira ?? "");
    setVisiting(initial?.visiting ?? "");
    setContactName(initial?.contact_name ?? "");
    setRelationship(initial?.relationship ?? "");
    setAllegationId(initial?.allegation_id ?? null);
    setSentence(initial?.sentence ?? "");
    // Always default to "now" so return/edit never copies a previous visit timestamp.
    setVisitedAt(toLocalInputValue());
    setVerified(!!initial?.verified);
    setImage(null);
    setPreview(initial?.image_url ?? null);
  }, [open, initial]);

  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1px solid ${C.inputBdr}`, background: C.inputBg, color: C.txtPrimary,
    fontFamily: "var(--font-outfit)", fontSize: 14, outline: "none",
  };

  const canSave = !!fullName.trim() && !!visiting.trim();

  const save = async () => {
    if (!canSave) return;
    const payload: VisitorWritePayload = {
      full_name: fullName.trim(),
      mother_name: motherName.trim(),
      gender: gender.trim(),
      phone: phone.trim(),
      nira: nira.trim(),
      visiting: visiting.trim(),
      contact_name: contactName.trim(),
      relationship: relationship.trim(),
      allegation_id: allegationId,
      sentence: sentence.trim(),
      verified,
      image: image ?? undefined,
    };
    // Only first-time create may set an explicit visit time. Return/edit must not
    // reuse an old timestamp (backend also forces "now" on return visits).
    if (!initial) {
      payload.visited_at = fromLocalInputValue(visitedAt);
    }
    if (initial) await updateMut.mutateAsync({ id: initial.id, payload });
    else await createMut.mutateAsync(payload);
    onClose();
  };

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={initial ? (so ? "Wax ka beddel booqde" : "Edit visitor") : (so ? "Diiwaan booqde cusub" : "New visitor")}
      subtitle={so ? "Sawir, magac, jinsi, cida la booqanayo, NIRA & xaqiijin" : "Photo, name, gender, who they visit, NIRA & verified"}
      C={C}
      accent={accent}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: "transparent",
            color: C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)",
          }}>{so ? "Ka noqo" : "Cancel"}</button>
          <button type="button" disabled={busy || !canSave} onClick={save} style={{
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: accent, color: "#fff", cursor: busy ? "wait" : "pointer",
            fontFamily: "var(--font-outfit)", fontWeight: 600, opacity: busy || !canSave ? 0.6 : 1,
          }}>{busy ? (so ? "Waa la kaydinayaa…" : "Saving…") : (so ? "Kaydi" : "Save")}</button>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        {!!initial?.visit_count && initial.visit_count > 0 && (
          <div style={{
            padding: "10px 12px", borderRadius: 10, border: `1px solid ${hexA(accent, 0.35)}`,
            background: hexA(accent, 0.08), color: C.txtPrimary, fontSize: 13, fontFamily: "var(--font-outfit)",
          }}>
            {so
              ? `Wuu soo booqday — ${initial.visit_count} jeer. Wax ka beddelku ma beddelo waqtiyada hore.`
              : `Returning visitor — ${initial.visit_count} visit(s). Editing does not change past visit times.`}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 88, height: 88, borderRadius: 14, overflow: "hidden", flexShrink: 0, cursor: "pointer",
              border: `1px dashed ${hexA(accent, 0.45)}`, background: hexA(accent, 0.08),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Icon name="users" size={28} sw={1.8} />
            )}
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-outfit)", fontSize: 14, color: C.txtPrimary, fontWeight: 600 }}>
              {so ? "Sawirka" : "Photo"}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} style={{
              marginTop: 8, border: `1px solid ${C.inputBdr}`, background: C.inputBg, borderRadius: 8,
              padding: "7px 12px", cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary,
            }}>{so ? "Dooro sawir" : "Choose image"}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Magaca buuxa *" : "Full name *"}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Magaca hooyada" : "Mother name"}</span>
          <input value={motherName} onChange={(e) => setMotherName(e.target.value)} style={inputStyle} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Jinsiga (NIRA)" : "Gender (NIRA)"}</span>
            <select value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
              <option value="">{so ? "Dooro…" : "Select…"}</option>
              <option value="m">{so ? "Lab" : "Male"}</option>
              <option value="f">{so ? "Dhedig" : "Female"}</option>
              <option value="other">{so ? "Kan kale" : "Other"}</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Telefoon" : "Phone"}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </label>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Cida / meesha la booqanayo *" : "Who / where visiting *"}</span>
          <select value={visiting} onChange={(e) => setVisiting(e.target.value)} style={inputStyle}>
            <option value="">{so ? "Dooro…" : "Select…"}</option>
            {visiting && !destinations.some((d) => d.name === visiting) && (
              <option value={visiting}>{visiting}</option>
            )}
            {destinations.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Muxuu ku eedeysan yahay?" : "Allegation"}</span>
          <select
            value={allegationId ?? ""}
            onChange={(e) => setAllegationId(e.target.value ? Number(e.target.value) : null)}
            style={inputStyle}
          >
            <option value="">{so ? "Dooro…" : "Select…"}</option>
            {allegations.map((allegation) => (
              <option key={allegation.id} value={allegation.id}>{allegation.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Xukunka lagu riday" : "Sentence / judgment"}</span>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder={so ? "Ku qor xukunka lagu riday..." : "Enter sentence or judgment..."}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Magaca saddexan ee loo socdo" : "Three-part name of person visited"}</span>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder={so ? "Tusaale: Maxamed Cali Xasan" : "e.g. Mohamed Ali Hassan"}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Xiriirka ka dhexeeya" : "Relationship"}</span>
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder={so ? "Tusaale: Qaraabo, saaxiib, shaqo..." : "e.g. Relative, friend, work..."}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>NIRA</span>
          <input value={nira} onChange={(e) => setNira(e.target.value)} style={inputStyle} />
        </label>
        {!initial && (
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: C.txtMuted }}>{so ? "Taariikhda & saacadda" : "Date and time"}</span>
            <input type="datetime-local" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} style={inputStyle} />
          </label>
        )}
        <label style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12,
          border: `1px solid ${C.inputBdr}`, background: isDark ? hexA(accent, 0.08) : hexA(accent, 0.05),
          cursor: "pointer",
        }}>
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          <span style={{ fontFamily: "var(--font-outfit)", fontSize: 14, color: C.txtPrimary }}>
            {so ? "Verified — qofkan waa soo booqday" : "Verified — this person visited"}
          </span>
        </label>
        {!!initial?.visits?.length && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".04em" }}>
              {so ? "Taariikhda booqashada" : "Visit history"}
            </div>
            <div style={{ display: "grid", gap: 6, maxHeight: 160, overflow: "auto" }}>
              {initial.visits.map((visit) => {
                const captured = formatCaptureDateTime(visit.visited_at);
                return (
                <div key={visit.id} style={{
                  padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.inputBdr}`,
                  fontSize: 12, color: C.txtSecondary, fontFamily: "var(--font-outfit)",
                }}>
                  <strong style={{ color: C.txtPrimary }}>{visit.visiting}</strong>
                  {" · "}
                  {captured ? `${captured.date} · ${captured.time}` : "—"}
                  {visit.verified ? (so ? " · Verified" : " · Verified") : ""}
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AccountModal>
  );
}

export function VisitorsListPage({
  C, accent, isDark, searchQuery = "", openCreateRef,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  searchQuery?: string;
  openCreateRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const so = lang === "so";
  const { canEdit, canDelete } = usePermissions();
  const [nameSearch, setNameSearch] = useState("");
  const deferredLocal = useDeferredValue(nameSearch.trim());
  const deferredHeader = useDeferredValue(searchQuery.trim());
  const search = deferredLocal || deferredHeader;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE || VISITORS_PAGE_SIZE);
  const [verified, setVerified] = useState<"" | "1" | "0">("");
  const [period, setPeriod] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const deleteMut = useDeleteVisitor();
  const { data: stats, isLoading: statsLoading } = useVisitorsStats(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "list" || saved === "grid") setView(saved);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
  }, [view]);
  useEffect(() => { setPage(1); }, [search, verified, period, pageSize]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!openCreateRef) return;
    openCreateRef.current = () => {
      setEditing(null);
      setFormOpen(true);
    };
    return () => { openCreateRef.current = null; };
  }, [openCreateRef]);

  const todayIso = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  const { data, isLoading, isFetching, isPlaceholderData } = useVisitors({
    page,
    search,
    verified,
    date_from: period === "today" ? todayIso : undefined,
    date_to: period === "today" ? todayIso : undefined,
    pageSize,
  });

  const rows = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showShimmer = isLoading && !data;

  const miniKpis = stats ? [
    { label: so ? "Wadar" : "Total", value: stats.total, icon: "badge", color: accent },
    { label: so ? "Maanta" : "Today", value: stats.today, icon: "calendar", color: "#46c08a" },
    { label: "Verified", value: stats.verified, icon: "check", color: "#059669" },
    { label: so ? "Sawir leh" : "With photo", value: stats.with_photo, icon: "users", color: "#e6b25c" },
    { label: so ? "Toddobaadkan" : "This week", value: stats.this_week, icon: "chart", color: "#5b9fd4" },
  ] : [];

  return (
    <div style={{ marginTop: 8, opacity: isPlaceholderData && isFetching ? 0.72 : 1, transition: "opacity .2s" }}>
      {profileId !== null ? (
        <VisitorsProfilePage
          visitorId={profileId}
          onBack={() => setProfileId(null)}
          C={C}
          accent={accent}
          isDark={isDark}
          onEdit={canEdit("visitors") ? (visitor) => {
            setEditing(visitor);
            setFormOpen(true);
          } : undefined}
        />
      ) : (
      <>
      {statsLoading ? <ShimmerKPI /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          {miniKpis.map((k) => (
            <div key={k.label} style={{
              padding: "18px 20px", borderRadius: 14, background: C.cardBg, border: `1px solid ${C.cardBdr}`,
              boxShadow: C.cardShadow, display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA(k.color, 0.14), color: k.color, border: `1px solid ${hexA(k.color, 0.25)}`,
              }}>
                <Icon name={k.icon} size={20} sw={1.8} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 26, color: C.txtPrimary, lineHeight: 1 }}>
                  {k.value.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)" }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 22, marginBottom: 14 }}>
        <NameSearchInput
          value={nameSearch}
          onChange={setNameSearch}
          placeholder={so ? "Raadi magac, telefoon, NIRA..." : "Search name, phone, NIRA..."}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <FilterSelect
          value={verified}
          onChange={(v) => setVerified(v as "" | "1" | "0")}
          placeholder={so ? "Dhammaan xaqiijinta" : "All verification"}
          options={[
            { value: "1", label: "Verified" },
            { value: "0", label: so ? "Pending" : "Pending" },
          ]}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <FilterSelect
          value={period}
          onChange={setPeriod}
          placeholder={so ? "Dhammaan maalmaha" : "All days"}
          options={[{ value: "today", label: so ? "Maanta" : "Today" }]}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ViewToggle mode={view} setMode={setView} C={C} accent={accent} isDark={isDark} t={t} />
          {data && (
            <span style={{ fontSize: 13, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {data.count} {so ? "booqdeyaal" : "visitors"}
            </span>
          )}
        </div>
        <TableRowsSelect
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          C={C}
          label={so ? "Tiro" : "Rows"}
        />
      </div>

      {showShimmer ? (
        view === "grid" ? <ShimmerSuspectGrid count={pageSize} /> : <ShimmerSuspectList rows={6} />
      ) : rows.length === 0 ? (
        <div style={{ padding: "64px 24px", textAlign: "center", borderRadius: 14, background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
            background: hexA(accent, 0.12), color: accent,
          }}>
            <Icon name="search" size={26} sw={1.8} />
          </div>
          <p style={{ marginTop: 16, fontSize: 15, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
            {so ? "Booqdeyaal lama helin." : "No visitors found."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
          {rows.map((v) => (
            <VisitorGridCard
              key={v.id}
              visitor={v}
              C={C}
              accent={accent}
              isDark={isDark}
              so={so}
              now={now}
              canEditRow={canEdit("visitors")}
              canDeleteRow={canDelete("visitors")}
              onOpen={() => setProfileId(v.id)}
              onEdit={() => { setEditing(v); setFormOpen(true); }}
              onDelete={() => setDeleteTarget(v)}
              onPreview={(e) => { e.stopPropagation(); if (v.image_url) setPreviewUrl(v.image_url); }}
            />
          ))}
        </div>
      ) : (
        <div style={{ borderRadius: 14, overflow: "hidden", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
              <thead>
                <tr>
                  <th style={{ width: 72 }} />
                  {[so ? "Magaca" : "Name", so ? "Telefoon" : "Phone", "NIRA", so ? "Waqtiga" : "Visited", so ? "Diiwaangeliye" : "Registered by", so ? "Xaalad" : "Status", ""].map((col) => (
                    <th key={col || "a"} style={{
                      textAlign: "left", padding: "13px 16px", fontSize: 11, fontWeight: 500, letterSpacing: ".08em",
                      textTransform: "uppercase", color: C.txtMuted, background: C.tableHead, fontFamily: "var(--font-outfit)",
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v, i) => {
                  const captured = formatCaptureDateTime(v.visited_at);
                  const initials = v.full_name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
                  return (
                    <tr key={v.id} style={{
                      borderTop: `1px solid ${C.tableSep}`, animation: "is-fadeUp .4s ease both", animationDelay: `${i * 0.03}s`,
                      cursor: "pointer",
                    }}
                      onClick={() => setProfileId(v.id)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: 12, overflow: "hidden",
                          border: `2px solid ${hexA(accent, 0.35)}`, cursor: v.image_url ? "zoom-in" : undefined,
                        }}
                          onClick={(e) => { e.stopPropagation(); v.image_url && setPreviewUrl(v.image_url); }}
                        >
                          <VisitorPhoto
                            url={v.image_url}
                            alt={v.full_name}
                            accent={accent}
                            fallback={
                              <div style={{
                                width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                                background: `linear-gradient(135deg,${accent},${hexA(accent, 0.5)})`, color: "#fff",
                                fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 16,
                              }}>{initials}</div>
                            }
                          />
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.txtPrimary }}>{v.full_name}</div>
                        {(v.visit_count ?? 0) > 1 && (
                          <div style={{ fontSize: 12, color: accent, fontWeight: 600 }}>
                            {so ? "Booqday" : "Visited"} ×{v.visit_count}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: C.txtSecondary }}>{v.phone || "—"}</td>
                      <td style={{ padding: "12px 16px", color: C.txtSecondary }}>{v.nira || "—"}</td>
                      <td style={{ padding: "12px 16px", color: C.txtSecondary, fontSize: 13 }}>
                        {captured ? (
                          <>
                            <div>{captured.date} · {captured.time}</div>
                            <div style={{ marginTop: 3, color: accent, fontSize: 11.5, fontWeight: 600 }}>
                              {relativeVisitTime(v.visited_at, so, now)}
                            </div>
                          </>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: C.txtSecondary, fontSize: 13 }}>
                        {v.created_by_name || "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {v.verified ? (
                          <span
                            title="Verified"
                            aria-label="Verified"
                            style={{
                              width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                              background: "#1877F2", color: "#fff", fontSize: 16, fontWeight: 800, lineHeight: 1,
                            }}
                          >✓</span>
                        ) : (
                          <span style={{
                            padding: "4px 8px", borderRadius: 999, fontSize: 11, fontFamily: "var(--font-outfit)",
                            background: hexA(accent, 0.15), color: accent,
                          }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          C={C}
                          accent={accent}
                          labels={{ view: t.viewAction, edit: t.editAction, delete: t.deleteAction }}
                          actions={[
                            "view",
                            ...(canEdit("visitors") ? (["edit"] as const) : []),
                            ...(canDelete("visitors") ? (["delete"] as const) : []),
                          ]}
                          onAction={(action) => {
                            if (action === "view") setProfileId(v.id);
                            if (action === "edit") { setEditing(v); setFormOpen(true); }
                            if (action === "delete") setDeleteTarget(v);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!showShimmer && data && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          C={C}
          accent={accent}
          isDark={isDark}
          labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
          totalLabel={`${data.count} ${so ? "booqdeyaal" : "visitors"} · ${t.page} ${page} ${t.of} ${totalPages}`}
          hideWhenSinglePage
        />
      )}
      </>
      )}

      <VisitorFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        initial={editing}
        C={C}
        accent={accent}
        isDark={isDark}
        lang={lang}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={so ? "Tirtir booqde?" : "Delete visitor?"}
        message={deleteTarget ? `${so ? "Ma tirtiraysaa" : "Delete"} ${deleteTarget.full_name}?` : ""}
        confirmLabel={so ? "Tirtir" : "Delete"}
        cancelLabel={so ? "Ka noqo" : "Cancel"}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id, {
          onSuccess: () => {
            setDeleteTarget(null);
            if (profileId === deleteTarget.id) setProfileId(null);
          },
        })}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={deleteMut.isPending}
      />

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" style={{ maxWidth: "92vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
