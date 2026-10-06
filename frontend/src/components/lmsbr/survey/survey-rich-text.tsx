"use client";

import { RichTextContent, RichTextField } from "../rich-text-field";
import { useSurveyTheme } from "./survey-theme";

export {
  isHtmlContent,
  normalizeEditorHtml,
  plainToHtml,
  sanitizeRichHtml,
  sanitizeRichHtml as sanitizeSurveyHtml,
  valueToEditorHtml,
} from "@/lib/lmsbr/rich-text";

export function SurveyRichTextContent({ content }: { content: string }) {
  const T = useSurveyTheme();
  return (
    <RichTextContent
      content={content}
      theme={{
        text: T.text,
        muted: T.muted,
        dim: T.dim,
        accent: T.accent,
        inputBg: T.inputBg,
        inputBdr: T.inputBdr,
        tableSep: T.tableSep,
        isDark: T.isDark,
      }}
      className="survey-rich-text-content"
      fontSize={13}
    />
  );
}

export function SurveyRichTextField({
  value,
  onChange,
  disabled,
  placeholder = "Write a description…",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const T = useSurveyTheme();

  return (
    <RichTextField
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      ariaLabel="Survey description"
      theme={{
        text: T.text,
        muted: T.muted,
        dim: T.dim,
        accent: T.accent,
        inputBg: T.inputBg,
        inputBdr: T.inputBdr,
        tableSep: T.tableSep,
        isDark: T.isDark,
      }}
    />
  );
}
