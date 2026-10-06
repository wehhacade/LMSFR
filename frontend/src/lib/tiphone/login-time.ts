/** Last-login display (Mogadishu) — mirrors ilaalo-shacab-v3 loginTime. */

const MOGADISHU_TZ = "Africa/Mogadishu";
const NEVER_LOGGED_IN = "Weligii ma soo galin";
const LEGACY_WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const SOMALI_WEEKDAYS = ["Axad", "Isniin", "Talaado", "Arbaco", "Khamiis", "Jimco", "Sabti"] as const;

export interface LastLoginDisplay {
  never: boolean;
  line1: string;
  line2?: string;
}

function formatModifiedDatesSomali(from: Date, now = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return days === 1 ? "1 day ka hor" : `${days} maalin ka hor`;
  if (hours > 0) return hours === 1 ? "1 hour ka hor" : `${hours} saacad ka hor`;
  if (minutes > 0) return `${minutes} daqiiqo ka hor`;
  if (secs > 0) return secs === 1 ? "1 ilbiriqsi ka hor" : `${secs} ilbiriqsi ka hor`;
  return "Hadda";
}

function mogadishuYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOGADISHU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10);
}

function mogadishuDayOfWeek(date: Date): number {
  const token = new Intl.DateTimeFormat("en-US", {
    timeZone: MOGADISHU_TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[token] ?? 0;
}

function mogadishuYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: MOGADISHU_TZ, year: "numeric" }).format(date),
  );
}

function somaliDayPeriod(hour24: number, minute = 0): string {
  const total = hour24 * 60 + minute;
  if (total >= 18 * 60 || total < 5 * 60) return "habeenimo";
  if (total < 12 * 60) return "subax";
  if (total < 15 * 60) return "duhur";
  return "galab";
}

function formatTimeSomali(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOGADISHU_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour24 = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${somaliDayPeriod(hour24, minute)}`;
}

function formatMonthDaySomali(date: Date, withYear = false): string {
  return new Intl.DateTimeFormat("so-SO", {
    timeZone: MOGADISHU_TZ,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(date);
}

function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000,
  );
}

function parseUtcWallClock(value: string): Date | null {
  const match = value.match(LEGACY_WALL_CLOCK);
  if (!match) return null;
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
    ),
  );
}

function parseLastLoginDate(
  lastLoginAt?: string | null,
  lastLoginText?: string | null,
): Date | null {
  const iso = lastLoginAt?.trim();
  if (iso) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const text = lastLoginText?.trim();
  if (!text || text === "—" || text === NEVER_LOGGED_IN) return null;
  if (LEGACY_WALL_CLOCK.test(text)) return parseUtcWallClock(text);
  const loose = new Date(text);
  return Number.isNaN(loose.getTime()) ? null : loose;
}

function formatLoginDisplay(date: Date, now = new Date()): LastLoginDisplay {
  const timeStr = formatTimeSomali(date);
  const todayYmd = mogadishuYmd(now);
  const dateYmd = mogadishuYmd(date);
  const daysAgo = daysBetweenYmd(dateYmd, todayYmd);

  if (dateYmd === todayYmd) {
    const secondsAgo = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    if (secondsAgo < 3600) {
      return { never: false, line1: formatModifiedDatesSomali(date, now), line2: timeStr };
    }
    return { never: false, line1: "Maanta", line2: timeStr };
  }
  if (dateYmd === previousYmd(todayYmd)) {
    return { never: false, line1: "Shalay", line2: timeStr };
  }
  if (daysAgo > 0 && daysAgo < 7) {
    return { never: false, line1: SOMALI_WEEKDAYS[mogadishuDayOfWeek(date)]!, line2: timeStr };
  }
  if (mogadishuYear(date) === mogadishuYear(now)) {
    return { never: false, line1: formatMonthDaySomali(date), line2: timeStr };
  }
  return { never: false, line1: formatMonthDaySomali(date, true), line2: timeStr };
}

export function resolveLastLoginDisplay(
  lastLoginAt?: string | null,
  lastLoginText?: string | null,
): LastLoginDisplay {
  const text = lastLoginText?.trim();
  if (!lastLoginAt?.trim() && (!text || text === "—")) {
    return { never: false, line1: "—" };
  }
  if (text === NEVER_LOGGED_IN && !lastLoginAt?.trim()) {
    return { never: true, line1: NEVER_LOGGED_IN };
  }
  const parsed = parseLastLoginDate(lastLoginAt, lastLoginText);
  if (parsed) return formatLoginDisplay(parsed);
  if (text === NEVER_LOGGED_IN) return { never: true, line1: NEVER_LOGGED_IN };
  return { never: false, line1: text || "—" };
}
