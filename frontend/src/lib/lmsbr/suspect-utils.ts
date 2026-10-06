import type { Suspect, SuspectStatus } from "@/types/suspect";
import type { getDict } from "@/lib/lmsbr/data";

const TUHUNKA_PALETTE = ["#e0655a", "#e6b25c", "#8b5cf6", "#46c08a", "#5b9fd4", "#f0a04a"];
const MOGADISHU_TZ = "Africa/Mogadishu";

export function suspectCaptureDistrict(suspect: Pick<Suspect, "capture_county_name" | "district">) {
  return (suspect.capture_county_name || suspect.district || "").trim() || "—";
}

/** Capture datetime in Mogadishu — date + clock (e.g. 18 Jul 2026 · 10:32 AM). */
export function formatCaptureDateTime(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: MOGADISHU_TZ,
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: MOGADISHU_TZ,
  });
  return { date, time };
}

export function statusColor(status: SuspectStatus) {
  const map: Record<SuspectStatus, string> = {
    active: "#e0655a",
    watching: "#e6b25c",
    cleared: "#46c08a",
    detained: "#8b5cf6",
  };
  return map[status];
}

export function tuhunkaColor(name: string | null | undefined, fallback = "#9a8a6f") {
  if (!name) return fallback;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TUHUNKA_PALETTE[h % TUHUNKA_PALETTE.length];
}

export function statusLabel(status: SuspectStatus, t: ReturnType<typeof getDict>) {
  return {
    active: t.statusActive,
    watching: t.statusWatching,
    cleared: t.statusCleared,
    detained: t.statusDetained,
  }[status];
}

export function tuhunkaLabel(name: string | null | undefined, t: ReturnType<typeof getDict>) {
  return name?.trim() || t.noTuhunka;
}
