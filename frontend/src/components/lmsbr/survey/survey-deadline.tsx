"use client";

export type DeadlineFilterValue = "" | "expired" | "upcoming" | "soon" | "none";

export function formatDeadlineDate(iso: string | null | undefined, so: boolean): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(so ? "so-SO" : "en", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function deadlineRemainingLabel(
  days: number | null | undefined,
  expired: boolean | undefined,
  so: boolean,
): string {
  if (days == null) return "";
  if (expired || days < 0) {
    const overdue = Math.abs(days);
    if (overdue === 0) return so ? "Dhacay maanta" : "Expired today";
    return so
      ? `Dhacay · ${overdue} maalin ka hor`
      : `Expired · ${overdue} day${overdue === 1 ? "" : "s"} ago`;
  }
  if (days === 0) return so ? "Maanta dhacaaya" : "Due today";
  if (days === 1) return so ? "1 maalin haray" : "1 day left";
  return so ? `${days} maalin haray` : `${days} days left`;
}

export function deadlineTone(
  days: number | null | undefined,
  expired: boolean | undefined,
): { color: string; bg: string; border: string } {
  if (days == null && !expired) {
    return { color: "#94a3b8", bg: "transparent", border: "transparent" };
  }
  if (expired || (days != null && days < 0)) {
    return { color: "#dc2626", bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.28)" };
  }
  if (days != null && days <= 7) {
    return { color: "#d97706", bg: "rgba(217,119,6,0.10)", border: "rgba(217,119,6,0.28)" };
  }
  return { color: "#059669", bg: "rgba(5,150,105,0.10)", border: "rgba(5,150,105,0.28)" };
}

export function SurveyDeadlineCell({
  deadlineAt,
  isExpired,
  daysRemaining,
  so,
  mutedColor,
}: {
  deadlineAt?: string | null;
  isExpired?: boolean;
  daysRemaining?: number | null;
  so: boolean;
  mutedColor: string;
}) {
  if (!deadlineAt) {
    return <span style={{ color: mutedColor, fontSize: 13 }}>—</span>;
  }
  const tone = deadlineTone(daysRemaining, isExpired);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
      <span style={{ color: tone.color, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
        {formatDeadlineDate(deadlineAt, so)}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          color: tone.color,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          whiteSpace: "nowrap",
        }}
      >
        {deadlineRemainingLabel(daysRemaining, isExpired, so)}
      </span>
    </div>
  );
}

export function deadlineFilterOptions(so: boolean): Array<{ value: DeadlineFilterValue; label: string }> {
  return [
    { value: "", label: so ? "Dhammaan muddada" : "All deadlines" },
    { value: "expired", label: so ? "Dhacay" : "Expired" },
    { value: "upcoming", label: so ? "Weli furan" : "Upcoming" },
    { value: "soon", label: so ? "7 maalmood gudahood" : "Expiring soon (7d)" },
    { value: "none", label: so ? "Muddada ma lahan" : "No deadline" },
  ];
}
