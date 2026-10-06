"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "../icon";
import { useCreateSurvey, useUpdateSurvey } from "@/hooks/use-surveys";
import type { Survey, SurveyStatus } from "@/types/surveys";
import { SurveySelect } from "./survey-select";
import { useSurveyTheme } from "./survey-pulse-ui";
import { loadSurveyModuleSettings } from "@/lib/survey-module-settings";
import { SurveyRichTextField, sanitizeSurveyHtml } from "./survey-rich-text";

// ─── Modal shell ─────────────────────────────────────────────────────────────

export function SurveyModal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow = "Survey",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const T = useSurveyTheme();
  const titleId = useId();

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
      aria-labelledby={titleId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: T.isDark ? "rgba(2,4,12,0.78)" : "rgba(15,23,42,0.48)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "is-fadeIn .28s ease both",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "min(92vh, calc(100dvh - 32px))",
          display: "flex",
          flexDirection: "column",
          borderRadius: 18,
          background: T.isDark ? T.card : "#fff",
          border: `1px solid ${T.cardBdr}`,
          boxShadow: T.isDark
            ? `0 32px 80px -16px rgba(0,0,0,0.85), 0 0 0 1px ${hexA(T.accent, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.05)`
            : `0 32px 64px -16px rgba(15,23,42,0.22), 0 0 0 1px rgba(15,23,42,0.05)`,
          overflow: "hidden",
          animation: "is-fadeUp .32s ease both",
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: "20px 24px",
            borderBottom: `1px solid ${T.tableSep}`,
            background: `linear-gradient(135deg, ${hexA(T.accent, T.isDark ? 0.12 : 0.08)} 0%, transparent 72%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: T.accent,
                marginBottom: 6,
                fontFamily: "var(--font-outfit)",
              }}>
                {eyebrow}
              </div>
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 22,
                  fontWeight: 700,
                  color: T.text,
                  lineHeight: 1.25,
                  letterSpacing: "-.02em",
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  color: T.dim,
                  fontFamily: "var(--font-outfit)",
                  lineHeight: 1.5,
                }}>
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
                width: 36,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${T.inputBdr}`,
                background: T.inputBg,
                cursor: "pointer",
                color: T.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <Icon name="close" size={16} sw={2} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          className="survey-modal-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px 24px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "14px 24px",
            borderTop: `1px solid ${T.tableSep}`,
            background: T.isDark ? T.card : "#fff",
          }}
        >
          {footer}
        </div>
      </div>
      <style>{`
        .survey-modal-body::-webkit-scrollbar { width: 8px; }
        .survey-modal-body::-webkit-scrollbar-track { background: transparent; }
        .survey-modal-body::-webkit-scrollbar-thumb {
          background: rgba(128,128,128,0.35);
          border-radius: 4px;
        }
      `}</style>
    </div>,
    document.body,
  );
}

// ─── Form primitives ─────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const T = useSurveyTheme();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{
        fontSize: 11,
        letterSpacing: ".07em",
        textTransform: "uppercase",
        color: T.dim,
        fontFamily: "var(--font-outfit)",
        fontWeight: 600,
      }}>
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </span>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: "#ef4444", fontFamily: "var(--font-outfit)" }}>{error}</span>
      )}
    </label>
  );
}

function SurveyTextInput({
  value,
  onChange,
  placeholder,
  disabled,
  inputRef,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const T = useSurveyTheme();
  const [focused, setFocused] = useState(false);
  const style: CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1px solid ${focused ? T.accent : T.inputBdr}`,
    background: T.inputBg,
    color: T.text,
    fontFamily: "var(--font-outfit)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .2s, box-shadow .2s",
    boxShadow: focused ? `0 0 0 3px ${hexA(T.accent, 0.15)}` : "none",
    opacity: disabled ? 0.6 : 1,
  };
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      style={style}
    />
  );
}

function ToggleField({
  label,
  on,
  onToggle,
  disabled,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const T = useSurveyTheme();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        width: "100%",
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${on ? hexA(T.accent, 0.35) : T.inputBdr}`,
        background: on ? hexA(T.accent, T.isDark ? 0.08 : 0.05) : T.inputBg,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        opacity: disabled ? 0.6 : 1,
        transition: "border-color .2s, background .2s",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "var(--font-outfit)" }}>{label}</div>
      <div style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? T.accent : T.track,
        position: "relative",
        flexShrink: 0,
        transition: "background .2s",
      }}>
        <div style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.2)",
          transition: "left .2s",
        }} />
      </div>
    </button>
  );
}

export function ModalFooterButtons({
  onCancel,
  submitLabel,
  pendingLabel,
  formId,
  isPending,
}: {
  onCancel: () => void;
  submitLabel: string;
  pendingLabel: string;
  formId: string;
  isPending: boolean;
}) {
  const T = useSurveyTheme();
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        style={{
          padding: "10px 18px",
          borderRadius: 10,
          border: `1px solid ${T.inputBdr}`,
          background: "transparent",
          color: T.muted,
          fontFamily: "var(--font-outfit)",
          fontSize: 14,
          fontWeight: 500,
          cursor: isPending ? "not-allowed" : "pointer",
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        disabled={isPending}
        style={{
          padding: "10px 22px",
          borderRadius: 10,
          border: "none",
          background: isPending ? T.track : `linear-gradient(135deg, #60a5fa, ${T.accent})`,
          color: isPending ? T.dim : "#fff",
          fontFamily: "var(--font-outfit)",
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? "not-allowed" : "pointer",
          boxShadow: isPending ? "none" : `0 6px 18px -6px ${hexA(T.accent, 0.55)}`,
        }}
      >
        {isPending ? pendingLabel : submitLabel}
      </button>
    </>
  );
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────

export function SurveyConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const T = useSurveyTheme();

  return (
    <SurveyModal
      open={open}
      onClose={onCancel}
      eyebrow="Confirm"
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${T.inputBdr}`,
              background: "transparent",
              color: T.muted,
              fontFamily: "var(--font-outfit)",
              fontSize: 14,
              fontWeight: 500,
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              background: pending ? T.track : "#e0655a",
              color: pending ? T.dim : "#fff",
              fontFamily: "var(--font-outfit)",
              fontSize: 14,
              fontWeight: 600,
              cursor: pending ? "not-allowed" : "pointer",
              boxShadow: pending ? "none" : "0 6px 18px -6px rgba(224,101,90,0.45)",
            }}
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{
        margin: 0,
        fontSize: 14,
        color: T.muted,
        fontFamily: "var(--font-outfit)",
        lineHeight: 1.55,
      }}>
        {message}
      </p>
    </SurveyModal>
  );
}

// ─── Create modal ────────────────────────────────────────────────────────────

export function CreateSurveyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const createMutation = useCreateSurvey();
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!open) return;
    const defaults = loadSurveyModuleSettings();
    setName("");
    setDescription("");
    setAllowMultiple(defaults.defaultAllowMultiple);
    setNameError("");
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  function handleClose() {
    if (createMutation.isPending) return;
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Survey name is required.");
      nameRef.current?.focus();
      return;
    }
    setNameError("");
    const defaults = loadSurveyModuleSettings();
    const result = await createMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() ? sanitizeSurveyHtml(description.trim()) : undefined,
      allow_multiple_submissions: allowMultiple,
      status: defaults.defaultStatus,
    });
    onClose();
    router.push(`/dashboard/survey/${result.id}`);
  }

  return (
    <SurveyModal
      open={open}
      onClose={handleClose}
      eyebrow="New survey"
      title="Create survey"
      footer={
        <ModalFooterButtons
          onCancel={handleClose}
          formId={formId}
          isPending={createMutation.isPending}
          submitLabel="Create survey"
          pendingLabel="Creating…"
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormField label="Survey name" required error={nameError}>
          <SurveyTextInput
            inputRef={nameRef}
            value={name}
            onChange={(v) => { setName(v); setNameError(""); }}
            placeholder="Survey name"
            disabled={createMutation.isPending}
          />
        </FormField>
        <FormField label="Description">
          <SurveyRichTextField
            value={description}
            onChange={setDescription}
            placeholder="Describe this survey for your team…"
            disabled={createMutation.isPending}
          />
        </FormField>
        <ToggleField
          label="Allow multiple submissions"
          on={allowMultiple}
          onToggle={() => setAllowMultiple((v) => !v)}
          disabled={createMutation.isPending}
        />
      </form>
    </SurveyModal>
  );
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

export function EditSurveyModal({
  survey,
  onClose,
}: {
  survey: Survey | null;
  onClose: () => void;
}) {
  if (!survey) return null;
  return <EditSurveyModalInner key={survey.id} survey={survey} onClose={onClose} />;
}

function EditSurveyModalInner({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const T = useSurveyTheme();
  const updateMutation = useUpdateSurvey(survey.id);
  const formId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(survey.name);
  const [description, setDescription] = useState(survey.description ?? "");
  const [status, setStatus] = useState<SurveyStatus>(survey.status);
  const [allowMultiple, setAllowMultiple] = useState(survey.allow_multiple_submissions);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    setName(survey.name);
    setDescription(survey.description ?? "");
    setStatus(survey.status);
    setAllowMultiple(survey.allow_multiple_submissions);
    setNameError("");
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [survey]);

  function handleClose() {
    if (updateMutation.isPending) return;
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Survey name is required.");
      nameRef.current?.focus();
      return;
    }
    setNameError("");
    await updateMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() ? sanitizeSurveyHtml(description.trim()) : undefined,
      status,
      allow_multiple_submissions: allowMultiple,
    });
    onClose();
  }

  return (
    <SurveyModal
      open
      onClose={handleClose}
      eyebrow="Edit survey"
      title={survey.name}
      footer={
        <ModalFooterButtons
          onCancel={handleClose}
          formId={formId}
          isPending={updateMutation.isPending}
          submitLabel="Save changes"
          pendingLabel="Saving…"
        />
      }
    >
      <form id={formId} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormField label="Survey name" required error={nameError}>
          <SurveyTextInput
            inputRef={nameRef}
            value={name}
            onChange={(v) => { setName(v); setNameError(""); }}
            placeholder="Survey name"
            disabled={updateMutation.isPending}
          />
        </FormField>
        <FormField label="Description">
          <SurveyRichTextField
            key={survey.id}
            value={description}
            onChange={setDescription}
            placeholder="Describe this survey for your team…"
            disabled={updateMutation.isPending}
          />
        </FormField>
        <FormField label="Status">
          <SurveySelect
            T={T}
            value={status}
            onChange={(v) => setStatus(v as SurveyStatus)}
            disabled={updateMutation.isPending}
            options={[
              { value: "draft", label: "Draft" },
              { value: "live", label: "Live" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </FormField>
        <ToggleField
          label="Allow multiple submissions"
          on={allowMultiple}
          onToggle={() => setAllowMultiple((v) => !v)}
          disabled={updateMutation.isPending}
        />
      </form>
    </SurveyModal>
  );
}
