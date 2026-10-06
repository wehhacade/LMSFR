"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { hexA } from "@/lib/lmsbr/data";
import { useSurvey, useSurveyResponses } from "@/hooks/use-surveys";
import {
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useReorderQuestions,
  useCreateChoice,
  useCreateChoicesBulk,
  useUpdateChoice,
  useDeleteChoice,
} from "@/hooks/use-surveys-builder";
import { publishSurvey } from "@/lib/surveys-builder-api";
import { loadSurveyModuleSettings } from "@/lib/survey-module-settings";
import type { Choice, Question, SurveyDetail, SurveySection } from "@/types/surveys";
import { CHOICE_QTYPES, QTYPE_LABELS, type QType } from "@/types/surveys-builder";
import {
  PulseShell,
  StatusBadge,
  useSurveyTheme,
} from "./survey-pulse-ui";
import {
  SurveyEmptyState,
  SurveyPanel,
  SurveyPanelHeader,
  surveyPanelHeadBg,
} from "./survey-layout";
import type { SurveyThemeColors } from "./survey-theme";
import { Icon } from "../icon";
import { SurveySelect } from "./survey-select";
import { SurveyRichTextContent } from "./survey-rich-text";
import { SurveyConfirmDialog } from "./survey-form-modal";
import { ImportSurveyXlsxModal } from "./survey-import-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

// ─── tabs ─────────────────────────────────────────────────────────────────────

type ProfileTab = "overview" | "questionnaire";

function SurveyProfileTabs({
  active,
  onChange,
  C,
  accent,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  C: SurveyThemeColors;
  accent: string;
}) {
  const tabs: { id: ProfileTab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "questionnaire", label: "Questionnaire", icon: "list" },
  ];

  return (
    <div style={{
      display: "flex",
      gap: 4,
      borderBottom: `1px solid ${C.tableSep}`,
      marginBottom: 20,
      overflowX: "auto",
    }}>
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              marginBottom: -1,
              border: "none",
              borderBottom: `2px solid ${on ? accent : "transparent"}`,
              cursor: "pointer",
              fontFamily: "var(--font-cinzel)",
              fontSize: 14,
              fontWeight: 600,
              transition: ".2s",
              background: "transparent",
              color: on ? accent : C.txtMuted,
              whiteSpace: "nowrap",
            }}
          >
            <Icon name={tab.icon} size={15} sw={on ? 2 : 1.7} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ProfileKpiStrip({
  C, accent, isDark, items,
}: {
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
  items: { label: string; value: string; hint: string; icon: string }[];
}) {
  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      borderRadius: 14,
      border: `1px solid ${C.cardBdr}`,
      background: C.cardBg,
      boxShadow: C.cardShadow,
      marginBottom: 16,
    }}>
      {!isDark && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.4)})`,
          borderRadius: "14px 14px 0 0",
        }} />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {items.map((k, i) => (
          <div
            key={k.label}
            style={{
              padding: "22px 20px",
              borderRight: i < items.length - 1 ? `1px solid ${C.tableSep}` : undefined,
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: hexA(accent, 0.14), color: accent,
              border: `1px solid ${hexA(accent, 0.25)}`,
            }}>
              <Icon name={k.icon} size={22} sw={1.8} />
            </div>
            <div style={{
              fontFamily: "var(--font-cinzel)", fontWeight: 700, fontSize: 34,
              color: C.txtPrimary, marginTop: 18, lineHeight: 1,
            }}>
              {k.value}
            </div>
            <div style={{ fontSize: 13, color: C.txtMuted, marginTop: 8, letterSpacing: ".02em" }}>{k.label}</div>
            <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 4 }}>{k.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value, C }: { label: string; value: ReactNode; C: SurveyThemeColors }) {
  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 10,
      border: `1px solid ${C.tableSep}`,
      background: C.inputBg,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: C.txtMuted,
        marginBottom: 6,
        fontFamily: "var(--font-outfit)",
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.txtPrimary, fontFamily: "var(--font-outfit)" }}>
        {value}
      </div>
    </div>
  );
}

function SectionDistribution({
  sections,
  C,
  accent,
}: {
  sections: SurveySection[];
  C: SurveyThemeColors;
  accent: string;
}) {
  const max = Math.max(...sections.map(s => s.questions.length), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
      {sections.map((s, i) => {
        const pct = Math.round((s.questions.length / max) * 100);
        return (
          <div key={s.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: C.txtSecondary, fontFamily: "var(--font-outfit)" }}>
                {i + 1}. {s.title || `Section ${i + 1}`}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.txtPrimary }}>{s.questions.length}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: hexA(accent, 0.12), overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${hexA(accent, 0.65)}, ${accent})`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SurveyOverviewTab({
  survey,
  totalResponses,
  totalQuestions,
  sectionCount,
  publishErrors,
  onGoQuestionnaire,
  C,
  accent,
  isDark,
}: {
  survey: SurveyDetail;
  totalResponses: number;
  totalQuestions: number;
  sectionCount: number;
  publishErrors: string[];
  onGoQuestionnaire: () => void;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const createdDate = new Date(survey.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const updatedDate = new Date(survey.updated_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const kpis = [
    {
      label: "Responses",
      value: totalResponses.toLocaleString(),
      hint: totalResponses > 0 ? "Collected so far" : "No responses yet",
      icon: "chart",
    },
    {
      label: "Sections",
      value: String(sectionCount),
      hint: `${totalQuestions} question${totalQuestions !== 1 ? "s" : ""} total`,
      icon: "grid",
    },
    {
      label: "Questions",
      value: String(totalQuestions),
      hint: sectionCount > 0 ? `Across ${sectionCount} section${sectionCount !== 1 ? "s" : ""}` : "Not built yet",
      icon: "list",
    },
    {
      label: "Status",
      value: survey.status.charAt(0).toUpperCase() + survey.status.slice(1),
      hint: survey.allow_multiple_submissions ? "Multi-submit enabled" : "Single submission",
      icon: survey.status === "live" ? "clipboard" : survey.status === "draft" ? "file" : "archive",
    },
  ];

  return (
    <>
      <ProfileKpiStrip C={C} accent={accent} isDark={isDark} items={kpis} />

      {publishErrors.length > 0 && (
        <div style={{
          marginBottom: 16, padding: "14px 18px", borderRadius: 11,
          background: "rgba(224,101,90,0.08)", border: "1px solid rgba(224,101,90,0.25)",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <Icon name="alert" size={18} sw={1.8} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#c44a3f", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
              Fix before publishing
            </div>
            <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
              {publishErrors.map((e, i) => (
                <li key={i} style={{ fontSize: 13, color: "#c44a3f", marginBottom: 3, lineHeight: 1.45 }}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="survey-overview-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1fr)", gap: 16 }}>
        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title="About this survey"
            sub="Description and metadata"
          />
          <div style={{ padding: "22px 24px" }}>
            {survey.description ? (
              <div style={{ margin: "0 0 20px", lineHeight: 1.6 }}>
                <SurveyRichTextContent content={survey.description} />
              </div>
            ) : (
              <p style={{ fontSize: 14, color: C.txtMuted, lineHeight: 1.6, margin: "0 0 20px", fontStyle: "italic" }}>
                No description provided.
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <DetailRow C={C} label="Created" value={createdDate} />
              <DetailRow C={C} label="Last updated" value={updatedDate} />
              <DetailRow C={C} label="Author" value={survey.created_by_name ?? "—"} />
              <DetailRow
                C={C}
                label="Submissions"
                value={survey.allow_multiple_submissions ? "Multiple allowed" : "One per respondent"}
              />
            </div>
          </div>
        </SurveyPanel>

        <SurveyPanel C={C} accent={accent} isDark={isDark}>
          <SurveyPanelHeader
            C={C}
            accent={accent}
            isDark={isDark}
            title="Questionnaire structure"
            sub={sectionCount === 0
              ? "No sections yet"
              : `${sectionCount} section${sectionCount !== 1 ? "s" : ""} · ${totalQuestions} questions`}
            actions={(
              <button
                type="button"
                onClick={onGoQuestionnaire}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 14px", borderRadius: 10,
                  border: `1px solid ${hexA(accent, 0.35)}`,
                  background: hexA(accent, isDark ? 0.12 : 0.08),
                  color: accent,
                  fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                {sectionCount === 0 ? "Build" : "Edit"}
                <Icon name="arrow" size={13} sw={2.1} />
              </button>
            )}
          />
          <div style={{ padding: "20px 24px 24px" }}>
            {survey.sections.length === 0 ? (
              <SurveyEmptyState
                C={C}
                accent={accent}
                icon="list"
                title="Empty questionnaire"
                message="Add sections and questions to prepare this survey for publishing."
                action={(
                  <button
                    type="button"
                    onClick={onGoQuestionnaire}
                    style={{
                      padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: `linear-gradient(135deg, ${hexA(accent, 0.9)}, ${accent})`,
                      color: "#fff", fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 600,
                      boxShadow: `0 4px 14px -4px ${hexA(accent, 0.55)}`,
                    }}
                  >
                    Start building
                  </button>
                )}
              />
            ) : (
              <SectionDistribution sections={survey.sections} C={C} accent={accent} />
            )}
          </div>
        </SurveyPanel>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .survey-overview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

function SurveyQuestionnaireTab({
  survey,
  surveyId,
  sectionCount,
  totalQuestions,
  onAddSection,
  addSectionPending,
  allowEdit,
  C,
  accent,
  isDark,
}: {
  survey: SurveyDetail;
  surveyId: number;
  sectionCount: number;
  totalQuestions: number;
  onAddSection: () => void;
  addSectionPending: boolean;
  allowEdit: boolean;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  return (
    <SurveyPanel C={C} accent={accent} isDark={isDark}>
      <SurveyPanelHeader
        C={C}
        accent={accent}
        isDark={isDark}
        title="Sections & questions"
        sub={`${sectionCount} section${sectionCount !== 1 ? "s" : ""} · ${totalQuestions} question${totalQuestions !== 1 ? "s" : ""}`}
        actions={allowEdit ? (
          <ActionBtn onClick={onAddSection} disabled={addSectionPending} variant="primary" accent={accent}>
            + Add section
          </ActionBtn>
        ) : undefined}
      />
      <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {sectionCount === 0 && (
          <SurveyEmptyState
            C={C}
            accent={accent}
            icon="list"
            title="No sections yet"
            message="Add a section to start building your questionnaire. Each section groups related questions."
            action={allowEdit ? (
              <ActionBtn onClick={onAddSection} disabled={addSectionPending} variant="primary" accent={accent}>
                + Add first section
              </ActionBtn>
            ) : undefined}
          />
        )}
        {survey.sections.map((s, i) => (
          <SectionCard key={s.id} section={s} idx={i} surveyId={surveyId} allowEdit={allowEdit} C={C} accent={accent} isDark={isDark} />
        ))}
      </div>
    </SurveyPanel>
  );
}

// ─── shared micro-components ──────────────────────────────────────────────────

function ActionBtn({
  children, onClick, disabled, variant = "ghost", small, accent: accentProp,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger" | "accent";
  small?: boolean;
  accent?: string;
}) {
  const T = useSurveyTheme();
  const accent = accentProp ?? T.accent;
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: small ? "8px 14px" : "10px 18px",
    borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--font-outfit)", fontSize: small ? 13 : 14, fontWeight: 600,
    opacity: disabled ? 0.5 : 1, transition: ".2s",
  };
  if (variant === "primary")
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          ...base,
          background: `linear-gradient(135deg, ${hexA(accent, 0.92)}, ${accent})`,
          color: "#fff",
          boxShadow: disabled ? "none" : `0 4px 14px -4px ${hexA(accent, 0.55)}`,
        }}
      >
        {children}
      </button>
    );
  if (variant === "danger")
    return <button onClick={onClick} disabled={disabled} style={{ ...base, background: "rgba(224,101,90,0.1)", color: "#c44a3f", border: "1px solid rgba(224,101,90,0.25)" }}>{children}</button>;
  if (variant === "accent")
    return <button onClick={onClick} disabled={disabled} style={{ ...base, background: hexA(accent, 0.1), color: accent, border: `1px solid ${hexA(accent, 0.28)}` }}>{children}</button>;
  return <button onClick={onClick} disabled={disabled} style={{ ...base, background: T.inputBg, color: T.muted, border: `1px solid ${T.cardBdr}` }}>{children}</button>;
}

function FieldInput({
  value, onChange, placeholder, disabled, multiline, rows,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; multiline?: boolean; rows?: number;
}) {
  const T = useSurveyTheme();
  const [focused, setFocused] = useState(false);
  const base: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${focused ? T.accent : T.inputBdr}`,
    background: T.inputBg,
    color: T.text, fontFamily: "var(--font-outfit)", fontSize: 14,
    outline: "none", boxSizing: "border-box",
    opacity: disabled ? 0.5 : 1,
    transition: "border-color .2s, box-shadow .2s",
    boxShadow: focused ? `0 0 0 3px ${T.accentSoft}` : "none",
  };
  if (multiline)
    return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} rows={rows ?? 2} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ ...base, resize: "vertical" }} />;
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={base} />;
}

function FieldSelect({
  value, onChange, options, disabled,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  const T = useSurveyTheme();
  return <SurveySelect T={T} value={value} onChange={onChange} options={options} disabled={disabled} />;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const T = useSurveyTheme();
  return (
    <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 38, height: 22, borderRadius: 11, background: on ? T.accent : T.track, position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
      </div>
      <span style={{ fontSize: 13, color: T.muted, fontFamily: "var(--font-outfit)" }}>{on ? "Required" : "Optional"}</span>
    </button>
  );
}

function QTypeBadge({ qtype }: { qtype: string }) {
  const T = useSurveyTheme();
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
      background: hexA(T.accent, 0.12), color: T.accent,
      border: `1px solid ${hexA(T.accent, 0.22)}`,
      textTransform: "uppercase", letterSpacing: ".05em",
      fontFamily: "var(--font-outfit)",
    }}>
      {QTYPE_LABELS[qtype as QType] ?? qtype}
    </span>
  );
}

const NUMERIC_QTYPES = new Set<QType>(["integer", "decimal", "rating"]);

function ChoiceRow({ choice, surveyId, allowEdit }: { choice: Choice; surveyId: number; allowEdit: boolean }) {
  const T = useSurveyTheme();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(choice.label);
  const [value, setValue] = useState(choice.value);
  const [isOther, setIsOther] = useState(Boolean(choice.is_other));
  const update = useUpdateChoice(surveyId);
  const del = useDeleteChoice(surveyId);

  function save() {
    update.mutate(
      { id: choice.id, payload: { label, value, is_other: isOther } },
      { onSuccess: () => setEditing(false) },
    );
  }

  if (editing) return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", padding: "10px 12px", borderRadius: 8, background: T.inputBg, border: `1px solid ${T.accent}40` }}>
      <div style={{ flex: 2, minWidth: 140 }}>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Label</div>
        <FieldInput value={label} onChange={setLabel} placeholder="Label" />
      </div>
      <div style={{ flex: 1, minWidth: 100 }}>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Value</div>
        <FieldInput value={value} onChange={setValue} placeholder="value" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, paddingBottom: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={isOther} onChange={(e) => setIsOther(e.target.checked)} />
        Other / Wax kale
      </label>
      <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
        <ActionBtn onClick={save} disabled={update.isPending} variant="primary" small>Save</ActionBtn>
        <ActionBtn onClick={() => { setLabel(choice.label); setValue(choice.value); setIsOther(Boolean(choice.is_other)); setEditing(false); }} small>✕</ActionBtn>
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", borderRadius: 10,
      background: T.isDark ? "rgba(255,255,255,.03)" : T.inputBg,
      border: `1px solid ${choice.is_other ? hexA("#d97706", 0.35) : T.tableSep}`,
    }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${hexA(T.accent, 0.45)}`, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 500 }}>
        {choice.label}
        {choice.is_other ? (
          <span style={{
            marginLeft: 8,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color: "#d97706",
            background: "rgba(217,119,6,0.12)",
            border: "1px solid rgba(217,119,6,0.28)",
            borderRadius: 999,
            padding: "2px 7px",
          }}>
            + text
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 11, color: T.dim, fontFamily: "monospace" }}>{choice.value}</span>
      {allowEdit && (
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: T.accent, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", fontWeight: 600 }}>Edit</button>
          <button onClick={() => del.mutate(choice.id)} disabled={del.isPending} style={{ fontSize: 12, color: "#c44a3f", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
      )}
    </div>
  );
}

function AddChoiceForm({ questionId, currentCount, surveyId, hasOther }: { questionId: number; currentCount: number; surveyId: number; hasOther: boolean }) {
  const T = useSurveyTheme();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [labelsText, setLabelsText] = useState("");
  const create = useCreateChoice(surveyId);
  const createBulk = useCreateChoicesBulk(surveyId);
  const labelRef = useRef<HTMLInputElement>(null);

  function reset() {
    setLabel("");
    setValue("");
    setIsOther(false);
    setLabelsText("");
    setMode("single");
    setOpen(false);
  }

  function submit() {
    const labels =
      mode === "bulk"
        ? labelsText.split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean)
        : label.trim()
          ? [label.trim()]
          : [];
    if (!labels.length) return;

    if (labels.length === 1) {
      create.mutate(
        {
          question: questionId,
          label: labels[0],
          value: value.trim() || labels[0].toLowerCase().replace(/\s+/g, "_"),
          order: currentCount,
          is_other: isOther,
        },
        { onSuccess: reset },
      );
      return;
    }

    createBulk.mutate(
      { question: questionId, labels, start_order: currentCount },
      { onSuccess: reset },
    );
  }

  function addWaxKale() {
    if (hasOther) return;
    create.mutate(
      {
        question: questionId,
        label: "Wax kale",
        value: "wax_kale",
        order: currentCount,
        is_other: true,
      },
      { onSuccess: reset },
    );
  }

  if (!open)
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => { setOpen(true); setTimeout(() => labelRef.current?.focus(), 50); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: `1px dashed ${T.accent}50`, background: "transparent", color: T.accent, fontFamily: "var(--font-outfit)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Add choice
        </button>
        {!hasOther && (
          <button
            type="button"
            onClick={addWaxKale}
            disabled={create.isPending}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "1px dashed rgba(217,119,6,0.45)", background: "rgba(217,119,6,0.08)", color: "#d97706", fontFamily: "var(--font-outfit)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + Wax kale (text)
          </button>
        )}
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px", borderRadius: 8, background: T.inputBg, border: `1px solid ${T.accent}40` }}>
      <div style={{ display: "inline-flex", gap: 6, padding: 3, borderRadius: 9, background: T.track, width: "fit-content" }}>
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: mode === m ? T.accentSoft : "transparent",
              color: mode === m ? T.accent : T.muted,
            }}
          >
            {m === "single" ? "Single" : "Add many"}
          </button>
        ))}
      </div>
      {mode === "single" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Label *</div>
            <input ref={labelRef} value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Choice label" style={{ width: "100%", padding: "8px 11px", borderRadius: 8, border: `1px solid ${T.inputBdr}`, background: T.inputBg, color: T.text, fontFamily: "var(--font-outfit)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Value</div>
            <FieldInput value={value} onChange={setValue} placeholder="auto" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, paddingBottom: 8, cursor: hasOther ? "not-allowed" : "pointer", opacity: hasOther ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={isOther}
              disabled={hasOther}
              onChange={(e) => setIsOther(e.target.checked)}
            />
            Other / Wax kale (+ text)
          </label>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Choices (one per line or comma-separated) *</div>
          <FieldInput value={labelsText} onChange={setLabelsText} placeholder={"Option A\nOption B\nOption C"} multiline rows={3} />
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <ActionBtn
          onClick={submit}
          disabled={(create.isPending || createBulk.isPending) || (mode === "single" ? !label.trim() : !labelsText.trim())}
          variant="primary"
          small
        >
          {mode === "bulk" ? "Add choices" : "Add"}
        </ActionBtn>
        <ActionBtn onClick={reset} small>✕</ActionBtn>
      </div>
    </div>
  );
}

// ─── question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  surveyId,
  allowEdit,
  orderNumber,
  canReorder,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  question: Question;
  surveyId: number;
  allowEdit: boolean;
  orderNumber?: number;
  canReorder?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const T = useSurveyTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [helpText, setHelpText] = useState(question.help_text);
  const [qtype, setQtype] = useState<QType>(question.qtype as QType);
  const [required, setRequired] = useState(question.required);
  const [minValue, setMinValue] = useState(question.min_value ?? "");
  const [maxValue, setMaxValue] = useState(question.max_value ?? "");
  const update = useUpdateQuestion(surveyId);
  const del = useDeleteQuestion(surveyId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const needsChoices = CHOICE_QTYPES.has(question.qtype as QType);
  const needsBounds = NUMERIC_QTYPES.has(question.qtype as QType);

  useEffect(() => {
    setText(question.text);
    setHelpText(question.help_text);
    setQtype(question.qtype as QType);
    setRequired(question.required);
    setMinValue(question.min_value ?? "");
    setMaxValue(question.max_value ?? "");
  }, [question]);

  function save() {
    update.mutate({
      id: question.id,
      payload: {
        text,
        help_text: helpText,
        qtype,
        required,
        min_value: NUMERIC_QTYPES.has(qtype) && minValue.trim() ? minValue.trim() : null,
        max_value: NUMERIC_QTYPES.has(qtype) && maxValue.trim() ? maxValue.trim() : null,
      },
    }, { onSuccess: () => setEditing(false) });
  }

  return (
    <div
      onDragOver={canReorder && allowEdit ? onDragOver : undefined}
      onDrop={canReorder && allowEdit ? onDrop : undefined}
      style={{
        borderRadius: 12,
        border: `2px solid ${isDropTarget ? T.accent : "transparent"}`,
        outline: `1px solid ${T.tableSep}`,
        background: T.isDark ? "rgba(255,255,255,.02)" : "#fff",
        overflow: "hidden",
        boxShadow: T.isDark ? "none" : "0 1px 3px rgba(15,23,42,0.04)",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity .15s, border-color .15s",
      }}
    >
      <SurveyConfirmDialog
        open={confirmDelete}
        title="Delete question?"
        message={`"${question.text}" will be permanently removed along with its choices.`}
        confirmLabel="Delete question"
        onConfirm={() => del.mutate(question.id, { onSuccess: () => setConfirmDelete(false) })}
        onCancel={() => setConfirmDelete(false)}
        pending={del.isPending}
      />
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "16px 18px",
        borderBottom: needsChoices || editing ? `1px solid ${T.tableSep}` : "none",
        background: T.isDark ? "transparent" : hexA(T.accent, 0.03),
      }}>
        {allowEdit && canReorder && (
          <div
            draggable={!editing}
            onDragStart={(e) => {
              if (editing) { e.preventDefault(); return; }
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", "q");
              onDragStart?.();
            }}
            onDragEnd={onDragEnd}
            title="Drag to reorder"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: T.dim, cursor: editing ? "default" : "grab", userSelect: "none",
              padding: "6px 8px", borderRadius: 8, flexShrink: 0,
              border: `1px solid ${T.tableSep}`,
              background: T.isDark ? "rgba(255,255,255,.04)" : "#fff",
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>⠿</span>
            {orderNumber != null && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: T.accent,
                fontFamily: "var(--font-cinzel)",
              }}>
                {orderNumber}
              </span>
            )}
          </div>
        )}
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: hexA(T.accent, 0.14), border: `1px solid ${hexA(T.accent, 0.22)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: T.accent, flexShrink: 0,
        }}>
          Q
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Question text *</div>
                <FieldInput value={text} onChange={setText} placeholder="Enter question text" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Help text</div>
                <FieldInput value={helpText} onChange={setHelpText} placeholder="Optional hint" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Type</div>
                  <FieldSelect value={qtype} onChange={v => setQtype(v as QType)} options={Object.entries(QTYPE_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <Toggle on={required} onToggle={() => setRequired(v => !v)} />
                </div>
              </div>
              {NUMERIC_QTYPES.has(qtype) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.dim, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Min value</div>
                    <FieldInput value={minValue} onChange={setMinValue} placeholder="Optional" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.dim, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Max value</div>
                    <FieldInput value={maxValue} onChange={setMaxValue} placeholder="Optional" />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <ActionBtn onClick={save} disabled={update.isPending || !text.trim()} variant="primary" small>Save question</ActionBtn>
                <ActionBtn onClick={() => { setText(question.text); setHelpText(question.help_text); setQtype(question.qtype as QType); setRequired(question.required); setMinValue(question.min_value ?? ""); setMaxValue(question.max_value ?? ""); setEditing(false); }} small>Cancel</ActionBtn>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{question.text}</span>
                {question.required && <span style={{ color: "#ef4444", fontSize: 13 }}>*</span>}
                <QTypeBadge qtype={question.qtype} />
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: question.required ? "rgba(239,68,68,.1)" : hexA(T.accent, 0.1),
                  color: question.required ? "#ef4444" : T.accent,
                }}>
                  {question.required ? "Required" : "Optional"}
                </span>
              </div>
              {question.help_text && <p style={{ fontSize: 12, color: T.dim, margin: "2px 0 0" }}>{question.help_text}</p>}
              {needsBounds && (question.min_value || question.max_value) && (
                <p style={{ fontSize: 11, color: T.dim, margin: "4px 0 0" }}>
                  Range: {question.min_value ?? "—"} to {question.max_value ?? "—"}
                </p>
              )}
            </div>
          )}
        </div>
        {!editing && allowEdit && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: T.accent, background: "none", border: "none", cursor: "pointer", padding: "2px 7px" }}>Edit</button>
            <button onClick={() => setConfirmDelete(true)} disabled={del.isPending} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 7px" }}>Delete</button>
          </div>
        )}
      </div>

      {/* Choices */}
      {needsChoices && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>
            Choices ({question.choices.length})
          </div>
          {question.choices.map(c => <ChoiceRow key={c.id} choice={c} surveyId={surveyId} allowEdit={allowEdit} />)}
          {allowEdit && (
            <AddChoiceForm
              questionId={question.id}
              currentCount={question.choices.length}
              surveyId={surveyId}
              hasOther={question.choices.some((c) => c.is_other)}
            />
          )}
          {allowEdit && question.choices.length < 2 && (
            <p style={{ fontSize: 12, color: "#f59e0b", margin: 0 }}>⚠ Add at least 2 choices before publishing.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AddQuestionForm({ sectionId, currentCount, surveyId }: { sectionId: number; currentCount: number; surveyId: number }) {
  const T = useSurveyTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [qtype, setQtype] = useState<QType>("short_text");
  const [required, setRequired] = useState(true);
  const create = useCreateQuestion(surveyId);
  const textRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!text.trim()) return;
    create.mutate(
      { section: sectionId, text: text.trim(), qtype, required, order: currentCount },
      { onSuccess: () => { setText(""); setQtype("short_text"); setRequired(true); setOpen(false); } },
    );
  }

  if (!open)
    return (
      <button onClick={() => { setOpen(true); setTimeout(() => textRef.current?.focus(), 50); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1px dashed ${T.accent}50`, background: "transparent", color: T.accent, fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
        + Add question
      </button>
    );

  return (
    <div style={{ padding: "14px 16px", borderRadius: 10, border: `1px solid ${T.accent}40`, background: T.inputBg }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>New question</div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Question text *</div>
        <input ref={textRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="What do you want to ask?" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.inputBdr}`, background: T.card, color: T.text, fontFamily: "var(--font-outfit)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Type</div>
          <FieldSelect value={qtype} onChange={v => setQtype(v as QType)} options={Object.entries(QTYPE_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
        </div>
        <Toggle on={required} onToggle={() => setRequired(v => !v)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <ActionBtn onClick={submit} disabled={create.isPending || !text.trim()} variant="primary" small>Add question</ActionBtn>
        <ActionBtn onClick={() => { setText(""); setOpen(false); }} small>Cancel</ActionBtn>
      </div>
    </div>
  );
}

// ─── section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section, idx, surveyId, allowEdit, C, accent, isDark,
}: {
  section: SurveySection;
  idx: number;
  surveyId: number;
  allowEdit: boolean;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const T = useSurveyTheme();
  const [open, setOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);
  const update = useUpdateSection(surveyId);
  const del = useDeleteSection(surveyId);
  const reorder = useReorderQuestions(surveyId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const dragFromId = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [orderedQuestions, setOrderedQuestions] = useState<Question[]>(() =>
    [...section.questions].sort((a, b) => a.order - b.order || a.id - b.id),
  );
  const [orderDirty, setOrderDirty] = useState(false);

  useEffect(() => {
    if (orderDirty) return;
    setOrderedQuestions(
      [...section.questions].sort((a, b) => a.order - b.order || a.id - b.id),
    );
  }, [section.questions, orderDirty]);

  useEffect(() => {
    if (!orderDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [orderDirty]);

  function saveTitle() {
    update.mutate({ id: section.id, payload: { title } }, { onSuccess: () => setEditingTitle(false) });
  }

  function handleDragStart(questionId: number) {
    dragFromId.current = questionId;
    setDraggingId(questionId);
    setDropTargetIdx(null);
  }

  function handleDragOver(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetIdx(targetIdx);
  }

  function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    const fromId = dragFromId.current;
    if (fromId == null) return;

    setOrderedQuestions((prev) => {
      const fromIdx = prev.findIndex((q) => q.id === fromId);
      if (fromIdx < 0 || fromIdx === targetIdx) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
    setOrderDirty(true);
    handleDragEnd();
  }

  function handleDragEnd() {
    dragFromId.current = null;
    setDraggingId(null);
    setDropTargetIdx(null);
  }

  function saveOrder() {
    reorder.mutate(
      {
        section: section.id,
        questions: orderedQuestions.map((q, i) => ({ id: q.id, order: i })),
      },
      { onSuccess: () => setOrderDirty(false) },
    );
  }

  function discardOrder() {
    setOrderedQuestions(
      [...section.questions].sort((a, b) => a.order - b.order || a.id - b.id),
    );
    setOrderDirty(false);
    handleDragEnd();
  }

  return (
    <div style={{
      borderRadius: 14,
      overflow: "hidden",
      border: `1px solid ${C.cardBdr}`,
      background: C.panelBg,
      boxShadow: C.panelShadow,
      position: "relative",
    }}>
      {!isDark && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.35)})`,
        }} />
      )}
      <SurveyConfirmDialog
        open={confirmDelete}
        title="Delete section?"
        message={`"${section.title || `Section ${idx + 1}`}" and all ${section.questions.length} question${section.questions.length !== 1 ? "s" : ""} will be permanently removed.`}
        confirmLabel="Delete section"
        onConfirm={() => del.mutate(section.id, { onSuccess: () => setConfirmDelete(false) })}
        onCancel={() => setConfirmDelete(false)}
        pending={del.isPending}
      />
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px",
        borderBottom: open ? `1px solid ${C.tableSep}` : "none",
        background: surveyPanelHeadBg(accent, isDark),
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: hexA(accent, 0.14), border: `1px solid ${hexA(accent, 0.25)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: accent, flexShrink: 0,
          fontFamily: "var(--font-cinzel)",
        }}>
          {idx + 1}
        </div>

        {editingTitle ? (
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }} style={{ flex: 1, padding: "7px 11px", borderRadius: 8, border: `1px solid ${T.accent}60`, background: T.inputBg, color: T.text, fontFamily: "var(--font-outfit)", fontSize: 14, fontWeight: 600, outline: "none" }} autoFocus />
            <ActionBtn onClick={saveTitle} disabled={update.isPending} variant="primary" small>Save</ActionBtn>
            <ActionBtn onClick={() => { setTitle(section.title); setEditingTitle(false); }} small>✕</ActionBtn>
          </div>
        ) : (
          <>
            <button onClick={() => setOpen(v => !v)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: 0, fontFamily: "var(--font-outfit)" }}>
              <span style={{ fontFamily: "var(--font-cinzel)", fontSize: 16, fontWeight: 600, color: C.txtPrimary }}>
                {section.title || `Section ${idx + 1}`}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: accent,
                padding: "3px 9px", borderRadius: 20,
                background: hexA(accent, 0.1), border: `1px solid ${hexA(accent, 0.2)}`,
              }}>
                {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 14, color: C.txtMuted, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s", display: "inline-block", marginLeft: "auto" }}>›</span>
            </button>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {allowEdit && (
                <>
                  <button onClick={() => { setEditingTitle(true); setTimeout(() => titleRef.current?.focus(), 50); }} style={{ fontSize: 12, color: T.accent, background: "none", border: "none", cursor: "pointer", padding: "2px 7px" }}>Rename</button>
                  <button onClick={() => setConfirmDelete(true)} disabled={del.isPending} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 7px" }}>Delete</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Questions */}
      {open && (
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {allowEdit && orderedQuestions.length > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
              padding: "8px 0 2px",
            }}>
              <div style={{ fontSize: 12, color: T.dim }}>
                {orderDirty
                  ? "Unsaved changes — click Save Order to apply."
                  : "Drag ⠿ to reorder questions."}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {orderDirty && (
                  <ActionBtn onClick={discardOrder} small disabled={reorder.isPending}>Discard</ActionBtn>
                )}
                <ActionBtn
                  onClick={saveOrder}
                  variant="primary"
                  small
                  disabled={!orderDirty || reorder.isPending}
                >
                  {reorder.isPending ? "Saving…" : "Save Order"}
                </ActionBtn>
              </div>
            </div>
          )}

          {orderedQuestions.length === 0 && (
            <p style={{ fontSize: 13, color: T.dim, margin: 0 }}>No questions yet.</p>
          )}

          {orderedQuestions.map((q, qIdx) => (
            <QuestionCard
              key={q.id}
              question={q}
              surveyId={surveyId}
              allowEdit={allowEdit}
              orderNumber={qIdx + 1}
              canReorder={allowEdit && orderedQuestions.length > 1}
              isDragging={draggingId === q.id}
              isDropTarget={dropTargetIdx === qIdx && draggingId !== q.id}
              onDragStart={() => handleDragStart(q.id)}
              onDragOver={(e) => handleDragOver(e, qIdx)}
              onDrop={(e) => handleDrop(e, qIdx)}
              onDragEnd={handleDragEnd}
            />
          ))}
          {allowEdit && <AddQuestionForm sectionId={section.id} currentCount={orderedQuestions.length} surveyId={surveyId} />}
        </div>
      )}
    </div>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton({ C, accent, isDark }: { C: SurveyThemeColors; accent: string; isDark: boolean }) {
  return (
    <PulseShell>
      <div style={{
        borderRadius: 14, border: `1px solid ${C.cardBdr}`, background: C.cardBg,
        padding: "22px 24px", marginBottom: 20,
      }}>
        {!isDark && <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.4)})`, margin: "-22px -24px 20px", borderRadius: "14px 14px 0 0" }} />}
        <Skeleton style={{ height: 12, width: 100, marginBottom: 12, background: C.barTrack }} />
        <Skeleton style={{ height: 32, width: "55%", marginBottom: 0, background: C.barTrack }} />
      </div>
      <Skeleton style={{ height: 42, width: 280, marginBottom: 20, borderRadius: 10, background: C.barTrack }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} style={{ height: 120, borderRadius: 14, background: C.barTrack }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 16 }}>
        <Skeleton style={{ height: 220, borderRadius: 14, background: C.barTrack }} />
        <Skeleton style={{ height: 220, borderRadius: 14, background: C.barTrack }} />
      </div>
    </PulseShell>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SurveyProfilePage({
  surveyId,
  onBack,
  C,
  accent,
  isDark,
}: {
  surveyId: number;
  onBack?: () => void;
  C: SurveyThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const T = useSurveyTheme();
  const router = useRouter();
  const { canEdit } = usePermissions();
  const allowEdit = canEdit("surveys");
  const { data: survey, isLoading, isError, refetch } = useSurvey(surveyId);
  const { data: responsesPage } = useSurveyResponses({ page: 1, search: "", surveyId: String(surveyId) });
  const createSection = useCreateSection(surveyId);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [importModalOpen, setImportModalOpen] = useState(false);

  if (isLoading) return <ProfileSkeleton C={C} accent={accent} isDark={isDark} />;

  if (isError || !survey) {
    return (
      <PulseShell>
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ fontSize: 14, color: "#ef4444", marginBottom: 12 }}>Survey not found or failed to load.</p>
          {onBack && <ActionBtn onClick={onBack}>← Back to surveys</ActionBtn>}
        </div>
      </PulseShell>
    );
  }

  const totalResponses = responsesPage?.count ?? survey.response_count;
  const totalQuestions = survey.sections.reduce((acc, s) => acc + s.questions.length, 0);
  const isLive = survey.status === "live";
  const isClosed = survey.status === "closed";
  const sectionCount = survey.sections.length;

  async function handlePublish() {
    setPublishErrors([]);
    setPublishing(true);
    try {
      await publishSurvey(surveyId);
      toast({ title: "Survey published!" });
      refetch();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: string[] } } };
      const errs = e?.response?.data?.errors;
      if (errs?.length) setPublishErrors(errs);
      else toast({ title: "Publish failed", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  function addSection() {
    createSection.mutate({
      survey: surveyId,
      title: `Section ${sectionCount + 1}`,
      order: sectionCount,
    });
    setActiveTab("questionnaire");
  }

  return (
    <PulseShell>
      <div style={{ paddingBottom: 48 }}>
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        marginBottom: 20,
      }}>
        {!isDark && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, ${accent}, ${hexA(accent, 0.4)})`,
            borderRadius: "14px 14px 0 0",
          }} />
        )}
        <div style={{
          padding: "22px 24px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ minWidth: 0, flex: "1 1 240px" }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: C.txtMuted,
              marginBottom: 8,
              fontFamily: "var(--font-outfit)",
            }}>
              Survey profile
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{
                fontFamily: "var(--font-cinzel)",
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 700,
                color: C.txtPrimary,
                margin: 0,
                letterSpacing: "-.01em",
                lineHeight: 1.15,
              }}>
                {survey.name}
              </h1>
              <StatusBadge status={survey.status} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 14px", borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`, background: C.inputBg,
                  color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", transform: "rotate(180deg)" }}>
                  <Icon name="arrow" size={13} sw={2} />
                </span>
                Back
              </button>
            )}
            {isLive && loadSurveyModuleSettings().showPublicSubmitLink && (
              <ActionBtn onClick={() => router.push(`/dashboard/survey/${surveyId}/submit`)} variant="accent" accent={accent} small>
                Submit response
              </ActionBtn>
            )}
            {isLive && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 14px", borderRadius: 10,
                background: hexA(T.green, 0.1), color: T.green,
                border: `1px solid ${hexA(T.green, 0.25)}`,
                fontSize: 13, fontWeight: 700, fontFamily: "var(--font-outfit)",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
                Live
              </span>
            )}
            {!isLive && !isClosed && allowEdit ? (
              <ActionBtn onClick={handlePublish} disabled={publishing} variant="primary" accent={accent}>
                {publishing ? "Publishing…" : "Publish survey"}
              </ActionBtn>
            ) : null}
            {allowEdit && (
              <ActionBtn onClick={() => setImportModalOpen(true)} variant="ghost" accent={accent} small>
                Import from Excel
              </ActionBtn>
            )}
          </div>
        </div>
      </div>

      <ImportSurveyXlsxModal
        surveyId={surveyId}
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      <SurveyProfileTabs active={activeTab} onChange={setActiveTab} C={C} accent={accent} />

      {activeTab === "overview" ? (
        <SurveyOverviewTab
          survey={survey}
          totalResponses={totalResponses}
          totalQuestions={totalQuestions}
          sectionCount={sectionCount}
          publishErrors={publishErrors}
          onGoQuestionnaire={() => setActiveTab("questionnaire")}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      ) : (
        <SurveyQuestionnaireTab
          survey={survey}
          surveyId={surveyId}
          sectionCount={sectionCount}
          totalQuestions={totalQuestions}
          onAddSection={addSection}
          addSectionPending={createSection.isPending}
          allowEdit={allowEdit}
          C={C}
          accent={accent}
          isDark={isDark}
        />
      )}
      </div>
    </PulseShell>
  );
}
