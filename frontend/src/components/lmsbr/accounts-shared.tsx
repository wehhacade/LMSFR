"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { hexA } from "@/lib/lmsbr/data";
import {
  LIGHT_DUSTY_INPUT,
  LIGHT_DUSTY_MODAL_BODY,
  LIGHT_DUSTY_MODAL_FOOTER,
  LIGHT_DUSTY_PANEL,
} from "@/lib/lmsbr/palette";
import { Icon } from "./icon";
import { useTheme } from "./theme-ctx";

export type AccountsThemeColors = {
  cardBg: string; cardBdr: string; cardBdrHov?: string; cardShadow?: string;
  panelBg: string; panelShadow: string; tableSep: string; tableHead: string; tableHov: string;
  txtPrimary: string; txtSecondary: string; txtMuted: string; txtAccentHd?: string;
  inputBg: string; inputBdr: string; inputFocusBdr?: string; btnBg?: string; btnBdr?: string;
  modalOverlay?: string; dropdownBg?: string;
};

export type ModalSize = "sm" | "md" | "lg" | "xl";

const MODAL_WIDTH: Record<ModalSize, number> = {
  sm: 440,
  md: 560,
  lg: 780,
  xl: 920,
};

/** Enterprise modal: portal to body, fixed header/footer, scrollable body. */
export function AccountModal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  C,
  accent,
  size = "lg",
  zIndex = 1000,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
  C: AccountsThemeColors;
  accent?: string;
  size?: ModalSize;
  zIndex?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const modalShellBg = isDark ? C.panelBg : LIGHT_DUSTY_PANEL;
  const modalBodyBg = isDark ? "transparent" : LIGHT_DUSTY_MODAL_BODY;
  const modalFooterBg = isDark ? C.panelBg : LIGHT_DUSTY_MODAL_FOOTER;
  const modalHeaderBg = accent
    ? `linear-gradient(135deg, ${hexA(accent, isDark ? 0.1 : 0.07)} 0%, transparent 72%)`
    : modalShellBg;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: isDark
          ? (C.modalOverlay ?? "rgba(0,0,0,0.45)")
          : (C.modalOverlay ?? "rgba(26,54,93,0.32)"),
        backdropFilter: isDark ? "blur(3px)" : "blur(10px)",
        WebkitBackdropFilter: isDark ? "blur(3px)" : "blur(10px)",
        animation: "is-fadeIn .28s ease both",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: MODAL_WIDTH[size],
          maxHeight: "min(92vh, calc(100dvh - 32px))",
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          background: modalShellBg,
          border: `1px solid ${isDark ? C.cardBdr : "#E5E7EB"}`,
          boxShadow: accent
            ? isDark
              ? `0 32px 80px -16px rgba(0,0,0,0.75), 0 0 0 1px ${hexA(accent, 0.14)}, inset 0 1px 0 rgba(248,228,180,0.05)`
              : `0 8px 32px -8px rgba(0,0,0,0.10), 0 0 0 1px ${hexA(accent, 0.08)}`
            : isDark
              ? "0 32px 80px -16px rgba(0,0,0,0.75), inset 0 1px 0 rgba(248,228,180,0.05)"
              : "0 24px 64px -12px rgba(0,0,0,0.45)",
          overflow: "hidden",
          animation: "is-fadeUp .32s ease both",
        }}
      >
        <div style={{
          flexShrink: 0,
          padding: "22px 28px",
          borderBottom: `1px solid ${C.tableSep}`,
          background: modalHeaderBg,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px" }}>
            <div style={{ minWidth: 0 }}>
              <h2 id="account-modal-title" style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: "24px", color: C.txtPrimary, lineHeight: 1.2 }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ margin: "8px 0 0", fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", lineHeight: 1.5 }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                flexShrink: 0,
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                border: `1px solid ${C.inputBdr}`,
                background: isDark ? C.inputBg : LIGHT_DUSTY_INPUT,
                cursor: "pointer",
                color: C.txtMuted,
                fontSize: "20px",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="account-modal-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "22px 28px",
            WebkitOverflowScrolling: "touch",
            background: modalBodyBg,
          }}
        >
          {children}
        </div>

        {footer ? (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px",
              padding: "16px 28px",
              borderTop: `1px solid ${C.tableSep}`,
              background: modalFooterBg,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
      <style>{`
        .account-modal-body::-webkit-scrollbar { width: 8px; }
        .account-modal-body::-webkit-scrollbar-track { background: transparent; }
        .account-modal-body::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.35); border-radius: 4px; }
      `}</style>
    </div>,
    document.body,
  );
}

/** @deprecated Use AccountModal */
export function ModalOverlay({ children, onClose, zIndex = 1000 }: {
  children: ReactNode; onClose: () => void; zIndex?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "var(--lmsbr-modal-overlay, rgba(2,1,0,0.72))",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/** @deprecated Use AccountModal */
export function ModalPanel({ children, maxWidth = 560, C }: {
  children: ReactNode; onClose?: () => void; maxWidth?: number; C: AccountsThemeColors;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        maxHeight: "min(92vh, calc(100dvh - 32px))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "18px",
        background: C.panelBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: "0 24px 64px -12px rgba(0,0,0,0.45)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, C }: {
  title: string; subtitle?: string; onClose?: () => void; C: AccountsThemeColors;
}) {
  return (
    <div style={{ padding: "22px 26px", borderBottom: `1px solid ${C.tableSep}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: "22px", color: C.txtPrimary, lineHeight: 1.25 }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: "6px 0 0", fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", lineHeight: 1.45 }}>{subtitle}</p>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.txtMuted, padding: "4px", fontSize: "22px", lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function FormSection({ title, description, children, C }: {
  title: string; description?: string; children: ReactNode; C?: AccountsThemeColors;
}) {
  return (
    <section style={{ marginBottom: "22px" }}>
      <div style={{ marginBottom: "12px" }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: "15px", fontWeight: 600, color: C?.txtPrimary ?? "inherit" }}>{title}</h3>
        {description && (
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: C?.txtMuted ?? "inherit", opacity: C ? 1 : 0.72, fontFamily: "var(--font-outfit)", lineHeight: 1.4 }}>{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function FormRow({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: columns === 1 ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
      {children}
    </div>
  );
}

export function FormField({ label, required, children, C }: {
  label: string; required?: boolean; children: ReactNode; C: AccountsThemeColors;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "12px", letterSpacing: ".06em", textTransform: "uppercase", color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontWeight: 600 }}>
        {label}{required && <span style={{ color: "#e0655a", marginLeft: "3px" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const DARK_NATIVE_FIELD_BG = "#11100d";

export const nativeFieldStyle = (
  C: AccountsThemeColors,
  isDark: boolean,
  opts?: { focused?: boolean; accent?: string; active?: boolean; cursor?: CSSProperties["cursor"] },
): CSSProperties => ({
  padding: "11px 14px",
  borderRadius: "10px",
  border: `1px solid ${
    opts?.active && opts?.accent
      ? hexA(opts.accent, isDark ? 0.4 : 0.28)
      : opts?.focused
        ? (C.inputFocusBdr ?? "rgba(198,144,73,0.55)")
        : C.inputBdr
  }`,
  background: isDark ? DARK_NATIVE_FIELD_BG : LIGHT_DUSTY_INPUT,
  color: C.txtPrimary,
  colorScheme: isDark ? "dark" : "light",
  fontFamily: "var(--font-outfit)",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color .2s, box-shadow .2s",
  boxShadow: opts?.focused ? "0 0 0 3px rgba(198,144,73,0.12)" : "none",
  cursor: opts?.cursor,
});

const inputBase = (
  C: AccountsThemeColors,
  opts?: { focused?: boolean; isDark?: boolean },
): CSSProperties => ({
  padding: "11px 14px",
  borderRadius: "10px",
  border: `1px solid ${opts?.focused ? (C.inputFocusBdr ?? "rgba(198,144,73,0.55)") : C.inputBdr}`,
  background: opts?.isDark === false ? LIGHT_DUSTY_INPUT : C.inputBg,
  color: C.txtPrimary,
  fontFamily: "var(--font-outfit)",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color .2s, box-shadow .2s",
  boxShadow: opts?.focused ? "0 0 0 3px rgba(198,144,73,0.12)" : "none",
});

export function TextInput({ value, onChange, placeholder, type = "text", C, readOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; C: AccountsThemeColors; readOnly?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputBase(C, { focused, isDark }), opacity: readOnly ? 0.75 : 1, cursor: readOnly ? "not-allowed" : "text" }}
    />
  );
}

export function SelectInput({
  value, onChange, children, C, accent, active,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  C: AccountsThemeColors;
  accent?: string;
  active?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={nativeFieldStyle(C, isDark, { focused, accent, active: active ?? !!value, cursor: "pointer" })}
    >
      {children}
    </select>
  );
}

export function TextAreaInput({
  value, onChange, placeholder, rows = 5, C,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  C: AccountsThemeColors;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...nativeFieldStyle(C, isDark, { focused, cursor: "text" }), resize: "vertical" }}
    />
  );
}

export function DateInput({
  value, onChange, C, accent,
}: {
  value: string;
  onChange: (v: string) => void;
  C: AccountsThemeColors;
  accent?: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={nativeFieldStyle(C, isDark, { focused, accent, active: !!value, cursor: "pointer" })}
    />
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIconName(file: File | null, url?: string | null) {
  const type = file?.type ?? "";
  const name = file?.name ?? url ?? "";
  if (type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(name)) return "grid";
  if (type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name)) return "clipboard";
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg)$/i.test(name)) return "bell";
  return "file";
}

export function FileChooser({
  value,
  onChange,
  existingUrl,
  accept = "image/*,video/*,audio/*,.pdf",
  hint,
  formatsHint,
  replaceLabel,
  removeLabel,
  currentLabel,
  openLabel,
  C,
  accent,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string | null;
  accept?: string;
  hint: string;
  formatsHint?: string;
  replaceLabel: string;
  removeLabel: string;
  currentLabel?: string;
  openLabel?: string;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hideExisting, setHideExisting] = useState(false);

  const showExisting = Boolean(existingUrl && !value && !hideExisting);
  const hasFile = Boolean(value || showExisting);

  useEffect(() => {
    setHideExisting(false);
  }, [existingUrl, value]);

  useEffect(() => {
    if (!value?.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const pickFile = (list: FileList | File[]) => {
    const file = Array.from(list)[0];
    if (!file) return;
    onChange(file);
  };

  const existingName = existingUrl?.split("/").pop()?.split("?")[0] ?? currentLabel ?? "File";
  const openFileLabel = openLabel ?? "Open file";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) pickFile(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !hasFile && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !hasFile) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) pickFile(e.dataTransfer.files);
        }}
        style={{
          padding: hasFile ? "14px 16px" : "24px 20px",
          borderRadius: 12,
          border: `2px dashed ${dragOver ? hexA(accent, 0.6) : C.inputBdr}`,
          background: dragOver ? hexA(accent, 0.06) : (isDark ? DARK_NATIVE_FIELD_BG : LIGHT_DUSTY_INPUT),
          cursor: hasFile ? "default" : "pointer",
          textAlign: hasFile ? "left" : "center",
          transition: ".2s",
        }}
      >
        {!hasFile ? (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.1), color: accent,
            }}>
              <Icon name="archive" size={22} sw={1.8} />
            </div>
            <div style={{ fontSize: 14, color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontWeight: 500 }}>
              {hint}
            </div>
            {formatsHint && (
              <div style={{ marginTop: 6, fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                {formatsHint}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {(previewUrl || (showExisting && /\.(jpe?g|png|gif|webp)$/i.test(existingUrl!))) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl ?? existingUrl!}
                alt=""
                style={{
                  width: 56, height: 56, borderRadius: 10, objectFit: "cover",
                  border: `1px solid ${C.cardBdr}`, flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA(accent, 0.1), color: accent,
                border: `1px solid ${hexA(accent, 0.2)}`,
              }}>
                <Icon name={fileIconName(value, existingUrl)} size={24} sw={1.8} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, color: C.txtPrimary,
                fontFamily: "var(--font-outfit)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {value?.name ?? existingName}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                {value ? formatFileSize(value.size) : currentLabel ?? openFileLabel}
              </div>
              {showExisting && (
                <a
                  href={existingUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-block", marginTop: 6, fontSize: 12, color: accent,
                    fontFamily: "var(--font-outfit)", textDecoration: "underline",
                  }}
                >
                  {openFileLabel}
                </a>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${hexA(accent, 0.4)}`, background: hexA(accent, 0.08),
                  color: accent, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 12, fontWeight: 600,
                }}
              >
                <Icon name="edit" size={14} sw={2} />
                {replaceLabel}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (value) onChange(null);
                  else setHideExisting(true);
                }}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 8,
                  border: `1px solid ${hexA("#e0655a", 0.45)}`, background: hexA("#e0655a", 0.08),
                  color: "#e0655a", cursor: "pointer",
                }}
                title={removeLabel}
                aria-label={removeLabel}
              >
                <Icon name="delete" size={15} sw={2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Same dropzone shell as FileChooser, but accumulates many files instead of one. */
export function MultiFileChooser({
  files,
  onChange,
  accept = "image/*,video/*,audio/*,.pdf",
  hint,
  addMoreHint,
  formatsHint,
  removeLabel,
  C,
  accent,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  hint: string;
  addMoreHint?: string;
  formatsHint?: string;
  removeLabel: string;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (!picked.length) return;
    onChange([...files, ...picked]);
  };

  const removeAt = (index: number) => onChange(files.filter((_, i) => i !== index));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        style={{
          padding: "24px 20px",
          borderRadius: 12,
          border: `2px dashed ${dragOver ? hexA(accent, 0.6) : C.inputBdr}`,
          background: dragOver ? hexA(accent, 0.06) : (isDark ? DARK_NATIVE_FIELD_BG : LIGHT_DUSTY_INPUT),
          cursor: "pointer",
          textAlign: "center",
          transition: ".2s",
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: hexA(accent, 0.1), color: accent,
        }}>
          <Icon name="archive" size={22} sw={1.8} />
        </div>
        <div style={{ fontSize: 14, color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontWeight: 500 }}>
          {files.length > 0 ? (addMoreHint ?? hint) : hint}
        </div>
        {formatsHint && (
          <div style={{ marginTop: 6, fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            {formatsHint}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10,
                border: `1px solid ${C.cardBdr}`,
                background: isDark ? DARK_NATIVE_FIELD_BG : LIGHT_DUSTY_INPUT,
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: hexA(accent, 0.1), color: accent,
              }}>
                <Icon name={fileIconName(file, null)} size={18} sw={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.txtPrimary, fontFamily: "var(--font-outfit)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 11.5, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                  {formatFileSize(file.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(index)}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${hexA("#e0655a", 0.45)}`, background: hexA("#e0655a", 0.08),
                  color: "#e0655a", cursor: "pointer",
                }}
                title={removeLabel}
                aria-label={removeLabel}
              >
                <Icon name="delete" size={13} sw={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, accent, fullWidth }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; accent: string; fullWidth?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        padding: "12px 20px", borderRadius: "10px", border: "none",
        background: accent, color: "#fff", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-outfit)", fontSize: "14px", opacity: disabled ? 0.6 : 1,
        width: fullWidth ? "100%" : undefined,
      }}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, C }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; C: AccountsThemeColors;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        padding: "11px 18px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`,
        background: isDark ? "transparent" : LIGHT_DUSTY_INPUT,
        color: C.txtSecondary, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-outfit)", fontSize: "14px", opacity: disabled ? 0.6 : 1,
      }}>
      {children}
    </button>
  );
}

type RowAction = "view" | "edit" | "delete";

export function RowActions({ actions, onAction, C, accent, labels, iconOnly = false }: {
  actions: RowAction[];
  onAction: (action: RowAction) => void;
  C: AccountsThemeColors;
  accent: string;
  labels: { view: string; edit: string; delete: string };
  iconOnly?: boolean;
}) {
  const btn = (action: RowAction, color: string, icon: string, label: string) => (
    <button
      key={action}
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onAction(action); }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: iconOnly ? 0 : "5px",
        padding: iconOnly ? "7px 8px" : "7px 10px", borderRadius: "8px", border: `1px solid ${hexA(color, 0.5)}`,
        background: hexA(color, 0.06), color, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "12px", fontWeight: 500,
        transition: "background .2s, border-color .2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = hexA(color, 0.14);
        (e.currentTarget as HTMLButtonElement).style.borderColor = hexA(color, 0.65);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = hexA(color, 0.06);
        (e.currentTarget as HTMLButtonElement).style.borderColor = hexA(color, 0.5);
      }}
    >
      <Icon name={icon} size={14} sw={2} />
      {!iconOnly && <span className="row-action-label">{label}</span>}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
      {actions.includes("view") && btn("view", accent, "open", labels.view)}
      {actions.includes("edit") && btn("edit", "#e6b25c", "edit", labels.edit)}
      {actions.includes("delete") && btn("delete", "#e0655a", "delete", labels.delete)}
      {!iconOnly && <style>{`@media (max-width: 900px) { .row-action-label { display: none; } }`}</style>}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, C, accent, pending }: {
  open: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onCancel: () => void; C: AccountsThemeColors; accent: string; pending?: boolean;
}) {
  if (!open) return null;
  return (
    <AccountModal
      open={open}
      onClose={onCancel}
      title={title}
      C={C}
      accent={accent}
      size="sm"
      zIndex={1300}
      footer={
        <>
          <SecondaryButton onClick={onCancel} C={C}>{cancelLabel}</SecondaryButton>
          <button type="button" onClick={onConfirm} disabled={pending}
            style={{ padding: "11px 18px", borderRadius: "10px", border: "none", background: "#e0655a", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-outfit)", opacity: pending ? 0.6 : 1 }}>
            {pending ? "…" : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: "14px", color: C.txtSecondary, fontFamily: "var(--font-outfit)", lineHeight: 1.55 }}>{message}</p>
    </AccountModal>
  );
}

export function EntityHeader({ C, accent, isDark, icon, title, subtitle, meta, badges, actions }: {
  C: AccountsThemeColors; accent: string; isDark: boolean; icon: string;
  title: string; subtitle?: string; meta?: { label: string; value: string }[];
  badges?: { label: string; color: string }[];
  actions?: ReactNode;
}) {
  return (
    <div style={{
      borderRadius: "16px", background: C.panelBg, border: `1px solid ${C.cardBdr}`,
      boxShadow: C.panelShadow, padding: "22px 24px", marginBottom: "22px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "18px", flexWrap: "wrap" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "14px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: hexA(accent, isDark ? 0.2 : 0.12), color: accent,
          border: `1px solid ${hexA(accent, 0.28)}`,
        }}>
          <Icon name={icon} size={26} sw={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: "var(--font-cinzel)", fontSize: "24px", fontWeight: 600, color: C.txtPrimary, lineHeight: 1.2 }}>{title}</h1>
              {subtitle && (
                <p style={{ margin: "6px 0 0", fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{subtitle}</p>
              )}
            </div>
            {actions && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{actions}</div>}
          </div>
          {(badges?.length || meta?.length) ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px", alignItems: "center" }}>
              {badges?.map((b) => (
                <span key={b.label} style={{
                  fontSize: "11px", fontWeight: 600, padding: "5px 11px", borderRadius: "20px",
                  background: hexA(b.color, 0.14), color: b.color, border: `1px solid ${hexA(b.color, 0.28)}`,
                  fontFamily: "var(--font-outfit)", textTransform: "capitalize",
                }}>{b.label}</span>
              ))}
              {meta?.map((m) => (
                <span key={m.label} style={{ fontSize: "13px", color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                  <span style={{ color: C.txtMuted }}>{m.label}:</span> {m.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BackButton({ label, onClick, C }: { label: string; onClick: () => void; C: AccountsThemeColors }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "16px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${C.inputBdr}`, background: C.cardBg, color: C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: "13.5px" }}>
      <span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="arrow" size={15} sw={2} /></span>
      {label}
    </button>
  );
}
