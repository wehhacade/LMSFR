"use client";

import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hexA } from "@/lib/lmsbr/data";
import { importSurveyXlsx, surveyKeys } from "@/lib/surveys-api";
import type { SurveyXlsxImportSummary } from "@/types/surveys";
import { toast } from "@/components/ui/use-toast";
import { SurveyModal } from "./survey-form-modal";
import { useSurveyTheme } from "./survey-pulse-ui";

function CountList({ items }: { items: Record<string, number> }) {
  const T = useSurveyTheme();
  const entries = Object.entries(items);
  if (entries.length === 0) return null;
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, color: T.dim, lineHeight: 1.7 }}>
      {entries.map(([name, count]) => (
        <li key={name}>
          {name} <span style={{ color: T.muted }}>× {count}</span>
        </li>
      ))}
    </ul>
  );
}

function SummaryPanel({ summary }: { summary: SurveyXlsxImportSummary }) {
  const T = useSurveyTheme();
  const unmatchedOfficerCount = Object.values(summary.unmatched_officers).reduce((a, b) => a + b, 0);
  const fuzzyOfficerCount = Object.values(summary.fuzzy_matched_officers).reduce((a, b) => a + b, 0);
  const unmatchedSubcountyCount = Object.values(summary.unmatched_subcounties).reduce((a, b) => a + b, 0);

  const stat = (label: string, value: number | string, tone?: "warn" | "danger") => (
    <div
      style={{
        flex: "1 1 120px",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${T.inputBdr}`,
        background: T.inputBg,
      }}
    >
      <div style={{ fontSize: 11, color: T.dim, fontFamily: "var(--font-outfit)", textTransform: "uppercase", letterSpacing: ".05em" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "var(--font-outfit)",
          color: tone === "danger" ? "#c44a3f" : tone === "warn" ? "#b8860b" : T.text,
        }}
      >
        {value}
      </div>
    </div>
  );

  const allAlreadyImported = summary.created === 0 && summary.skipped_duplicate > 0
    && summary.skipped_duplicate === summary.total_rows;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "var(--font-outfit)" }}>
        Detected district: <span style={{ fontWeight: 700, color: T.text }}>{summary.detected_county}</span>
      </div>

      {allAlreadyImported && (
        <div style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: hexA("#b8860b", 0.1),
          border: "1px solid rgba(184,134,11,0.3)",
          color: "#b8860b",
          fontSize: 13,
          fontFamily: "var(--font-outfit)",
          fontWeight: 600,
        }}>
          Nothing to import — all {summary.total_rows} row(s) in this file are already in the system.
          {summary.dry_run ? " Confirming won't add anything new." : ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stat("Rows in sheet", summary.total_rows)}
        {stat(summary.dry_run ? "Would create" : "Created", summary.created)}
        {stat("Already imported", summary.skipped_duplicate, summary.skipped_duplicate ? "warn" : undefined)}
        {stat("Interpolated coords", summary.interpolated_coordinates, summary.interpolated_coordinates ? "warn" : undefined)}
      </div>

      {summary.new_questions_created.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, fontFamily: "var(--font-outfit)" }}>
            New questions added to this survey
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, color: T.dim, lineHeight: 1.7 }}>
            {summary.new_questions_created.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {fuzzyOfficerCount > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#b8860b", fontFamily: "var(--font-outfit)" }}>
            {fuzzyOfficerCount} row(s) matched an officer by close spelling (typo-tolerant match) — worth a quick spot-check
          </div>
          <CountList items={summary.fuzzy_matched_officers} />
        </div>
      )}

      {unmatchedOfficerCount > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#b8860b", fontFamily: "var(--font-outfit)" }}>
            {unmatchedOfficerCount} row(s) with an officer name that didn&apos;t match an existing account — attributed to you (the importer) instead
          </div>
          <CountList items={summary.unmatched_officers} />
        </div>
      )}

      {unmatchedSubcountyCount > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#c44a3f", fontFamily: "var(--font-outfit)" }}>
            {unmatchedSubcountyCount} row(s) with an unrecognized WAAXDA — skipped entirely
          </div>
          <CountList items={summary.unmatched_subcounties} />
        </div>
      )}

      {summary.row_errors.length > 0 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#c44a3f", fontFamily: "var(--font-outfit)" }}>
            Row warnings
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: T.dim, lineHeight: 1.7, maxHeight: 140, overflowY: "auto" }}>
            {summary.row_errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ImportSurveyXlsxModal({
  surveyId,
  open,
  onClose,
}: {
  surveyId: number;
  open: boolean;
  onClose: () => void;
}) {
  const T = useSurveyTheme();
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<SurveyXlsxImportSummary | null>(null);
  const [error, setError] = useState("");

  const pending = previewing || importing;

  function reset() {
    setFile(null);
    setSummary(null);
    setError("");
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function handleFileChange(f: File | null) {
    setFile(f);
    setSummary(null);
    setError("");
  }

  function extractErrorMessage(err: unknown): string {
    const e = err as { response?: { data?: { detail?: string } } };
    return e?.response?.data?.detail || "Import failed. Please check the file and try again.";
  }

  async function handlePreview() {
    if (!file) return;
    setError("");
    setPreviewing(true);
    try {
      const result = await importSurveyXlsx(surveyId, file, true);
      setSummary(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setError("");
    setImporting(true);
    try {
      const result = await importSurveyXlsx(surveyId, file, false);
      setSummary(result);
      toast({ title: `Imported ${result.created} response(s).` });
      queryClient.invalidateQueries({ queryKey: surveyKeys.detail(surveyId) });
      queryClient.invalidateQueries({ queryKey: surveyKeys.responses.all });
      queryClient.invalidateQueries({ queryKey: surveyKeys.stats });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  const hasPreview = summary !== null && summary.dry_run;
  const isDone = summary !== null && !summary.dry_run;

  return (
    <SurveyModal
      open={open}
      onClose={handleClose}
      eyebrow="Import responses"
      title="Import from Excel"
      subtitle="Upload a CCTV survey export (.xlsx). Rows are matched to this survey's existing questions, officers and sub-counties — preview first to see what will happen before writing anything."
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
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
            {isDone ? "Close" : "Cancel"}
          </button>
          {!isDone && (
            <>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || pending}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: `1px solid ${T.accent}`,
                  background: "transparent",
                  color: T.accent,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !file || pending ? "not-allowed" : "pointer",
                  opacity: !file || pending ? 0.5 : 1,
                }}
              >
                {previewing ? "Previewing…" : "Preview"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!hasPreview || importing}
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: !hasPreview || importing ? T.track : `linear-gradient(135deg, #60a5fa, ${T.accent})`,
                  color: !hasPreview || importing ? T.dim : "#fff",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !hasPreview || importing ? "not-allowed" : "pointer",
                  boxShadow: !hasPreview || importing ? "none" : `0 6px 18px -6px ${hexA(T.accent, 0.55)}`,
                }}
              >
                {importing ? "Importing…" : "Confirm import"}
              </button>
            </>
          )}
        </>
      }
    >
      <form id={formId} style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={(e) => e.preventDefault()}>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span style={{
            fontSize: 11,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: T.dim,
            fontFamily: "var(--font-outfit)",
            fontWeight: 600,
          }}>
            Excel file (.xlsx)
          </span>
          <div
            onClick={() => !pending && fileInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "11px 14px",
              borderRadius: 10,
              border: `1px dashed ${T.inputBdr}`,
              background: T.inputBg,
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 13.5, color: file ? T.text : T.dim, fontFamily: "var(--font-outfit)" }}>
              {file ? file.name : "Choose a .xlsx file…"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.accent, fontFamily: "var(--font-outfit)" }}>
              Browse
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            disabled={pending}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
        </label>

        {error && (
          <div style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(224,101,90,0.1)",
            border: "1px solid rgba(224,101,90,0.25)",
            color: "#c44a3f",
            fontSize: 13,
            fontFamily: "var(--font-outfit)",
          }}>
            {error}
          </div>
        )}

        {summary && <SummaryPanel summary={summary} />}

        {isDone && (
          <div style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: hexA(T.accent, 0.08),
            border: `1px solid ${hexA(T.accent, 0.25)}`,
            color: T.accent,
            fontSize: 13,
            fontFamily: "var(--font-outfit)",
            fontWeight: 600,
          }}>
            {summary!.created > 0
              ? `Import complete — added ${summary!.created} new response(s).`
              : "Import complete — nothing new to add, every row was already imported."}
          </div>
        )}
      </form>
    </SurveyModal>
  );
}
