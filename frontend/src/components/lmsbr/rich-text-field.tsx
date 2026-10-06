"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { hexA } from "@/lib/lmsbr/data";
import { isHtmlContent, normalizeEditorHtml, plainToHtml, sanitizeRichHtml, valueToEditorHtml } from "@/lib/lmsbr/rich-text";
import type { AccountsThemeColors } from "./accounts-shared";
import { useTheme } from "./theme-ctx";

export type RichTextTheme = {
  text: string;
  muted: string;
  dim: string;
  accent: string;
  inputBg: string;
  inputBdr: string;
  tableSep: string;
  isDark: boolean;
};

export function richTextThemeFromAccounts(
  C: AccountsThemeColors,
  accent: string,
  isDark: boolean,
): RichTextTheme {
  return {
    text: C.txtPrimary,
    muted: C.txtSecondary,
    dim: C.txtMuted,
    accent,
    inputBg: isDark ? "#11100d" : C.inputBg,
    inputBdr: C.inputBdr,
    tableSep: C.tableSep,
    isDark,
  };
}

function richTextContentStyles(T: RichTextTheme, className: string) {
  return `
    .${className} p { margin: 0 0 10px; }
    .${className} h3, .${className} h4, .${className} h5 {
      margin: 0 0 8px;
      color: ${T.text};
      font-weight: 700;
      line-height: 1.35;
    }
    .${className} ul, .${className} ol {
      margin: 0 0 10px;
      padding-left: 18px;
    }
    .${className} li { margin-bottom: 4px; }
    .${className} a { color: ${T.accent}; text-decoration: underline; }
    .${className} blockquote {
      margin: 0 0 10px;
      padding: 8px 12px;
      border-left: 3px solid ${hexA(T.accent, 0.45)};
      background: ${hexA(T.accent, T.isDark ? 0.06 : 0.04)};
      border-radius: 0 8px 8px 0;
    }
    [contenteditable].${className}-editor h3 { font-size: 15px; font-weight: 700; margin: 8px 0 6px; }
    [contenteditable].${className}-editor ul,
    [contenteditable].${className}-editor ol { margin: 6px 0; padding-left: 20px; }
    [contenteditable].${className}-editor a { color: ${T.accent}; text-decoration: underline; }
  `;
}

export function RichTextContent({
  content,
  theme,
  className = "lmsbr-rich-text",
  fontSize = 14,
}: {
  content: string;
  theme: RichTextTheme;
  className?: string;
  fontSize?: number;
}) {
  if (!content.trim()) return null;

  const html = isHtmlContent(content) ? sanitizeRichHtml(content) : plainToHtml(content);

  return (
    <>
      <div
        className={className}
        style={{
          fontFamily: "var(--font-outfit)",
          wordBreak: "break-word",
          color: theme.muted,
          fontSize,
          lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{richTextContentStyles(theme, className)}</style>
    </>
  );
}

type ToolbarAction = {
  id: string;
  title: string;
  label: string;
  group: string;
  command?: string;
  value?: string;
};

function ToolbarIcon({ id }: { id: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "link") {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
        <path {...common} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path {...common} d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    );
  }
  if (id === "list") {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
        <path {...common} d="M9 6h12M9 12h12M9 18h12" />
        <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "ordered") {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
        <path {...common} d="M11 6h10M11 12h10M11 18h10" />
        <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="var(--font-outfit)" fontWeight="700">1</text>
        <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="var(--font-outfit)" fontWeight="700">2</text>
        <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="var(--font-outfit)" fontWeight="700">3</text>
      </svg>
    );
  }
  return null;
}

function ToolbarButton({
  action,
  active,
  disabled,
  onClick,
  theme: T,
}: {
  action: ToolbarAction;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  theme: RichTextTheme;
}) {
  const [hover, setHover] = useState(false);
  const on = active || hover;

  return (
    <button
      type="button"
      title={action.title}
      aria-label={action.title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 30,
        height: 30,
        padding: "0 7px",
        borderRadius: 7,
        border: `1px solid ${on && !disabled ? hexA(T.accent, 0.35) : "transparent"}`,
        background: active
          ? hexA(T.accent, T.isDark ? 0.18 : 0.12)
          : on && !disabled
            ? hexA(T.accent, T.isDark ? 0.1 : 0.07)
            : "transparent",
        color: disabled ? T.dim : active ? T.accent : T.muted,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: action.id === "bold" ? "var(--font-outfit)" : "inherit",
        fontSize: action.id === "bold" ? 13 : action.id === "italic" ? 13 : 12,
        fontWeight: action.id === "bold" ? 800 : 600,
        fontStyle: action.id === "italic" ? "italic" : "normal",
        textDecoration: action.id === "underline" ? "underline" : "none",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >
      {action.id === "link" || action.id === "list" || action.id === "ordered" ? (
        <ToolbarIcon id={action.id} />
      ) : (
        action.label
      )}
    </button>
  );
}

export function RichTextField({
  value,
  onChange,
  disabled,
  placeholder = "Write here…",
  theme,
  ariaLabel = "Rich text editor",
  minHeight = 140,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  theme: RichTextTheme;
  ariaLabel?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef("");
  const [focused, setFocused] = useState(false);
  const [empty, setEmpty] = useState(!value.trim());
  const className = "lmsbr-rich-text";

  const applyValueToEditor = useCallback((nextValue: string) => {
    const el = editorRef.current;
    if (!el) return;

    const nextHtml = valueToEditorHtml(nextValue);
    const nextNormalized = nextHtml ? normalizeEditorHtml(nextHtml) : "";
    const currentNormalized = normalizeEditorHtml(el.innerHTML);

    if (currentNormalized === nextNormalized) {
      lastHtmlRef.current = nextNormalized;
      setEmpty(!nextNormalized.trim());
      return;
    }

    el.innerHTML = nextHtml;
    lastHtmlRef.current = nextNormalized;
    setEmpty(!nextNormalized.trim());
  }, []);

  const syncFromEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = normalizeEditorHtml(el.innerHTML);
    const isEmpty = !html.trim();
    setEmpty(isEmpty);
    if (html !== lastHtmlRef.current) {
      lastHtmlRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  useLayoutEffect(() => {
    applyValueToEditor(value);
  }, [value, applyValueToEditor]);

  const runCommand = useCallback((command: string, val?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    syncFromEditor();
  }, [disabled, syncFromEditor]);

  const insertLink = useCallback(() => {
    if (disabled) return;
    const url = window.prompt("Enter link URL", "https://");
    if (!url) return;
    runCommand("createLink", url);
  }, [disabled, runCommand]);

  const actions: ToolbarAction[] = [
    { id: "bold", label: "B", title: "Bold", group: "style", command: "bold" },
    { id: "italic", label: "I", title: "Italic", group: "style", command: "italic" },
    { id: "underline", label: "U", title: "Underline", group: "style", command: "underline" },
    { id: "heading", label: "H", title: "Heading", group: "block", command: "formatBlock", value: "h3" },
    { id: "list", label: "•", title: "Bullet list", group: "block", command: "insertUnorderedList" },
    { id: "ordered", label: "1.", title: "Numbered list", group: "block", command: "insertOrderedList" },
    { id: "link", label: "link", title: "Insert link", group: "insert" },
    { id: "clear", label: "⌫", title: "Clear formatting", group: "insert", command: "removeFormat" },
  ];

  const groups = ["style", "block", "insert"];

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${focused ? theme.accent : theme.inputBdr}`,
        background: theme.inputBg,
        overflow: "hidden",
        boxShadow: focused ? `0 0 0 3px ${hexA(theme.accent, 0.12)}` : "none",
        transition: "border-color .2s, box-shadow .2s",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          padding: "6px 8px",
          borderBottom: `1px solid ${theme.tableSep}`,
          background: theme.isDark ? "rgba(255,255,255,.02)" : "rgba(248,250,252,.95)",
        }}
      >
        {groups.map((group, gi) => (
          <div key={group} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {gi > 0 && (
              <div style={{ width: 1, height: 18, background: theme.tableSep, margin: "0 2px" }} />
            )}
            {actions.filter((a) => a.group === group).map((action) => (
              <ToolbarButton
                key={action.id}
                action={action}
                disabled={disabled}
                theme={theme}
                onClick={() => {
                  if (action.id === "link") insertLink();
                  else if (action.command) runCommand(action.command, action.value);
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ position: "relative", minHeight }}>
        {empty && !focused && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 12,
              left: 14,
              right: 14,
              color: theme.dim,
              fontSize: 14,
              fontFamily: "var(--font-outfit)",
              pointerEvents: "none",
              lineHeight: 1.55,
            }}
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label={ariaLabel}
          className={`${className}-editor`}
          onInput={syncFromEditor}
          onBlur={() => { setFocused(false); syncFromEditor(); }}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); runCommand("bold"); }
            if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); runCommand("italic"); }
            if ((e.metaKey || e.ctrlKey) && e.key === "u") { e.preventDefault(); runCommand("underline"); }
          }}
          style={{
            minHeight,
            padding: "12px 14px",
            outline: "none",
            color: theme.text,
            fontFamily: "var(--font-outfit)",
            fontSize: 14,
            lineHeight: 1.6,
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
      </div>

      <style>{richTextContentStyles(theme, className)}</style>
    </div>
  );
}

export function AccountsRichTextContent({
  content,
  C,
  accent,
  isDark,
  fontSize,
}: {
  content: string;
  C: AccountsThemeColors;
  accent: string;
  isDark: boolean;
  fontSize?: number;
}) {
  return (
    <RichTextContent
      content={content}
      theme={richTextThemeFromAccounts(C, accent, isDark)}
      fontSize={fontSize}
    />
  );
}

export function AccountsRichTextField({
  value,
  onChange,
  disabled,
  placeholder,
  C,
  accent,
  ariaLabel,
  minHeight,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  C: AccountsThemeColors;
  accent: string;
  ariaLabel?: string;
  minHeight?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const richTheme = richTextThemeFromAccounts(C, accent, isDark);

  return (
    <RichTextField
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      theme={richTheme}
      ariaLabel={ariaLabel}
      minHeight={minHeight}
    />
  );
}
