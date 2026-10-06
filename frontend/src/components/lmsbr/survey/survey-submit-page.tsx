"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCounties, fetchSubCounties } from "@/lib/accounts-api";
import { useSubmitSurveyResponse, useSurvey } from "@/hooks/use-surveys";
import type { Question, SubmitAnswerPayload, SurveyDetail } from "@/types/surveys";
import type { SubmitSurveyResponsePayload } from "@/types/surveys";
import { CHOICE_QTYPES, QTYPE_LABELS, type QType } from "@/types/surveys-builder";
import { Icon } from "../icon";
import { SurveyRichTextContent } from "./survey-rich-text";
import { SurveySelect } from "./survey-select";
import {
  PulseCard,
  PulseShell,
  StatusBadge,
  useSurveyTheme,
} from "./survey-pulse-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { loadSurveyModuleSettings } from "@/lib/survey-module-settings";
import { toast } from "@/components/ui/use-toast";

type AnswerDraft = {
  value_text?: string;
  value_number?: string;
  value_bool?: boolean | null;
  value_date?: string;
  choice_ids?: number[];
};

type FileFields = {
  identity_file: File | null;
  photo: File | null;
  sawirka_guriga: File | null;
  documentiga_guriga: File | null;
};

const NUMERIC_QTYPES = new Set<QType>(["integer", "decimal", "rating"]);

const PERSONAL_QUESTION_TEXTS = new Set([
  "MAGACA MILKILAHA",
  "TALEEFINKA MILKIILAHA",
  "MAGACA WAKIILKA GURIGA",
  "TALEEFANKA WAKIILKA",
]);

const FINAL_QUESTION_TEXTS = new Set([
  "CABASHO MA JIRTAA",
  "NUUCA CABASHADA",
]);

function normQuestionText(text: string): string {
  return text.trim().toUpperCase();
}

function partitionQuestions(questions: Question[]) {
  const personal: Question[] = [];
  const camera: Question[] = [];
  const finalQs: Question[] = [];
  for (const q of questions) {
    const key = normQuestionText(q.text);
    if (PERSONAL_QUESTION_TEXTS.has(key)) personal.push(q);
    else if (FINAL_QUESTION_TEXTS.has(key)) finalQs.push(q);
    else camera.push(q);
  }
  const byOrder = (a: Question, b: Question) =>
    (a.order - b.order) || (a.id - b.id);
  personal.sort(byOrder);
  camera.sort(byOrder);
  finalQs.sort(byOrder);
  return { personal, camera, finalQs };
}

function QuestionBlock({
  question,
  draft,
  onChange,
}: {
  question: Question;
  draft: AnswerDraft | undefined;
  onChange: (draft: AnswerDraft) => void;
}) {
  const T = useSurveyTheme();
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>
          {question.text}
          {(question.required ?? question.is_required) && (
            <span style={{ color: "#ef4444" }}> *</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
          {QTYPE_LABELS[question.qtype as QType] ?? question.qtype}
          {question.help_text ? ` · ${question.help_text}` : ""}
        </div>
      </div>
      <QuestionInput question={question} draft={draft} onChange={onChange} />
    </div>
  );
}

function isAnswerFilled(qtype: string, draft: AnswerDraft | undefined, question?: Question): boolean {
  if (!draft) return false;
  if (CHOICE_QTYPES.has(qtype as QType)) {
    const ids = draft.choice_ids ?? [];
    if (!ids.length) return false;
    const otherSelected = (question?.choices ?? []).some((c) => ids.includes(c.id) && c.is_other);
    if (otherSelected) return Boolean(draft.value_text?.trim());
    return true;
  }
  if (qtype === "boolean") return draft.value_bool !== null && draft.value_bool !== undefined;
  if (NUMERIC_QTYPES.has(qtype as QType)) return Boolean(draft.value_number?.trim());
  if (qtype === "date") return Boolean(draft.value_date);
  return Boolean(draft.value_text?.trim());
}

function buildAnswerPayload(question: Question, draft: AnswerDraft | undefined): SubmitAnswerPayload | null {
  if (!draft || !isAnswerFilled(question.qtype, draft, question)) return null;
  const base = { question: question.id };
  if (CHOICE_QTYPES.has(question.qtype as QType)) {
    const ids = draft.choice_ids ?? [];
    const otherSelected = question.choices.some((c) => ids.includes(c.id) && c.is_other);
    return {
      ...base,
      choice_ids: ids,
      ...(otherSelected ? { value_text: draft.value_text?.trim() ?? "" } : {}),
    };
  }
  if (question.qtype === "boolean") return { ...base, value_bool: draft.value_bool };
  if (NUMERIC_QTYPES.has(question.qtype as QType)) {
    return { ...base, value_number: draft.value_number };
  }
  if (question.qtype === "date") return { ...base, value_date: draft.value_date };
  return { ...base, value_text: draft.value_text?.trim() ?? "" };
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  const T = useSurveyTheme();
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: T.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
      {children}
      {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, multiline, type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  const T = useSurveyTheme();
  const style: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${T.inputBdr}`, background: T.inputBg, color: T.text,
    fontFamily: "var(--font-outfit)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...style, resize: "vertical" }} />;
  }
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={style} />;
}

function QuestionInput({
  question,
  draft,
  onChange,
}: {
  question: Question;
  draft: AnswerDraft | undefined;
  onChange: (draft: AnswerDraft) => void;
}) {
  const T = useSurveyTheme();
  const qtype = question.qtype as QType;

  if (CHOICE_QTYPES.has(qtype)) {
    const selected = new Set(draft?.choice_ids ?? []);
    const otherChoice = question.choices.find((c) => c.is_other && selected.has(c.id));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.choices.map((choice) => {
          const on = selected.has(choice.id);
          return (
          <button
            key={choice.id}
            type="button"
            onClick={() => {
              if (qtype === "single") {
                onChange({
                  choice_ids: [choice.id],
                  value_text: choice.is_other ? (draft?.value_text ?? "") : "",
                });
                return;
              }
              const next = new Set(selected);
              if (on) next.delete(choice.id);
              else next.add(choice.id);
              const stillOther = question.choices.some((c) => next.has(c.id) && c.is_other);
              onChange({
                choice_ids: Array.from(next),
                value_text: stillOther ? (draft?.value_text ?? "") : "",
              });
            }}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              width: "100%", textAlign: "left",
              borderRadius: 8, border: `1px solid ${on ? T.accent : T.inputBdr}`,
              background: on ? T.accentSoft : T.inputBg, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <input
              type={qtype === "single" ? "radio" : "checkbox"}
              name={`q-${question.id}`}
              checked={on}
              readOnly
              style={{ pointerEvents: "none" }}
            />
            <span style={{ fontSize: 14, color: T.text }}>
              {choice.label}
              {choice.is_other ? (
                <span style={{ marginLeft: 8, fontSize: 11, color: T.dim, fontWeight: 600 }}>
                  + text
                </span>
              ) : null}
            </span>
          </button>
          );
        })}
        {otherChoice && (
          <div style={{ marginTop: 4, paddingLeft: 2 }}>
            <FieldLabel required>
              {otherChoice.label} — specify
            </FieldLabel>
            <TextInput
              value={draft?.value_text ?? ""}
              onChange={(v) => onChange({ ...draft, choice_ids: draft?.choice_ids ?? [], value_text: v })}
              placeholder="Qor nooca guriga…"
            />
          </div>
        )}
      </div>
    );
  }

  if (qtype === "boolean") {
    const val = draft?.value_bool;
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange({ value_bool: opt.value })}
            style={{
              padding: "8px 14px", borderRadius: 8, border: `1px solid ${val === opt.value ? T.accent : T.inputBdr}`,
              background: val === opt.value ? T.accentSoft : T.inputBg,
              color: val === opt.value ? T.accent : T.muted,
              fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (NUMERIC_QTYPES.has(qtype)) {
    return (
      <TextInput
        type="number"
        value={draft?.value_number ?? ""}
        onChange={(v) => onChange({ value_number: v })}
        placeholder={[
          question.min_value ? `Min ${question.min_value}` : "",
          question.max_value ? `Max ${question.max_value}` : "",
        ].filter(Boolean).join(" · ") || "Enter a number"}
      />
    );
  }

  if (qtype === "date") {
    return (
      <TextInput
        type="date"
        value={draft?.value_date ?? ""}
        onChange={(v) => onChange({ value_date: v })}
      />
    );
  }

  return (
    <TextInput
      value={draft?.value_text ?? ""}
      onChange={(v) => onChange({ value_text: v })}
      placeholder="Your answer"
      multiline={qtype === "long_text"}
    />
  );
}

function FileField({
  label,
  file,
  onChange,
  accept,
  required,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  required?: boolean;
}) {
  const T = useSurveyTheme();
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        style={{ fontSize: 13, color: T.muted, width: "100%" }}
      />
      {file && <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>{file.name}</div>}
    </div>
  );
}

function SubmitSkeleton() {
  const T = useSurveyTheme();
  return (
    <PulseShell>
      <Skeleton style={{ height: 28, width: "50%", marginBottom: 12, background: T.track }} />
      <Skeleton style={{ height: 120, borderRadius: 10, marginBottom: 10, background: T.track }} />
      <Skeleton style={{ height: 200, borderRadius: 10, background: T.track }} />
    </PulseShell>
  );
}

export function SurveySubmitPage({
  surveyId,
  onBack,
  onSuccess,
}: {
  surveyId: number;
  onBack?: () => void;
  onSuccess?: (responseId: number) => void;
}) {
  const T = useSurveyTheme();
  const moduleSettings = loadSurveyModuleSettings();
  const { data: survey, isLoading, isError } = useSurvey(surveyId);
  const submit = useSubmitSurveyResponse();

  const [answers, setAnswers] = useState<Record<number, AnswerDraft>>({});
  const [phoneNumber, setPhoneNumber] = useState("");
  const [guriNumber, setGuriNumber] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("");
  const [countyId, setCountyId] = useState("");
  const [subCountyId, setSubCountyId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [files, setFiles] = useState<FileFields>({
    identity_file: null,
    photo: null,
    sawirka_guriga: null,
    documentiga_guriga: null,
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const { data: counties = [] } = useQuery({
    queryKey: ["accounts", "counties"],
    queryFn: fetchCounties,
    staleTime: 60_000,
  });

  const { data: subCounties = [] } = useQuery({
    queryKey: ["accounts", "sub-counties", countyId],
    queryFn: () => fetchSubCounties(Number(countyId)),
    enabled: Boolean(countyId),
    staleTime: 60_000,
  });

  useEffect(() => {
    setSubCountyId("");
  }, [countyId]);

  const allQuestions = useMemo(
    () => (survey?.sections ?? []).flatMap((s) => s.questions),
    [survey],
  );

  const stages = useMemo(() => {
    const secs = [...(survey?.sections ?? [])].sort(
      (a, b) => a.order - b.order || a.id - b.id,
    );
    if (secs.length >= 3) {
      const byOrder = (a: Question, b: Question) =>
        a.order - b.order || a.id - b.id;
      return {
        personal: [...secs[0].questions].sort(byOrder),
        camera: secs
          .slice(1, -1)
          .flatMap((s) => [...s.questions].sort(byOrder)),
        finalQs: [...secs[secs.length - 1].questions].sort(byOrder),
        sectionTitles: {
          personal: secs[0].title,
          camera: secs.length === 3 ? secs[1].title : "Su'aalaha kaamirada",
          final: secs[secs.length - 1].title,
        },
      };
    }
    const partitioned = partitionQuestions(allQuestions);
    return {
      ...partitioned,
      sectionTitles: {
        personal: "Macluumaadka shakhsiyeed",
        camera: "Su'aalaha kaamirada",
        final: "Macluumaadka ugu dambeeya",
      },
    };
  }, [survey, allQuestions]);

  const { personal, camera, finalQs, sectionTitles } = stages;

  function setAnswer(questionId: number, draft: AnswerDraft) {
    setAnswers((prev) => ({ ...prev, [questionId]: draft }));
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(7));
        setLongitude(pos.coords.longitude.toFixed(7));
        toast({ title: "Location captured" });
      },
      () => toast({ title: "Could not get location", variant: "destructive" }),
    );
  }

  function validateForm(s: SurveyDetail): string[] {
    const errors: string[] = [];
    const phoneRequired = moduleSettings.requirePhone || !s.allow_multiple_submissions;
    const ownerPhoneQ = allQuestions.find(
      (q) => normQuestionText(q.text) === "TALEEFINKA MILKIILAHA",
    );
    const phoneValue =
      phoneNumber.trim()
      || (ownerPhoneQ ? (answers[ownerPhoneQ.id]?.value_text?.trim() ?? "") : "");
    if (phoneRequired && !phoneValue) {
      errors.push("Phone number is required.");
    }
    if (moduleSettings.requireGuriNumber && !guriNumber.trim()) {
      errors.push("Guri (house) number is required.");
    }
    if (moduleSettings.requireLocation && (!latitude.trim() || !longitude.trim())) {
      errors.push("GPS location is required.");
    }
    if (moduleSettings.requireIdentityPhoto && !files.identity_file) {
      errors.push("Identity document is required.");
    }
    if (moduleSettings.requireRespondentPhoto && !files.photo) {
      errors.push("Respondent photo is required.");
    }
    for (const question of allQuestions) {
      const isRequired = Boolean(question.required ?? question.is_required);
      if (isRequired && !isAnswerFilled(question.qtype, answers[question.id], question)) {
        errors.push(`"${question.text}" is required.`);
      }
    }
    return errors;
  }

  function handleSubmit() {
    if (!survey) return;
    const errors = validateForm(survey);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);

    const answerPayloads = allQuestions
      .map((q) => buildAnswerPayload(q, answers[q.id]))
      .filter((a): a is SubmitAnswerPayload => a !== null);

    const ownerPhoneQ = allQuestions.find(
      (q) => normQuestionText(q.text) === "TALEEFINKA MILKIILAHA",
    );
    const ownerPhoneFromAnswer = ownerPhoneQ
      ? (answers[ownerPhoneQ.id]?.value_text?.trim() ?? "")
      : "";
    const resolvedPhone = phoneNumber.trim() || ownerPhoneFromAnswer;

    const days = Number.parseInt(deadlineDays.trim(), 10);
    const payload: SubmitSurveyResponsePayload = {
      survey: surveyId,
      phone_number: resolvedPhone,
      guri_number: guriNumber.trim(),
      county: countyId ? Number(countyId) : null,
      sub_county: subCountyId ? Number(subCountyId) : null,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      deadline_days: Number.isFinite(days) && days > 0 ? days : null,
      answers: answerPayloads,
      ...files,
    };

    submit.mutate(payload, {
      onSuccess: (data) => onSuccess?.(data.id),
    });
  }

  if (isLoading) return <SubmitSkeleton />;

  if (isError || !survey) {
    return (
      <PulseShell>
        <p style={{ color: "#ef4444", fontSize: 14 }}>Survey not found.</p>
        {onBack && (
          <button type="button" onClick={onBack} style={{ marginTop: 12, fontSize: 13, color: T.accent, background: "none", border: "none", cursor: "pointer" }}>
            ← Back
          </button>
        )}
      </PulseShell>
    );
  }

  if (survey.status !== "live") {
    return (
      <PulseShell>
        <PulseCard>
          <p style={{ fontSize: 14, color: T.muted, margin: 0 }}>
            This survey is not accepting responses ({survey.status}).
          </p>
        </PulseCard>
        {onBack && (
          <button type="button" onClick={onBack} style={{ marginTop: 12, fontSize: 13, color: T.accent, background: "none", border: "none", cursor: "pointer" }}>
            ← Back to survey
          </button>
        )}
      </PulseShell>
    );
  }

  return (
    <PulseShell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontFamily: "var(--font-outfit)", fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>
              Submit response
            </h1>
            <StatusBadge status={survey.status} />
          </div>
          <p style={{ fontSize: 13, color: T.dim, margin: 0 }}>{survey.name}</p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px",
              borderRadius: 8, border: `1px solid ${T.cardBdr}`, background: T.inputBg,
              color: T.muted, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", transform: "rotate(180deg)" }}>
              <Icon name="arrow" size={12} sw={2} />
            </span>
            Back
          </button>
        )}
      </div>

      {survey.description && (
        <PulseCard style={{ padding: "14px 16px", marginBottom: 10 }}>
          <SurveyRichTextContent content={survey.description} />
        </PulseCard>
      )}

      {formErrors.length > 0 && (
        <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.22)" }}>
          <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
            {formErrors.map((e) => <li key={e} style={{ fontSize: 12, color: "#ef4444" }}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Stage 1 — Personal / basic information */}
      <PulseCard style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
          1. {sectionTitles.personal}
        </div>
        <p style={{ fontSize: 12, color: T.dim, margin: "0 0 12px" }}>
          Magaca / lambarka milkiilaha iyo wakiilka, degmada iyo waaxda
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {personal.map((question) => {
            const isOwnerPhone = normQuestionText(question.text) === "TALEEFINKA MILKIILAHA";
            return (
              <QuestionBlock
                key={question.id}
                question={question}
                draft={answers[question.id]}
                onChange={(d) => {
                  setAnswer(question.id, d);
                  if (isOwnerPhone) setPhoneNumber(d.value_text?.trim() ?? "");
                }}
              />
            );
          })}
          {!personal.some((q) => normQuestionText(q.text) === "TALEEFINKA MILKIILAHA") && (
            <div>
              <FieldLabel required={moduleSettings.requirePhone || !survey.allow_multiple_submissions}>
                Lambarka milkiilaha
              </FieldLabel>
              <TextInput value={phoneNumber} onChange={setPhoneNumber} placeholder="e.g. 0612345678" />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div>
              <FieldLabel>Degmada</FieldLabel>
              <SurveySelect
                T={T}
                value={countyId}
                onChange={setCountyId}
                options={[{ value: "", label: "Dooro degmada" }, ...counties.map((c) => ({ value: String(c.id), label: c.name }))]}
              />
            </div>
            <div>
              <FieldLabel>Waaxda</FieldLabel>
              <SurveySelect
                T={T}
                value={subCountyId}
                onChange={setSubCountyId}
                disabled={!countyId}
                options={[{ value: "", label: "Dooro waaxda" }, ...subCounties.map((c) => ({ value: String(c.id), label: c.name }))]}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4, borderTop: `1px solid ${T.cardBdr}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <div>
                <FieldLabel required={moduleSettings.requireLocation}>Latitude</FieldLabel>
                <TextInput value={latitude} onChange={setLatitude} placeholder="Auto or manual" />
              </div>
              <div>
                <FieldLabel required={moduleSettings.requireLocation}>Longitude</FieldLabel>
                <TextInput value={longitude} onChange={setLongitude} placeholder="Auto or manual" />
              </div>
            </div>
            <button
              type="button"
              onClick={captureLocation}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.cardBdr}`,
                background: T.accentSoft, color: T.accent, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Icon name="map" size={14} sw={1.8} />
              Use my location
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <FileField
                label="Identity document"
                required={moduleSettings.requireIdentityPhoto}
                file={files.identity_file}
                onChange={(f) => setFiles((p) => ({ ...p, identity_file: f }))}
                accept="image/*,.pdf"
              />
              <FileField
                label="Respondent photo"
                required={moduleSettings.requireRespondentPhoto}
                file={files.photo}
                onChange={(f) => setFiles((p) => ({ ...p, photo: f }))}
                accept="image/*"
              />
            </div>
          </div>
        </div>
      </PulseCard>

      {/* Stage 2 — Camera / survey questions */}
      <PulseCard style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
          2. {sectionTitles.camera}
        </div>
        <p style={{ fontSize: 12, color: T.dim, margin: "0 0 12px" }}>
          Su&apos;aalaha sahanka sida loo habeeyey
        </p>
        {camera.length === 0 ? (
          <p style={{ fontSize: 13, color: T.dim, margin: 0 }}>Su&apos;aalo lama helin.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {camera.map((question) => (
              <QuestionBlock
                key={question.id}
                question={question}
                draft={answers[question.id]}
                onChange={(d) => setAnswer(question.id, d)}
              />
            ))}
          </div>
        )}
      </PulseCard>

      {/* Stage 3 — Final information */}
      <PulseCard style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
          3. {sectionTitles.final}
        </div>
        <p style={{ fontSize: 12, color: T.dim, margin: "0 0 12px" }}>
          Cabashada, ballanka, guri lambar iyo sawirka guriga
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {finalQs.map((question) => (
            <QuestionBlock
              key={question.id}
              question={question}
              draft={answers[question.id]}
              onChange={(d) => setAnswer(question.id, d)}
            />
          ))}
          <div>
            <FieldLabel>Ballan u qabashada (maalmo)</FieldLabel>
            <TextInput
              value={deadlineDays}
              onChange={setDeadlineDays}
              placeholder="e.g. 7"
              type="number"
            />
          </div>
          <div>
            <FieldLabel required={moduleSettings.requireGuriNumber}>Guri lambar</FieldLabel>
            <TextInput value={guriNumber} onChange={setGuriNumber} placeholder="Guri lambar" />
          </div>
          <FileField
            label="Sawirka guriga"
            file={files.sawirka_guriga}
            onChange={(f) => setFiles((p) => ({ ...p, sawirka_guriga: f }))}
            accept="image/*"
          />
          <FileField
            label="Documentiga guriga (optional)"
            file={files.documentiga_guriga}
            onChange={(f) => setFiles((p) => ({ ...p, documentiga_guriga: f }))}
            accept="image/*,.pdf"
          />
        </div>
      </PulseCard>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={submit.isPending}
            style={{
              padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.cardBdr}`,
              background: T.inputBg, color: T.muted, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submit.isPending}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "none",
            background: `linear-gradient(135deg,#60a5fa,${T.accent})`, color: "#fff",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: submit.isPending ? "not-allowed" : "pointer",
            opacity: submit.isPending ? 0.7 : 1,
          }}
        >
          {submit.isPending ? "Submitting…" : "Submit response"}
        </button>
      </div>
    </PulseShell>
  );
}
