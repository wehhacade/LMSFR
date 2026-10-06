"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { useLang } from "../lang-ctx";
import { PrimaryButton, SecondaryButton } from "../accounts-shared";
import { Icon } from "../icon";
import { useQeybs } from "@/hooks/use-accounts";
import { useImportAgentRoster, useMergeImportConflict } from "@/hooks/use-personnel";
import type { AgentImportSummary, ImportChangePreview, ImportConflictAgent } from "@/types/personnel";
import { toast } from "@/components/ui/use-toast";
import { hexA } from "@/lib/lmsbr/data";
import type { PersonnelPageProps } from "./personnel-page-props";

function conflictAgentsFromRow(row: ImportChangePreview): ImportConflictAgent[] {
  const raw = row.diff?.conflict_agents;
  if (!Array.isArray(raw)) return [];
  return raw as ImportConflictAgent[];
}

function formatAgentLabel(agent: ImportConflictAgent, so: boolean): string {
  const parts = [
    agent.name || "—",
    agent.service_id ? `ID ${agent.service_id}` : "",
    agent.nickname ? `${so ? "Laqab" : "Nick"} ${agent.nickname}` : "",
    agent.phone ? `${so ? "Tel" : "Phone"} ${agent.phone}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

const KNOWN_SECTIONS = [
  {
    value: "Qeybta Galbeed",
    fileHint: "Liiska Qaybta Galbeed Last.xlsx",
    districts: "Wadajir, Dharkinley, Kaxda",
    aliases: ["qeybta galbeed", "qeebta galbeed"],
  },
  {
    value: "Qeybta Waliyow Cadde",
    fileHint: "LIISKA GUUD QAYBTA WALLIYOW CADDE",
    districts: "Hodan, Howlwadaag, Xamarjajab, Waaberi",
    aliases: ["qeybta waliyow cadde", "qeebta waliyoow cadde", "qeebta waliyow cadde"],
  },
  {
    value: "Qeybta Galbeed Sare",
    fileHint: "Liiska Qaybta Galbeed Sare",
    districts: "Daaruu Salaam, Dayniile, Garasbaaley, Gubta",
    aliases: ["qeybta galbeed sare"],
  },
  {
    value: "Qeybta Bari",
    fileHint: "Liiska Qaybta Bari",
    districts: "Gubadley, Heliwaa, Kaaraan, Shibis, Yaaqshiid",
    aliases: ["qeybta bari"],
  },
  {
    value: "Qeybta Bartamaha",
    fileHint: "Liiska Qaybta Bartamaha",
    districts: "Boondheere, Cabdicasiis, Shangaani, Wartanabadda, Xamar Weyne",
    aliases: ["qeybta bartamaha"],
  },
] as const;

function findKnownSection(dbName: string) {
  return KNOWN_SECTIONS.find((known) => matchesImportSection(dbName, known));
}

function matchesImportSection(dbName: string, section: (typeof KNOWN_SECTIONS)[number]): boolean {
  const normalized = dbName.trim().toLowerCase();
  if (normalized === section.value.toLowerCase()) return true;
  return section.aliases.some((alias) => alias === normalized);
}

type Step = "upload" | "preview" | "done";

const STEPS: Step[] = ["upload", "preview", "done"];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatChange(diff: Record<string, unknown>, so: boolean): string {
  const parts: string[] = [];

  if (diff.match_method) {
    const labels: Record<string, string> = so
      ? {
          service_id: "Emp No",
          service_id_normalized: "Emp No",
          phone: "Telefoon",
          nickname: "Laqab",
          staff_payroll: "Shaqaalaha (payroll)",
          name: "Magac",
        }
      : {
          service_id: "Emp No",
          service_id_normalized: "Emp No",
          phone: "Phone",
          nickname: "Nickname",
          staff_payroll: "Staff payroll",
          name: "Name",
        };
    const method = String(diff.match_method);
    if (labels[method]) {
      parts.push(so ? `La isku xiray: ${labels[method]}` : `Matched by ${labels[method]}`);
    }
  }

  if (diff.old_service_id != null && diff.new_service_id) {
    parts.push(`Emp No: ${diff.old_service_id} → ${diff.new_service_id}`);
  }
  if (diff.old_name && diff.new_name) {
    parts.push(so ? `Magac: ${diff.old_name} → ${diff.new_name}` : `Name: ${diff.old_name} → ${diff.new_name}`);
  }
  if (diff.old_phone && diff.new_phone) {
    parts.push(so ? `Tel: ${diff.old_phone} → ${diff.new_phone}` : `Phone: ${diff.old_phone} → ${diff.new_phone}`);
  }
  if (diff.matched_nickname) {
    parts.push(so ? `Laqab: ${diff.matched_nickname}` : `Nickname: ${diff.matched_nickname}`);
  }
  if (diff.previously_released) {
    parts.push(so ? "Laga sii daayay qayb/degmo kale" : "Released from previous section/district");
  } else if (diff.from_other_section) {
    parts.push(so ? "Ka yimid qayb kale" : "From another section");
  }
  if (diff.new_district != null && diff.old_district !== diff.new_district) {
    const from = diff.old_district ? String(diff.old_district) : so ? "Lama qoondeeynin" : "Unassigned";
    parts.push(so ? `Degmo: ${from} → ${diff.new_district as string}` : `District: ${from} → ${diff.new_district as string}`);
  }
  if (diff.new_department != null && diff.old_department !== diff.new_department) {
    const from = diff.old_department ? String(diff.old_department) : so ? "Laga sii daayay" : "Released";
    parts.push(so ? `Qayb: ${from} → ${diff.new_department as string}` : `Section: ${from} → ${diff.new_department as string}`);
  } else if (diff.district) {
    parts.push(so ? `Degmo: ${diff.district as string}` : `District: ${diff.district as string}`);
  }

  if (diff.section_hq && diff.position) {
    const title = so ? `Jagada: ${diff.position as string}` : `Title: ${diff.position as string}`;
    return parts.length ? `${title} · ${parts.join(" · ")}` : title;
  }

  if (diff.position && !diff.district && !diff.old_district) {
    parts.unshift(so ? `Jagada: ${diff.position as string}` : `Title: ${diff.position as string}`);
  }

  if (diff.is_labisin) {
    parts.push(so ? "Labisan" : "Labisan (inactive pool)");
  }

  return parts.length ? parts.join(" · ") : "—";
}

function districtFromDiff(diff: Record<string, unknown>): string {
  if (diff.district) return String(diff.district);
  if (diff.section_hq) return "Section HQ";
  if (diff.is_labisin) return "Labisan";
  return "Unassigned";
}

function actionBadge(action: string) {
  const a = action.toUpperCase();
  if (a === "TRANSFER") return { bg: "rgba(184,134,11,0.14)", color: "#b8860b", border: "rgba(184,134,11,0.35)" };
  if (a === "CREATE") return { bg: "rgba(70,192,138,0.14)", color: "#2d9d6e", border: "rgba(70,192,138,0.35)" };
  if (a === "UPDATE") return { bg: "rgba(91,159,212,0.14)", color: "#4a8fc4", border: "rgba(91,159,212,0.35)" };
  if (a === "CONFLICT" || a === "ERROR") return { bg: "rgba(196,74,63,0.14)", color: "#c44a3f", border: "rgba(196,74,63,0.35)" };
  if (a === "MISSING_FROM_EXCEL" || a === "REMOVE_FROM_SECTION") return { bg: "rgba(184,134,11,0.14)", color: "#b8860b", border: "rgba(184,134,11,0.35)" };
  return { bg: "rgba(148,163,184,0.12)", color: "#64748b", border: "rgba(148,163,184,0.28)" };
}

function StepIndicator({ step, so, C, accent }: { step: Step; so: boolean; C: PersonnelPageProps["C"]; accent: string }) {
  const labels = so
    ? ["Soo rar", "Hubi", "Dhammaystir"]
    : ["Upload", "Preview", "Complete"];
  const idx = STEPS.indexOf(step);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", maxWidth: 420 }}>
      {STEPS.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        const dotBg = done ? accent : active ? `linear-gradient(135deg, ${accent}, ${hexA(accent, 0.7)})` : C.inputBg;
        const dotColor = done || active ? "#fff" : C.txtMuted;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: dotBg,
                  border: `2px solid ${done || active ? accent : C.inputBdr}`,
                  color: dotColor,
                  fontFamily: "var(--font-outfit)",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: active ? `0 0 0 4px ${hexA(accent, 0.18)}` : "none",
                  transition: "all .25s ease",
                }}
              >
                {done ? <Icon name="check" size={16} sw={2.2} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-outfit)",
                  fontWeight: active ? 600 : 500,
                  color: active ? C.txtPrimary : C.txtMuted,
                  letterSpacing: ".03em",
                  textTransform: "uppercase",
                }}
              >
                {labels[i]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 6px 20px",
                  borderRadius: 99,
                  background: done ? accent : C.barTrack,
                  opacity: done ? 1 : 0.6,
                  transition: "background .3s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  hint,
  C,
  accent,
}: {
  label: string;
  value: number | string;
  tone?: "warn" | "danger" | "ok" | "accent";
  icon: string;
  hint?: string;
  C: PersonnelPageProps["C"];
  accent: string;
}) {
  const toneColor =
    tone === "danger" ? "#c44a3f"
      : tone === "warn" ? "#b8860b"
        : tone === "ok" ? "#2d9d6e"
          : tone === "accent" ? accent
            : C.txtPrimary;

  return (
    <div
      style={{
        flex: "1 1 130px",
        minWidth: 130,
        padding: "16px 16px 14px",
        borderRadius: 14,
        border: `1px solid ${C.cardBdr}`,
        background: C.cardBg,
        boxShadow: C.cardShadow,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `linear-gradient(180deg, ${toneColor}, ${hexA(toneColor, 0.4)})`,
          borderRadius: "14px 0 0 14px",
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div
            style={{
              fontSize: 10.5,
              color: C.txtMuted,
              textTransform: "uppercase",
              letterSpacing: ".07em",
              fontFamily: "var(--font-outfit)",
              fontWeight: 500,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: toneColor,
              fontFamily: "var(--font-cinzel)",
              marginTop: 4,
              lineHeight: 1.1,
            }}
          >
            {value}
          </div>
          {hint && (
            <div style={{ fontSize: 11, color: C.txtMuted, marginTop: 4, fontFamily: "var(--font-outfit)", lineHeight: 1.35 }}>
              {hint}
            </div>
          )}
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hexA(toneColor, 0.1),
            color: toneColor,
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={17} sw={1.9} />
        </div>
      </div>
    </div>
  );
}

export function AgentImportWizardPage({ C, accent }: PersonnelPageProps) {
  const { lang } = useLang();
  const so = lang === "so";
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportAgentRoster();
  const mergeMutation = useMergeImportConflict();
  const [mergingServiceId, setMergingServiceId] = useState<string | null>(null);
  const { data: qeybs = [] } = useQeybs();
  const [file, setFile] = useState<File | null>(null);
  const [departmentScope, setDepartmentScope] = useState("");
  const [summary, setSummary] = useState<AgentImportSummary | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [previewTab, setPreviewTab] = useState<"excel" | "missing">("excel");

  const sectionOptions = useMemo(() => {
    const fromDb = qeybs.map((q) => {
      const known = findKnownSection(q.name);
      const districtNames = q.counties?.length
        ? q.counties.map((c) => c.name).join(", ")
        : known?.districts ?? "";
      return {
        id: q.id,
        value: q.name,
        fileHint: known?.fileHint ?? (so ? "Liiska Excel (qaabka DEGMADA)" : "Roster Excel (DEGMADA format)"),
        districts: districtNames,
        hasKnownTemplate: Boolean(known),
        hasDistricts: (q.counties?.length ?? 0) > 0,
      };
    });

    return fromDb.sort((a, b) => {
      if (a.hasKnownTemplate !== b.hasKnownTemplate) return a.hasKnownTemplate ? -1 : 1;
      return a.value.localeCompare(b.value);
    });
  }, [qeybs, so]);

  const selectedSection = sectionOptions.find((s) => s.value === departmentScope);

  const filteredRows = useMemo(() => {
    if (!summary) return [];
    const q = tableFilter.trim().toLowerCase();
    let rows = summary.changes_preview ?? [];
    if (districtFilter !== "all") {
      rows = rows.filter((r) => districtFromDiff(r.diff) === districtFilter);
    }
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.service_id.toLowerCase().includes(q)
        || r.name.toLowerCase().includes(q)
        || r.action.toLowerCase().includes(q),
    );
  }, [summary, tableFilter, districtFilter]);

  const districtBreakdown = useMemo(() => {
    if (!summary?.district_breakdown) return [];
    return Object.entries(summary.district_breakdown).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  const acceptFile = useCallback((f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      toast({ title: so ? "Faylka ma aha Excel" : "File must be .xlsx or .xls", variant: "destructive" });
      return;
    }
    setFile(f);
  }, [so]);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      acceptFile(e.dataTransfer.files?.[0] ?? null);
    },
    [acceptFile],
  );

  const runImport = async (dryRun: boolean) => {
    if (!file) return;
    try {
      const result = await importMutation.mutateAsync({ file, dryRun, departmentScope: departmentScope || undefined });
      setSummary((prev) => {
        if (!dryRun && prev) {
          return { ...prev, ...result, dry_run: false };
        }
        return result;
      });
      setStep(dryRun ? "preview" : "done");
      if (!dryRun) toast({ title: so ? "Import waa la dhammeeyay" : "Import completed successfully" });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || "Import failed", variant: "destructive" });
    }
  };

  const handleMergeConflict = async (row: ImportChangePreview) => {
    if (!file) return;
    const agents = conflictAgentsFromRow(row);
    if (agents.length < 2) return;
    setMergingServiceId(row.service_id);
    try {
      await mergeMutation.mutateAsync({
        agent_ids: agents.map((agent) => agent.id),
        excel_service_id: row.service_id,
        preferred_phone: String(row.diff.phone || agents.find((agent) => agent.phone)?.phone || ""),
      });
      const result = await importMutation.mutateAsync({
        file,
        dryRun: true,
        departmentScope: departmentScope || undefined,
      });
      setSummary(result);
      toast({
        title: so ? "Ciidanka waa la mideeyay" : "Agents merged",
        description: so ? "Hubinta waa la cusbooneysiiyay" : "Preview refreshed after merge",
      });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast({ title: detail || (so ? "Isku xirka wuu fashilmay" : "Merge failed"), variant: "destructive" });
    } finally {
      setMergingServiceId(null);
    }
  };

  const resetWizard = () => {
    setStep("upload");
    setSummary(null);
    setFile(null);
    setTableFilter("");
    setDistrictFilter("all");
  };

  const workflowSteps = so
    ? [
        { n: 1, title: "Dooro qaybta", desc: "Dooro qaybta aad soo dejinayso" },
        { n: 2, title: "Soo rar Excel", desc: "Faylka liiska ciidanka" },
        { n: 3, title: "Hubi & Muuji", desc: "Eeg natiijada ka hor intaadan ansixin" },
        { n: 4, title: "Ansixi & Soo deji", desc: "Ku celi qaybta kale" },
      ]
    : [
        { n: 1, title: "Select section", desc: "Choose the section you are importing" },
        { n: 2, title: "Upload Excel", desc: "Section roster file" },
        { n: 3, title: "Validate & Preview", desc: "Review before applying" },
        { n: 4, title: "Confirm & Apply", desc: "Repeat for other section" },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
      {/* Hero header */}
      <div
        style={{
          position: "relative",
          borderRadius: 18,
          border: `1px solid ${C.cardBdr}`,
          background: C.cardBg,
          boxShadow: C.cardShadow,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${hexA(accent, 0.12)} 0%, transparent 55%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ padding: "22px 24px 20px", position: "relative" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div style={{ flex: "1 1 280px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: hexA(accent, 0.12),
                  border: `1px solid ${hexA(accent, 0.28)}`,
                  color: accent,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "var(--font-outfit)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                <Icon name="clipboard" size={13} sw={2} />
                {so ? "Maamulka Ciidanka" : "Personnel"}
              </div>
              <h2 style={{ margin: 0, fontFamily: "var(--font-cinzel)", color: C.txtPrimary, fontSize: 26, lineHeight: 1.2 }}>
                {so ? "Soo Dejinta Excel" : "Excel Agent Import"}
              </h2>
              <p style={{ margin: "8px 0 0", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13.5, maxWidth: 520, lineHeight: 1.55 }}>
                {so
                  ? "Soo rar hal fayl qayb kasta. Wareejinta degmooyinka waa la diiwaangelinayaa si otomaatig ah."
                  : "Upload one roster file per section. District transfers are recorded automatically across imports."}
              </p>
            </div>
            <StepIndicator step={step} so={so} C={C} accent={accent} />
          </div>
        </div>
      </div>

      {/* Upload step */}
      {step === "upload" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(320px, 1.4fr)", gap: 18, alignItems: "start" }}>
          {/* Workflow guide */}
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              boxShadow: C.cardShadow,
              padding: "18px 20px",
            }}
          >
            <div style={{ fontFamily: "var(--font-cinzel)", fontSize: 15, color: C.txtPrimary, marginBottom: 14 }}>
              {so ? "Habka shaqada" : "How to import"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {workflowSteps.map((ws) => (
                <div
                  key={ws.n}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${C.inputBdr}`,
                    background: C.inputBg,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: hexA(accent, 0.12),
                      color: accent,
                      fontFamily: "var(--font-outfit)",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {ws.n}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 13, color: C.txtPrimary }}>{ws.title}</div>
                    <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, color: C.txtMuted, marginTop: 2 }}>{ws.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload form */}
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              boxShadow: C.cardShadow,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                {so ? "1. Dooro qaybta" : "1. Select section"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {sectionOptions.map((s) => {
                  const selected = departmentScope === s.value;
                  const disabled = !s.hasDistricts;
                  return (
                    <button
                      key={s.id ?? s.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setDepartmentScope(s.value)}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderRadius: 12,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.55 : 1,
                        border: `1.5px solid ${selected ? accent : C.inputBdr}`,
                        background: selected ? hexA(accent, 0.08) : C.inputBg,
                        boxShadow: selected ? `0 0 0 3px ${hexA(accent, 0.12)}` : "none",
                        transition: "all .2s ease",
                        fontFamily: "var(--font-outfit)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: C.txtPrimary }}>{s.value}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {s.hasKnownTemplate && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: ".05em",
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: hexA(accent, 0.12),
                                color: accent,
                              }}
                            >
                              {so ? "Template" : "Template"}
                            </span>
                          )}
                          {selected && (
                            <span style={{ color: accent }}>
                              <Icon name="check" size={16} sw={2.2} />
                            </span>
                          )}
                        </div>
                      </div>
                      {s.districts ? (
                        <div style={{ fontSize: 11.5, color: C.txtMuted, marginTop: 5, lineHeight: 1.4 }}>{s.districts}</div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: "#b8860b", marginTop: 5, lineHeight: 1.4 }}>
                          {so ? "Degmooyin lama xirin — ku xir qaybta marka hore" : "No districts linked — assign counties to this section first"}
                        </div>
                      )}
                      {s.fileHint && (
                        <div style={{ fontSize: 11, color: accent, marginTop: 6, opacity: 0.9 }}>{s.fileHint}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                {so ? "2. Soo rar faylka Excel" : "2. Upload Excel file"}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${dragOver ? accent : file ? hexA(accent, 0.5) : C.inputBdr}`,
                  borderRadius: 14,
                  padding: file ? "20px 22px" : "36px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? hexA(accent, 0.06) : C.inputBg,
                  transition: "all .2s ease",
                }}
              >
                {file ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: hexA(accent, 0.12),
                        color: accent,
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="file" size={22} sw={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14, color: C.txtPrimary, wordBreak: "break-all" }}>
                        {file.name}
                      </div>
                      <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, color: C.txtMuted, marginTop: 3 }}>
                        {formatBytes(file.size)}
                        {selectedSection?.fileHint ? ` · ${selectedSection.fileHint}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: `1px solid ${C.inputBdr}`,
                        background: "transparent",
                        color: C.txtMuted,
                        cursor: "pointer",
                        fontFamily: "var(--font-outfit)",
                        fontSize: 12,
                      }}
                    >
                      {so ? "Ka saar" : "Remove"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        margin: "0 auto 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: hexA(accent, 0.1),
                        color: accent,
                      }}
                    >
                      <Icon name="folder" size={24} sw={1.7} />
                    </div>
                    <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14, color: C.txtPrimary }}>
                      {so ? "Jiid oo dhig ama guji si aad u doorato" : "Drag & drop or click to browse"}
                    </div>
                    <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, color: C.txtMuted, marginTop: 5 }}>
                      .xlsx, .xls
                    </div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => acceptFile(e.target.files?.[0] ?? null)} />
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <PrimaryButton
                accent={accent}
                onClick={() => runImport(true)}
                disabled={!file || !departmentScope || importMutation.isPending}
              >
                {importMutation.isPending
                  ? (so ? "Waa la hubinayaa…" : "Validating…")
                  : (so ? "Hubi & Muuji" : "Validate & Preview")}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Preview / Done */}
      {summary && step !== "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Context bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              borderRadius: 14,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              boxShadow: C.cardShadow,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: hexA(accent, 0.12),
                color: accent,
              }}
            >
              <Icon name="file" size={20} sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14, color: C.txtPrimary }}>
                {summary.source_section || departmentScope || "—"}
              </div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, color: C.txtMuted, marginTop: 2 }}>
                {file?.name}
                {file ? ` · ${formatBytes(file.size)}` : ""}
              </div>
            </div>
            {step === "done" && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 99,
                  background: "rgba(70,192,138,0.12)",
                  border: "1px solid rgba(70,192,138,0.3)",
                  color: "#2d9d6e",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Icon name="check" size={14} sw={2.2} />
                {so ? "La dhammeeyay" : "Applied"}
              </div>
            )}
          </div>

          {/* Stats */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: `1px solid ${C.cardBdr}`,
              background: hexA(accent, 0.05),
              fontFamily: "var(--font-outfit)",
              fontSize: 13,
              color: C.txtSecondary,
              lineHeight: 1.55,
            }}
          >
            {so
              ? `Isbarbardhig: ${summary.total_rows} saf Excel vs ${summary.section_db_total ?? "—"} ciidan DB-ga qaybtan. DB = ${summary.matched_in_section ?? "—"} la helay + ${summary.missing_from_excel} Excel-ka ma jiraan. "La helay" (${summary.existing_agents}) waxaa ku jira ${summary.matched_outside_section ?? 0} saf oo ku xiran ciidan ka baxsan qaybtan (wareejin).`
              : `Comparing ${summary.total_rows} Excel rows vs ${summary.section_db_total ?? "—"} agents in this section. In DB now = ${summary.matched_in_section ?? "—"} matched in section + ${summary.missing_from_excel} not in Excel. The Matched count (${summary.existing_agents}) includes ${summary.matched_outside_section ?? 0} Excel row(s) linked to agents outside this section (transfers).`}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard C={C} accent={accent} icon="list" label={so ? "Excel" : "In Excel"} value={summary.total_rows} />
            <StatCard C={C} accent={accent} icon="users" label={so ? "DB hadda" : "In DB now"} value={summary.section_db_total ?? 0} />
            <StatCard C={C} accent={accent} icon="plus" label={so ? "Cusub Excel" : "New in Excel"} value={summary.new_agents ?? 0} tone="ok" />
            <StatCard
              C={C}
              accent={accent}
              icon="check"
              label={so ? "La helay (Excel)" : "Matched (Excel)"}
              value={summary.existing_agents ?? 0}
              tone="accent"
              hint={
                summary.matched_in_section != null
                  ? so
                    ? `${summary.matched_in_section} qaybta gudaheeda`
                    : `${summary.matched_in_section} in section`
                  : undefined
              }
            />
            <StatCard C={C} accent={accent} icon="arrow" label={so ? "Wareejin" : "Transfers"} value={summary.district_changes ?? 0} tone={summary.district_changes ? "warn" : undefined} />
            <StatCard
              C={C}
              accent={accent}
              icon="search"
              label={so ? "Ka saar qaybta" : "Release from section"}
              value={summary.released_from_section ?? summary.missing_from_excel ?? 0}
              tone={(summary.released_from_section ?? summary.missing_from_excel) ? "warn" : undefined}
              hint={so ? "Lama tirtiro DB" : "Not deleted from DB"}
            />
            <StatCard C={C} accent={accent} icon="badge" label={so ? "Isku-noqnoq" : "Duplicates"} value={summary.duplicate_records ?? 0} tone={summary.duplicate_records ? "warn" : undefined} />
            {(summary.conflicts ?? 0) > 0 && (
              <StatCard C={C} accent={accent} icon="close" label={so ? "Khilaaf" : "Conflicts"} value={summary.conflicts ?? 0} tone="danger" />
            )}
          </div>

          {/* District breakdown — all districts in file, not just preview slice */}
          {districtBreakdown.length > 0 && (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${C.cardBdr}`,
                background: C.cardBg,
                boxShadow: C.cardShadow,
                padding: "16px 18px",
              }}
            >
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12, fontWeight: 600, color: C.txtMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                {so ? "Qaybinta degmooyinka (faylka oo dhan)" : "District breakdown (entire file)"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {districtBreakdown.map(([name, count]) => {
                  const active = districtFilter === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setDistrictFilter(active ? "all" : name)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 99,
                        border: `1px solid ${active ? accent : C.inputBdr}`,
                        background: active ? hexA(accent, 0.12) : C.inputBg,
                        color: active ? accent : C.txtPrimary,
                        cursor: "pointer",
                        fontFamily: "var(--font-outfit)",
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <span>{name}</span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: active ? hexA(accent, 0.18) : hexA(C.txtMuted, 0.12),
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
                {districtFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setDistrictFilter("all")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 99,
                      border: `1px dashed ${C.inputBdr}`,
                      background: "transparent",
                      color: C.txtMuted,
                      cursor: "pointer",
                      fontFamily: "var(--font-outfit)",
                      fontSize: 12,
                    }}
                  >
                    {so ? "Dhammaan" : "Show all"}
                  </button>
                )}
              </div>
              {(summary.section_hq_count ?? 0) > 0 && (
                <p style={{ margin: "12px 0 0", fontFamily: "var(--font-outfit)", fontSize: 12.5, color: C.txtMuted, lineHeight: 1.5 }}>
                  {so
                    ? `${summary.section_hq_count} ciidan waxay ku jiraan hore DEGMADA — Change wuxuu muujinayaa jagada Excel (tusaale Taliye Qeybta).`
                    : `${summary.section_hq_count} agent(s) appear before any DEGMADA header — Change shows their Excel title (e.g. Taliye Qeybta, Taliska Ilaalada).`}
                </p>
              )}
            </div>
          )}

          {/* Alerts */}
          {step === "done" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(70,192,138,0.28)",
                background: "rgba(70,192,138,0.08)",
              }}
            >
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#2d9d6e" }}>{summary.created ?? 0}</div>
                {so ? "Cusub" : "Created"}
              </div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#2d9d6e" }}>{summary.updated ?? 0}</div>
                {so ? "Cusbooneysiiyay" : "Updated"}
              </div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#b8860b" }}>{summary.transferred ?? 0}</div>
                {so ? "Wareejiyay" : "Transferred"}
              </div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary }}>
                <div style={{ fontWeight: 700, fontSize: 22, color: "#b8860b" }}>{summary.released ?? 0}</div>
                {so ? "Laga saaray qaybta" : "Released from section"}
              </div>
            </div>
          )}

          {step === "preview" && (summary.conflicts ?? 0) > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(184,134,11,0.35)",
                background: "rgba(184,134,11,0.08)",
                fontFamily: "var(--font-outfit)",
                fontSize: 13,
                color: C.txtSecondary,
                lineHeight: 1.55,
              }}
            >
              {so
                ? `${summary.conflicts} khilaaf ayaa jira — badanaa telefoon kala duwan (061, 61, 25261). Guji Isku xir saf kasta, kadibna hubi mar kale.`
                : `${summary.conflicts} conflict(s) found — usually the same person with different phone formats (061, 61, 25261). Click Merge on each row, then validate again.`}
            </div>
          )}

          {step === "preview" && (summary.district_changes ?? 0) > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(184,134,11,0.35)",
                background: "rgba(184,134,11,0.08)",
                fontFamily: "var(--font-outfit)",
                fontSize: 13,
                color: C.txtSecondary,
                lineHeight: 1.55,
              }}
            >
              {so
                ? `${summary.district_changes} ciidan (qayb/degmo kale ama laga sii daayay) ayaa si otomaatig ah loo wareejin doonaa markaad Ansixi & Soo Deji gujiso.`
                : `${summary.district_changes} agent(s) from another section/district or previously released will transfer automatically when you click Confirm & Apply.`}
            </div>
          )}

          {step === "preview" && (summary.released_from_section ?? summary.missing_from_excel ?? 0) > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(184,134,11,0.35)",
                background: "rgba(184,134,11,0.06)",
                fontFamily: "var(--font-outfit)",
                fontSize: 13,
                color: C.txtSecondary,
                lineHeight: 1.55,
              }}
            >
              {so
                ? `${summary.released_from_section ?? summary.missing_from_excel} ciidan oo qaybtan ku jira laakiin Excel-ka ma jiraan waxaa laga saari doonaa qaybtan kaliya markaad ansixiso (lama tirtiro database-ka — waxay weli u baahan karaan qaybo kale).`
                : `${summary.released_from_section ?? summary.missing_from_excel} agent(s) in this section but not in Excel will be released from this section only when you apply. They are not deleted — they may belong to other sections or districts later.`}
            </div>
          )}

          {step === "preview" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 18px",
              borderRadius: 14,
              background: summary.ready_to_apply ? "rgba(70,192,138,0.08)" : "rgba(196,74,63,0.08)",
              border: `1px solid ${summary.ready_to_apply ? "rgba(70,192,138,0.28)" : "rgba(196,74,63,0.28)"}`,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: summary.ready_to_apply ? "rgba(70,192,138,0.15)" : "rgba(196,74,63,0.15)",
                color: summary.ready_to_apply ? "#2d9d6e" : "#c44a3f",
                flexShrink: 0,
              }}
            >
              <Icon name={summary.ready_to_apply ? "check" : "close"} size={20} sw={2.2} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-outfit)",
                  fontWeight: 700,
                  fontSize: 15,
                  color: summary.ready_to_apply ? "#2d9d6e" : "#c44a3f",
                }}
              >
                {summary.ready_to_apply
                  ? (so ? "Diyaar in la isticmaalo" : "Ready to apply")
                  : (so ? "Lama isticmaali karo" : "Cannot apply yet")}
              </div>
              <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12.5, color: C.txtMuted, marginTop: 3 }}>
                {summary.ready_to_apply
                  ? (so ? "Dhammaan safafka waa sax — waxaad ansixin kartaa import-ka" : "All rows validated — you can confirm the import")
                  : (so ? "Hagaaji khaladaadka ama isku-noqnoqyada faylka ka hor intaadan ansixin" : "Fix errors or duplicates in this file before confirming")}
              </div>
            </div>
          </div>
          )}

          {step === "preview" && (
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              boxShadow: C.cardShadow,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 18px",
                borderBottom: `1px solid ${C.tableSep}`,
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab("excel")}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 99,
                    border: `1px solid ${previewTab === "excel" ? accent : C.inputBdr}`,
                    background: previewTab === "excel" ? hexA(accent, 0.12) : C.inputBg,
                    color: previewTab === "excel" ? accent : C.txtMuted,
                    fontFamily: "var(--font-outfit)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {so ? "Excel" : "In Excel"} ({summary.changes_preview?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("missing")}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 99,
                    border: `1px solid ${previewTab === "missing" ? accent : C.inputBdr}`,
                    background: previewTab === "missing" ? hexA(accent, 0.12) : C.inputBg,
                    color: previewTab === "missing" ? accent : C.txtMuted,
                    fontFamily: "var(--font-outfit)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {so ? "Ka saar qaybta" : "Release from section"} ({summary.released_from_section ?? summary.missing_from_excel})
                </button>
              </div>
              {previewTab === "excel" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {summary.preview_truncated && (
                  <span style={{ fontFamily: "var(--font-outfit)", fontSize: 11.5, color: "#b8860b" }}>
                    {so ? "Muuqaalka waa la gooyay" : "Preview truncated"}
                  </span>
                )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  minWidth: 200,
                }}
              >
                <Icon name="search" size={15} sw={1.8} />
                <input
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder={so ? "Raadi ID ama magac…" : "Search ID or name…"}
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: C.txtPrimary,
                    fontFamily: "var(--font-outfit)",
                    fontSize: 13,
                    width: "100%",
                  }}
                />
              </div>
              </div>
              )}
            </div>
            <div style={{ overflowX: "auto", maxHeight: 420 }}>
              {previewTab === "excel" ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.tableHead, color: C.txtMuted, textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>Emp No</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Magac" : "Name"}</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Xaalad" : "Status"}</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Isbeddel" : "Change"}</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Ficil" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => {
                    const badge = actionBadge(row.action);
                    const conflictAgents = conflictAgentsFromRow(row);
                    const canMerge = row.action.toUpperCase() === "CONFLICT" && conflictAgents.length >= 2;
                    const isMerging = mergingServiceId === row.service_id;
                    return (
                      <tr
                        key={`${row.service_id}-${row.action}-${i}`}
                        style={{ borderTop: `1px solid ${C.tableSep}` }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        <td style={{ padding: "11px 18px", color: C.txtPrimary, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{row.service_id}</td>
                        <td style={{ padding: "11px 18px", color: C.txtPrimary }}>{row.name}</td>
                        <td style={{ padding: "11px 18px" }}>
                          <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {row.action}
                          </span>
                        </td>
                        <td style={{ padding: "11px 18px", color: C.txtMuted, fontSize: 12.5 }}>
                          {formatChange(row.diff, so)}
                          {row.errors?.length ? <span style={{ color: "#c44a3f", marginLeft: 6 }}>· {row.errors.join("; ")}</span> : null}
                          {canMerge && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                              {conflictAgents.map((agent) => (
                                <div key={agent.id} style={{ fontSize: 11.5, color: C.txtSecondary }}>
                                  #{agent.id} · {formatAgentLabel(agent, so)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "11px 18px", verticalAlign: "top" }}>
                          {canMerge && (
                            <button
                              type="button"
                              disabled={isMerging || mergeMutation.isPending}
                              onClick={() => handleMergeConflict(row)}
                              style={{
                                padding: "7px 12px",
                                borderRadius: 8,
                                border: `1px solid ${hexA(accent, 0.35)}`,
                                background: hexA(accent, 0.1),
                                color: accent,
                                fontFamily: "var(--font-outfit)",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: isMerging || mergeMutation.isPending ? "wait" : "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isMerging
                                ? (so ? "Waa la mideynayaa…" : "Merging…")
                                : (so ? "Isku xir" : "Merge")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredRows.length && (
                    <tr>
                      <td colSpan={5} style={{ padding: "32px 18px", textAlign: "center", color: C.txtMuted }}>{so ? "Natiijo lama helin" : "No matching rows"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.tableHead, color: C.txtMuted, textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>Emp No</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Magac" : "Name"}</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Telefoon" : "Phone"}</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Laqab" : "Nickname"}</th>
                    <th style={{ padding: "11px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{so ? "Degmo" : "District"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.missing_preview ?? []).map((row, i) => (
                    <tr key={`missing-${row.service_id}-${i}`} style={{ borderTop: `1px solid ${C.tableSep}` }}>
                      <td style={{ padding: "11px 18px", color: C.txtPrimary }}>{row.service_id || "—"}</td>
                      <td style={{ padding: "11px 18px", color: C.txtPrimary }}>{row.name}</td>
                      <td style={{ padding: "11px 18px", color: C.txtMuted }}>{row.phone || "—"}</td>
                      <td style={{ padding: "11px 18px", color: C.txtMuted }}>{row.nickname || "—"}</td>
                      <td style={{ padding: "11px 18px", color: C.txtMuted }}>{row.district || "—"}</td>
                    </tr>
                  ))}
                  {!(summary.missing_preview ?? []).length && (
                    <tr>
                      <td colSpan={5} style={{ padding: "32px 18px", textAlign: "center", color: C.txtMuted }}>
                        {so ? "Dhammaan ciidanka DB waxay ku jiraan Excel" : "All section DB agents appear in the Excel file"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              padding: "16px 18px",
              borderRadius: 14,
              border: `1px solid ${C.cardBdr}`,
              background: C.cardBg,
              boxShadow: C.cardShadow,
            }}
          >
            {step === "done" && summary && (
              <div style={{ width: "100%", marginBottom: 4, fontFamily: "var(--font-outfit)", fontSize: 13, color: C.txtSecondary, lineHeight: 1.6 }}>
                {so ? "Natiijada:" : "Applied:"}{" "}
                {summary.created ?? 0} {so ? "cusub" : "created"},{" "}
                {summary.updated ?? 0} {so ? "cusbooneysiiyay" : "updated"},{" "}
                {summary.transferred ?? 0} {so ? "wareejiyay" : "transferred"},{" "}
                {summary.released ?? 0} {so ? "laga saaray qaybta" : "released from section"}.
              </div>
            )}
            {step === "preview" && (
              <>
                <SecondaryButton C={C} onClick={() => { setStep("upload"); setSummary(null); setTableFilter(""); setDistrictFilter("all"); }}>
                  {so ? "Dib u noqo" : "Back"}
                </SecondaryButton>
                <PrimaryButton
                  accent={accent}
                  onClick={() => runImport(false)}
                  disabled={!summary.ready_to_apply || importMutation.isPending}
                >
                  {importMutation.isPending
                    ? (so ? "Waa la dejinayaa…" : "Applying…")
                    : (so ? "Ansixi & Soo Deji" : "Confirm & Apply")}
                </PrimaryButton>
              </>
            )}
            {step === "done" && (
              <>
                <PrimaryButton accent={accent} onClick={resetWizard}>
                  {so ? "Import Qayb Kale" : "Import Another Section"}
                </PrimaryButton>
                <SecondaryButton C={C} onClick={() => { setStep("preview"); }}>
                  {so ? "Eeg muuqaalka" : "View preview again"}
                </SecondaryButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
